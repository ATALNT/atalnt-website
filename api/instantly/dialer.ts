// ============================================
// /api/instantly/dialer  (dashboard auth required)
//
// Sourcing/ops dial companion. Recruiters paste the candidates they have called
// and left voicemails for; each candidate is created as a lead in that
// recruiter's own ISOLATED: Instantly campaign and receives the 4-email sequence
// the team already wrote, sent from that recruiter's own mailbox (30/day, stops
// on reply).
//
// Everything comes from the pasted rows — nothing is selected in the UI. One
// paste can cover several recruiters at once:
//   recruiter first name | candidate first name | candidate email | job title
//
// The sequence copy lives in Instantly and is NEVER touched from here. The job
// title is written BOTH as Instantly's top-level `personalization` (what the
// current copy reads, e.g. "this {{personalization}} opportunity") and as the
// `JobTitle` custom variable (what the older copy reads). One column, both
// shapes, no campaign edits required.
//
// GET  ?action=status                  -> per-rep queue + send stats
// GET  ?action=readiness               -> per-rep: can this campaign be fed yet?
// GET  ?action=list&rep=<key>          -> that rep's leads with step/state
// POST { action:'add', leads:[{rep, firstName, email, jobTitle}] }  (max 25)
// POST { action:'delete', id }
//
// Safety rails:
//  - a campaign is read at add time and rows are REFUSED if its sequence needs a
//    merge field the paste cannot supply, so an email can never go out showing a
//    literal "{{Bullet 2}}" to a candidate
//  - dedupe against the ENTIRE Instantly account (cold campaigns included), so a
//    candidate already being emailed by a cold campaign is never double-touched
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 300;

const INSTANTLY = 'https://api.instantly.ai/api/v2';

// Campaign ids are the ones renamed to the ISOLATED: prefix on 2026-08-03, which
// is what keeps the health guard and the lead pruner off them. Mirror of
// ISOLATED_OWNER in .github/ci/instantly-health.mjs — keep both in sync.
const REPS: Record<string, { email: string; name: string; campaignId: string }> = {
  mikee: { email: 'mikee@atalntrecruiting.com', name: 'Mikee', campaignId: 'b95a285b-00db-4f8c-acc5-f039f164e51d' },
  dee: { email: 'dee@atalntrecruiting.com', name: 'Dee', campaignId: 'e885013a-cea3-482a-911c-026ba93710c0' },
  jeet: { email: 'jeet@atalntrecruiting.com', name: 'Jeet', campaignId: 'df047d8b-3dc5-494a-8c53-9374e35a343b' },
  remishka: { email: 'remishka@atalntrecruiting.com', name: 'Remishka', campaignId: 'a8c83126-9d82-4596-9fc0-b399ef6eb81b' },
  kelona: { email: 'kelona@atalntrecruiting.com', name: 'Kelona', campaignId: 'a8b06382-1a01-413d-a515-d97953076458' },
  jessica: { email: 'jessica@atalntrecruiting.com', name: 'Jessica', campaignId: 'e1498c48-6a03-47c9-b4e9-7d1793a6a02d' },
};

// Merge fields a pasted row can satisfy, plus the ones Instantly fills itself.
// Any OTHER {{variable}} in a sequence means that campaign cannot be fed from
// this portal yet — it would send with a visible placeholder.
const SUPPLIED_VARS = new Set([
  'firstName',
  'lastName',
  'email',
  'companyName',
  'personalization', // <- the job title column
  'JobTitle', // <- same column, older copy reads this name
  'sendingAccountName', // <- Instantly substitutes the sending mailbox's name
]);

const DAILY_CAP = 30;
const SEQUENCE_STEPS = 4;
const MAX_LEADS_PER_REQUEST = 25;

// Gap between lead creates. Instantly caps the workspace at 20 requests/minute
// and the health guard draws on the same budget, so ~10/min for uploads leaves
// headroom. A 10-lead chunk takes about a minute and cannot trip the limit.
const CREATE_SPACING_MS = 6_000;

// Sending window — must match the campaign_schedule on the six campaigns
// (America/Chicago, 06:00-18:00, Mon-Fri). Used only to estimate "next email".
// Central rather than the recruiters' own hours: these are US candidates, and it
// is the candidate's inbox that decides whether the email gets read. The IANA
// zone (not a fixed UTC offset) keeps 6am at 6am across the CST/CDT switch.
const TIMEZONE = 'America/Chicago';
const WINDOW_START = 6;
const WINDOW_END = 18;

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface LeadInput {
  rep: string;
  firstName: string;
  email: string;
  jobTitle: string;
}

// ── Auth (inlined, matching the other api/instantly handlers) ────────────────
function verifyDashboardToken(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return false;
  return authHeader.split(' ')[1] === secret;
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function instHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'atalnt-sourcing-dialer',
  };
}

// Instantly caps the workspace at 20 requests/minute and the health guard shares
// that budget. Retry 429/5xx instead of failing the whole batch.
async function inst(url: string, init?: RequestInit, tries = 5): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: instHeaders(), ...init });
      if ((r.status === 429 || r.status >= 500) && i < tries - 1) {
        // 429 needs to outwait the whole rate window, not just a moment: the
        // cap is per minute, so back off 5s/10s/15s/20s (50s total) rather than
        // the 15s that used to give up while the limit was still in force.
        const base = r.status === 429 ? 5_000 : 1_500;
        await new Promise((s) => setTimeout(s, base * (i + 1)));
        continue;
      }
      return r;
    } catch {
      await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
    }
  }
  return null;
}

function cleanValue(raw: string | undefined): string {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

// ── Campaign readiness ──────────────────────────────────────────────────────
// Read the live sequence and report any merge field the paste cannot fill. This
// is deliberately computed from Instantly rather than hardcoded: as each
// campaign is converted to the {{firstName}} + {{personalization}} template, it
// starts accepting uploads automatically with no code change here.
async function campaignRequirements(campaignId: string): Promise<{ ready: boolean; missing: string[]; readError?: string }> {
  const r = await inst(`${INSTANTLY}/campaigns/${campaignId}`);
  if (!r || !r.ok) return { ready: false, missing: [], readError: 'Could not read the campaign from Instantly' };
  const c: any = await r.json();
  const steps = c?.sequences?.[0]?.steps || [];
  const found = new Set<string>();
  for (const step of steps) {
    for (const v of step.variants || []) {
      const text = `${v.body || ''} ${v.subject || ''}`;
      for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) found.add(m[1].trim());
    }
  }
  const missing = [...found].filter((v) => !SUPPLIED_VARS.has(v)).sort();
  return { ready: missing.length === 0, missing };
}

// ── Sending-window estimate ─────────────────────────────────────────────────
function nextSendingWindow(from: Date): Date {
  const d = new Date(from);
  for (let i = 0; i < 14; i++) {
    const local = new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
    const dow = local.getDay(); // 0 Sun .. 6 Sat
    const hour = local.getHours() + local.getMinutes() / 60;
    if (dow >= 1 && dow <= 5 && hour >= WINDOW_START && hour < WINDOW_END) return d;
    if (dow >= 1 && dow <= 5 && hour < WINDOW_START) {
      return new Date(d.getTime() + (WINDOW_START - hour) * 3_600_000);
    }
    d.setTime(d.getTime() + 24 * 3_600_000);
    const next = new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
    d.setTime(d.getTime() - (next.getHours() - WINDOW_START) * 3_600_000 - next.getMinutes() * 60_000);
  }
  return d;
}

// ── Instantly operations ────────────────────────────────────────────────────
// Dedupe is done by Instantly via skip_if_in_workspace, NOT by a pre-check here.
// Measured 2026-08-05 against a draft campaign:
//   - a plain POST of an existing address DOES create a second copy, so some
//     form of dedupe is genuinely required
//   - skip_if_in_workspace:true returns HTTP 200 with the EXISTING lead record
//     (its original id, timestamp_created and campaign) and creates nothing
// That makes the old per-lead /leads/list pre-check pure redundancy: it doubled
// the request cost against a 20/min workspace cap, which is what was making bulk
// uploads fail. One request per lead now, with account-wide protection intact.

// ── Address verification (MyEmailVerifier) ──────────────────────────────────
// 38 of 230 sourcing leads bounced (~16%), which burns mailbox reputation. Every
// address is now checked before it becomes a lead.
//
// Policy per the outbound runbook: keep Valid AND Catch-all, drop Invalid and
// Unknown. Catch-all must stay — freight and logistics domains run catch-all mail
// servers almost universally, and a Valid-only rule drops ~94% of real people.
//
// Off unless MYEMAILVERIFIER_API_KEY is set, so nothing breaks before the key is
// added; uploads simply behave as they do today.
const VERIFY_KEEP = new Set(['valid', 'catch-all', 'catchall', 'catch_all']);

async function verifyEmail(email: string): Promise<{ ok: boolean; status: string; skipped?: boolean }> {
  const key = process.env.MYEMAILVERIFIER_API_KEY;
  if (!key) return { ok: true, status: 'unverified', skipped: true };
  try {
    // The User-Agent is REQUIRED. MyEmailVerifier sits behind Cloudflare, which
    // answers a default runtime UA with 403 error 1010 (browser_signature_banned).
    // Without it every call fails, hits the fail-open branch below, and silently
    // passes every address through as verified. Verified 2026-08-13.
    const r = await fetch(
      `https://client.myemailverifier.com/verifier/validate_single/${encodeURIComponent(email)}/${encodeURIComponent(key)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    if (!r.ok) {
      // Fail OPEN: a verifier outage must not stop recruiters working. A bad
      // address costs one bounce; a blocked queue costs the whole day.
      console.error('verifyEmail http', r.status, email);
      return { ok: true, status: 'verifier_error', skipped: true };
    }
    const d: any = await r.json();
    const status = String(d?.Status || d?.status || '').trim();
    return { ok: VERIFY_KEEP.has(status.toLowerCase()), status: status || 'unknown' };
  } catch (e: any) {
    console.error('verifyEmail error', e?.message, email);
    return { ok: true, status: 'verifier_error', skipped: true };
  }
}

// ── The email log is the long-term memory ───────────────────────────────────
// Instantly's email log outlives the lead record: verified on the sales dialer,
// where the log held 39 distinct recipients against 37 surviving leads and both
// replies were still present for leads that no longer existed. So totals are
// counted from the log and survive purging.
type CampaignLog = { contacted: Set<string>; replied: Set<string> };
const logCache = new Map<string, { at: number; log: CampaignLog }>();
const OUR_MAILBOXES = new Set(Object.values(REPS).map((r) => r.email.toLowerCase()));

async function campaignLog(campaignId: string): Promise<CampaignLog> {
  const hit = logCache.get(campaignId);
  if (hit && Date.now() - hit.at < 60_000) return hit.log;

  const contacted = new Set<string>();
  const replied = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < 40; page++) {
    const r = await inst(
      `${INSTANTLY}/emails?campaign_id=${campaignId}&limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`
    );
    if (!r || !r.ok) break;
    const d: any = await r.json();
    for (const e of d.items || []) {
      const to = ((e.to_address_email_list || '').split(',')[0] || '').trim().toLowerCase();
      const from = (e.from_address_email || '').trim().toLowerCase();
      if (e.ue_type === 1 && to) contacted.add(to);
      // A reply arrives FROM the candidate and TO the rep, so only the sender
      // counts. Adding both sides would score our own mailbox as a replier.
      if (e.ue_type === 2 && from && !OUR_MAILBOXES.has(from)) replied.add(from);
    }
    after = d.next_starting_after;
    if (!after) break;
  }
  const log = { contacted, replied };
  logCache.set(campaignId, { at: Date.now(), log });
  return log;
}

// Finished leads are cleared out so the queue only shows people still in
// sequence. Only ones older than this are touched: the intake counters below
// read lead timestamps, and purging a lead added this week would make "added in
// the last 7 days" fall retroactively.
const PURGE_COMPLETED_AFTER_DAYS = 30;

async function purgeCompleted(campaignId: string): Promise<number> {
  const cutoff = Date.now() - PURGE_COMPLETED_AFTER_DAYS * 86_400_000;
  const doomed: string[] = [];
  let after: string | undefined;
  while (doomed.length < 1000) {
    const body: Record<string, unknown> = { campaign: campaignId, limit: 100 };
    if (after) body.starting_after = after;
    const r = await inst(`${INSTANTLY}/leads/list`, { method: 'POST', body: JSON.stringify(body) });
    if (!r || !r.ok) break;
    const d: any = await r.json();
    for (const l of d.items || []) {
      // status 3 = finished. Never active (1), and never bounced (-1): the
      // bounce circuit breaker reads those.
      if (l.campaign !== campaignId || l.status !== 3) continue;
      const created = Date.parse(l.timestamp_created || '');
      if (Number.isFinite(created) && created < cutoff) doomed.push(l.id);
    }
    after = d.next_starting_after;
    if (!after) break;
  }
  let deleted = 0;
  for (const id of doomed) {
    if (await deleteLead(id)) deleted++;
  }
  if (deleted) logCache.delete(campaignId);
  return deleted;
}

async function ensureCampaignActive(campaignId: string): Promise<boolean> {
  // The six campaigns ship as drafts (status 0), and a campaign that runs out of
  // leads flips to completed (status 3) — new leads then sit idle. Activate
  // whenever it is not already active.
  const r = await inst(`${INSTANTLY}/campaigns/${campaignId}`);
  if (!r || !r.ok) return false;
  const c: any = await r.json();
  if (c.status === 1) return true;
  const a = await inst(`${INSTANTLY}/campaigns/${campaignId}/activate`, { method: 'POST', body: '{}' });
  return !!a && a.ok;
}

type CreateResult =
  | { outcome: 'added' }
  | { outcome: 'skipped_duplicate'; detail: string }
  | { outcome: 'failed_create'; detail: string };

async function createLead(campaignId: string, lead: LeadInput): Promise<CreateResult> {
  const r = await inst(`${INSTANTLY}/leads`, {
    method: 'POST',
    body: JSON.stringify({
      campaign: campaignId,
      email: lead.email,
      first_name: lead.firstName,
      // The job title feeds both spellings so the row works against the current
      // {{personalization}} copy and the older {{JobTitle}} copy alike.
      personalization: lead.jobTitle,
      custom_variables: { JobTitle: lead.jobTitle },
      // Instantly refuses to duplicate an address that already exists anywhere in
      // the workspace, cold campaigns included, and hands back the existing lead.
      skip_if_in_workspace: true,
    }),
  });

  if (!r) {
    const detail = 'No response from Instantly after retries (network or sustained rate limit)';
    console.error('createLead:', lead.email, detail);
    return { outcome: 'failed_create', detail };
  }

  const raw = await r.text();
  if (!r.ok) {
    // Surface what Instantly actually said. Previously this returned a bare
    // false, so the UI could only ever say "failed" with no reason and nothing
    // was recoverable from the logs either.
    let detail = `Instantly returned ${r.status}`;
    try {
      const j = JSON.parse(raw);
      const msg = j?.message || j?.error || j?.detail;
      if (msg) detail += `: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`;
    } catch {
      if (raw) detail += `: ${raw.slice(0, 200)}`;
    }
    if (r.status === 429) detail += ' (workspace rate limit, try a smaller paste)';
    console.error('createLead:', lead.email, detail);
    return { outcome: 'failed_create', detail };
  }

  // A skip comes back as HTTP 200 carrying the PRE-EXISTING lead, so "did this
  // create anything?" is answered by whether the returned record is the one we
  // just asked for: a different campaign, or a creation timestamp that predates
  // this request, means Instantly deduped rather than inserted.
  try {
    const lead2: any = JSON.parse(raw);
    const createdAt = Date.parse(lead2?.timestamp_created || '');
    const preexisting =
      (lead2?.campaign && lead2.campaign !== campaignId) ||
      (Number.isFinite(createdAt) && Date.now() - createdAt > 60_000);
    if (preexisting) {
      return {
        outcome: 'skipped_duplicate',
        detail: `${lead.email} is already in Instantly${lead2.campaign && lead2.campaign !== campaignId ? ' under another campaign' : ''}`,
      };
    }
  } catch {
    /* unparseable 200: treat as created, the lead list is the source of truth */
  }
  return { outcome: 'added' };
}

async function deleteLead(id: string): Promise<boolean> {
  const r = await inst(`${INSTANTLY}/leads/${id}`, { method: 'DELETE' });
  return !!r && r.ok;
}

async function listLeads(repKey: string): Promise<any[]> {
  const rep = REPS[repKey];

  // 1) Tally real sends per recipient — gives an accurate step number and the
  //    last-send time, which the lead record alone does not carry.
  const sentCount = new Map<string, number>();
  const lastSent = new Map<string, string>();
  let after: string | undefined;
  for (let page = 0; page < 40; page++) {
    const url = `${INSTANTLY}/emails?campaign_id=${rep.campaignId}&email_type=sent&limit=100${
      after ? `&starting_after=${encodeURIComponent(after)}` : ''
    }`;
    const r = await inst(url);
    if (!r || !r.ok) break;
    const d: any = await r.json();
    for (const e of d.items || []) {
      if (e.ue_type !== 1) continue;
      const to = ((e.to_address_email_list || '').split(',')[0] || '').trim().toLowerCase();
      if (!to) continue;
      sentCount.set(to, (sentCount.get(to) || 0) + 1);
      const ts = e.timestamp_email || e.timestamp_created || '';
      if (ts && (!lastSent.get(to) || ts > (lastSent.get(to) as string))) lastSent.set(to, ts);
    }
    after = d.next_starting_after;
    if (!after) break;
  }

  // 2) Leads.
  const out: any[] = [];
  after = undefined;
  while (out.length < 600) {
    const body: Record<string, unknown> = { campaign: rep.campaignId, limit: 100 };
    if (after) body.starting_after = after;
    const r = await inst(`${INSTANTLY}/leads/list`, { method: 'POST', body: JSON.stringify(body) });
    if (!r || !r.ok) break;
    const d: any = await r.json();
    for (const l of d.items || []) {
      if (l.campaign !== rep.campaignId) continue;
      const em = (l.email || '').toLowerCase();
      const step = Math.min(SEQUENCE_STEPS, sentCount.get(em) || 0);
      const last = lastSent.get(em) || null;

      let state: string;
      if ((l.email_reply_count || 0) > 0) state = 'replied';
      else if (l.status === -1) state = 'bounced';
      else if (l.status === 3 || step >= SEQUENCE_STEPS) state = 'done';
      else if (step === 0) state = 'queued';
      else state = 'in_sequence';

      // Next send: roughly one day after the last send (the sequence delays are
      // 1, 1, 2, 1 days), snapped into the next Mon-Fri window. Null once the
      // lead is finished, replied, or bounced.
      let nextSend: string | null = null;
      if (state === 'queued' || state === 'in_sequence') {
        const base = last ? new Date(new Date(last).getTime() + 24 * 3_600_000) : new Date();
        nextSend = nextSendingWindow(base).toISOString();
      }

      out.push({
        id: l.id,
        name: `${l.first_name || ''} ${l.last_name || ''}`.trim(),
        email: l.email,
        // Instantly accepts custom_variables on write but reads them back
        // flattened into `payload` (keys preserved verbatim, spaces and all).
        jobTitle: l.personalization || l.payload?.personalization || l.payload?.JobTitle || '',
        uploaded: l.timestamp_created || null,
        step,
        state,
        lastSent: last,
        nextSend,
      });
    }
    after = d.next_starting_after;
    if (!after) break;
  }

  out.sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
  return out;
}

// One call each for the whole team instead of one per rep. The Instantly
// workspace is capped at 20 requests/minute and the health guard shares that
// budget, so a status refresh must stay well under it.
async function fetchTeamContext(): Promise<{
  campaignStatus: Map<string, number>;
  mailboxes: Map<string, { score: number | null; limit: number | null; status: number | null }>;
}> {
  const campaignStatus = new Map<string, number>();
  const mailboxes = new Map<string, { score: number | null; limit: number | null; status: number | null }>();

  const cResp = await inst(`${INSTANTLY}/campaigns?limit=100`);
  if (cResp && cResp.ok) {
    const d: any = await cResp.json();
    for (const c of d.items || []) campaignStatus.set(c.id, c.status);
  }

  const aResp = await inst(`${INSTANTLY}/accounts?limit=100&search=${encodeURIComponent('atalntrecruiting.com')}`);
  if (aResp && aResp.ok) {
    const d: any = await aResp.json();
    for (const a of d.items || []) {
      mailboxes.set((a.email || '').toLowerCase(), {
        score: a.stat_warmup_score ?? null,
        limit: a.daily_limit ?? null,
        status: a.status ?? null,
      });
    }
  }

  return { campaignStatus, mailboxes };
}

async function repStatus(
  repKey: string,
  ctx: { campaignStatus: Map<string, number>; mailboxes: Map<string, any> }
): Promise<any> {
  const rep = REPS[repKey];
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const [aResp, dResp] = await Promise.all([
    inst(`${INSTANTLY}/campaigns/analytics?id=${rep.campaignId}`),
    inst(`${INSTANTLY}/campaigns/analytics/daily?campaign_id=${rep.campaignId}&start_date=${monthAgo}&end_date=${today}`),
  ]);

  let sentTotal = 0;
  if (aResp && aResp.ok) {
    const rows: any[] = await aResp.json();
    const row = rows.find((r) => r.campaign_id === rep.campaignId) || rows[0];
    if (row) sentTotal = row.emails_sent_count || 0;
  }

  // "In queue" used to print Instantly's leads_count, which is every record ever
  // added — bounced and finished people included. Jessica read 63 while only 51
  // were actually going to receive anything. Count the states separately instead.
  let pending = 0;
  let bounced = 0;
  let completedHere = 0;
  let addedToday = 0;
  let addedYesterday = 0;
  let added7d = 0;
  let added30d = 0;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const sevenAgo = startOfToday.getTime() - 6 * 86_400_000; // today + the 6 before it
  const thirtyAgo = startOfToday.getTime() - 29 * 86_400_000;

  // Day-by-day intake, keyed on the Central business day so it lines up with the
  // sending window rather than with UTC.
  const perDay = new Map<string, number>();
  const dayKey = (ms: number) =>
    new Date(ms).toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // en-CA gives YYYY-MM-DD

  let leadAfter: string | undefined;
  while (true) {
    const body: Record<string, unknown> = { campaign: rep.campaignId, limit: 100 };
    if (leadAfter) body.starting_after = leadAfter;
    const r = await inst(`${INSTANTLY}/leads/list`, { method: 'POST', body: JSON.stringify(body) });
    if (!r || !r.ok) break;
    const d: any = await r.json();
    for (const l of d.items || []) {
      if (l.campaign !== rep.campaignId) continue;
      if (l.status === 1) pending++;
      else if (l.status === -1) bounced++;
      else if (l.status === 3) completedHere++;
      const created = Date.parse(l.timestamp_created || '');
      if (!Number.isFinite(created)) continue;
      perDay.set(dayKey(created), (perDay.get(dayKey(created)) || 0) + 1);
      if (created >= startOfToday.getTime()) addedToday++;
      else if (created >= startOfYesterday.getTime()) addedYesterday++;
      if (created >= sevenAgo) added7d++;
      if (created >= thirtyAgo) added30d++;
    }
    leadAfter = d.next_starting_after;
    if (!leadAfter) break;
  }
  const addedByDay = [...perDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  // Totals come from the email log so they do not fall when finished leads are
  // purged. Everyone ever contacted, minus those still in flight.
  const log = await campaignLog(rep.campaignId);
  const everContacted = log.contacted.size;
  const completedTotal = Math.max(completedHere, everContacted - pending - bounced);
  const replies = log.replied.size;
  // Read status from the campaign record, not analytics: a draft campaign with
  // no leads returns no analytics row at all, which would read as "unknown"
  // exactly when the recruiter most needs to see that it is still a draft.
  const campaignStatus = ctx.campaignStatus.get(rep.campaignId) ?? null;

  let sentToday = 0;
  let sentWeek = 0;
  let sentMonth = 0;
  const days: { date: string; sent: number; replies: number }[] = [];
  if (dResp && dResp.ok) {
    const rows: any[] = await dResp.json();
    for (const d of rows) {
      const date = (d.date || '').slice(0, 10);
      if (!date) continue;
      const sent = d.sent || 0;
      days.push({ date, sent, replies: d.replies || 0 });
      sentMonth += sent;
      if (date >= weekAgo) sentWeek += sent;
      if (date === today) sentToday += sent;
    }
    days.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // Mailbox health, so a recruiter can see why nothing is going out.
  const mb = ctx.mailboxes.get(rep.email.toLowerCase()) || {};

  return {
    rep: repKey,
    name: rep.name,
    email: rep.email,
    queued: pending,
    bounced,
    completedTotal,
    everContacted,
    addedToday,
    addedYesterday,
    added7d,
    added30d,
    addedByDay,
    replies,
    sentTotal,
    sentToday,
    sentWeek,
    sentMonth,
    days: days.slice(0, 14),
    dailyCap: DAILY_CAP,
    campaignStatus,
    mailboxScore: mb.score ?? null,
    mailboxLimit: mb.limit ?? null,
    mailboxStatus: mb.status ?? null,
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyDashboardToken(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.INSTANTLY_API_KEY) return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });

  try {
    if (req.method === 'GET') {
      const action = (req.query?.action as string) || 'status';

      if (action === 'reps') {
        return res.status(200).json({
          reps: Object.entries(REPS).map(([key, r]) => ({ key, name: r.name, email: r.email })),
        });
      }

      if (action === 'status') {
        const ctx = await fetchTeamContext();
        const reps = await Promise.all(Object.keys(REPS).map((k) => repStatus(k, ctx)));
        return res.status(200).json({ reps });
      }

      if (action === 'readiness') {
        const keys = Object.keys(REPS);
        const rows = [];
        for (const k of keys) {
          const req2 = await campaignRequirements(REPS[k].campaignId);
          rows.push({ rep: k, name: REPS[k].name, ...req2 });
        }
        return res.status(200).json({ reps: rows });
      }

      if (action === 'list') {
        const repKey = ((req.query?.rep as string) || '').toLowerCase();
        if (!REPS[repKey]) return res.status(400).json({ error: 'rep required' });
        return res.status(200).json({ rep: repKey, leads: await listLeads(repKey) });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, leads, id } = (req.body || {}) as { action?: string; leads?: LeadInput[]; id?: string };

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const ok = await deleteLead(id);
      return res.status(ok ? 200 : 500).json({ deleted: ok, id });
    }

    if (action === 'purge') {
      // Housekeeping: drop finished leads older than the intake window so the
      // queue stays honest without the "added" counters losing their history.
      const purged: Record<string, number> = {};
      for (const k of Object.keys(REPS)) purged[k] = await purgeCompleted(REPS[k].campaignId);
      return res.status(200).json({ purged, olderThanDays: PURGE_COMPLETED_AFTER_DAYS });
    }

    if (action !== 'add') return res.status(400).json({ error: 'Unknown action' });
    if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: 'leads required' });
    if (leads.length > MAX_LEADS_PER_REQUEST) {
      return res.status(400).json({ error: `max ${MAX_LEADS_PER_REQUEST} leads per request; chunk the paste` });
    }

    // Check each campaign in this batch ONCE, before creating anything. A
    // campaign whose sequence still needs fields the paste cannot supply is
    // refused outright rather than fed leads that would send broken emails.
    const repsInBatch = [...new Set(leads.map((l) => (l.rep || '').toLowerCase()))];
    const gate = new Map<string, { ready: boolean; missing: string[]; readError?: string }>();
    for (const k of repsInBatch) {
      if (!REPS[k]) continue;
      gate.set(k, await campaignRequirements(REPS[k].campaignId));
    }

    const activated = new Set<string>();
    const results: any[] = [];
    // A candidate with several addresses on file becomes one lead per address,
    // so the same address can legitimately appear twice in one paste. Track what
    // this request already created: existsInAccount would not see a lead made a
    // moment ago within the same batch.
    const createdThisRequest = new Set<string>();

    // Sequential: the workspace is capped at 20 Instantly requests/minute and the
    // health guard spends from the same budget. One create per lead now, paced
    // below, so a big paste degrades into "slower" rather than "failed".
    let createsIssued = 0;
    for (const raw of leads) {
      const repKey = (raw.rep || '').toLowerCase();
      const repCfg = REPS[repKey];
      const lead: LeadInput = {
        rep: repKey,
        firstName: cleanValue(raw.firstName),
        email: cleanValue(raw.email),
        jobTitle: cleanValue(raw.jobTitle),
      };

      if (!repCfg) {
        results.push({ email: lead.email, rep: raw.rep, outcome: 'skipped_unknown_recruiter' });
        continue;
      }
      const g = gate.get(repKey);
      if (!g || !g.ready) {
        results.push({
          email: lead.email,
          rep: repKey,
          outcome: 'skipped_campaign_not_ready',
          detail: g?.readError || `${repCfg.name}'s sequence still needs ${(g?.missing || []).join(', ')}`,
        });
        continue;
      }
      if (!lead.email || !EMAIL_RE.test(lead.email)) {
        results.push({ email: lead.email, rep: repKey, outcome: 'skipped_bad_email' });
        continue;
      }
      if (!lead.firstName) {
        results.push({ email: lead.email, rep: repKey, outcome: 'skipped_no_first_name' });
        continue;
      }
      if (!lead.jobTitle) {
        results.push({ email: lead.email, rep: repKey, outcome: 'skipped_no_job_title' });
        continue;
      }
      // Within-request guard only. Cross-request and cross-campaign dedupe is
      // Instantly's job now (skip_if_in_workspace), which costs no extra call.
      const emailKey = lead.email.toLowerCase();
      if (createdThisRequest.has(emailKey)) {
        results.push({ email: lead.email, rep: repKey, outcome: 'skipped_duplicate' });
        continue;
      }

      // Verify before creating. A bounced lead costs mailbox reputation, and
      // reputation is the whole asset here.
      const v = await verifyEmail(lead.email);
      if (!v.ok) {
        results.push({
          email: lead.email,
          rep: repKey,
          outcome: 'skipped_unverified',
          verifyStatus: v.status,
          detail: `${lead.email} did not pass verification (${v.status})`,
        });
        continue;
      }

      if (!activated.has(repKey)) {
        if (!(await ensureCampaignActive(repCfg.campaignId))) {
          results.push({ email: lead.email, rep: repKey, outcome: 'failed_activate' });
          continue;
        }
        activated.add(repKey);
      }

      // Pace the creates. The guard shares the 20/min budget, so going flat out
      // is what produced the unexplained failures; a short gap keeps a full paste
      // comfortably inside the cap.
      if (createsIssued > 0) await new Promise((s) => setTimeout(s, CREATE_SPACING_MS));
      createsIssued++;

      const created = await createLead(repCfg.campaignId, lead);
      if (created.outcome === 'added') createdThisRequest.add(emailKey);
      results.push({ email: lead.email, rep: repKey, verifyStatus: v.status, ...created });
    }

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error('Sourcing dialer error:', err?.message, err?.stack);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
