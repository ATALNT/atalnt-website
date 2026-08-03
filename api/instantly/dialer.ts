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

// Sending window — must match the campaign_schedule on the six campaigns
// (Asia/Kolkata, 09:00-17:00, Mon-Fri). Used only to estimate "next email".
const TIMEZONE = 'Asia/Kolkata';
const WINDOW_START = 9;
const WINDOW_END = 17;

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
        await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
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
async function existsInAccount(email: string): Promise<boolean> {
  const r = await inst(`${INSTANTLY}/leads/list`, {
    method: 'POST',
    body: JSON.stringify({ search: email, limit: 10 }),
  });
  if (!r || !r.ok) return false; // fail open: the check is best effort
  const d: any = await r.json();
  return (d.items || []).some((l: any) => (l.email || '').toLowerCase() === email.toLowerCase());
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

async function createLead(campaignId: string, lead: LeadInput): Promise<boolean> {
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
    }),
  });
  return !!r && r.ok;
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

  let queued = 0;
  let replies = 0;
  let sentTotal = 0;
  if (aResp && aResp.ok) {
    const rows: any[] = await aResp.json();
    const row = rows.find((r) => r.campaign_id === rep.campaignId) || rows[0];
    if (row) {
      queued = row.leads_count || 0;
      replies = row.replies_count ?? row.reply_count ?? 0;
      sentTotal = row.emails_sent_count || 0;
    }
  }
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
    queued,
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

    // Sequential: the workspace is capped at 20 Instantly requests/minute and
    // each lead costs a dedupe check plus a create. Parallelising trips the cap.
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
      const emailKey = lead.email.toLowerCase();
      if (createdThisRequest.has(emailKey) || (await existsInAccount(lead.email))) {
        results.push({ email: lead.email, rep: repKey, outcome: 'skipped_duplicate' });
        continue;
      }

      if (!activated.has(repKey)) {
        if (!(await ensureCampaignActive(repCfg.campaignId))) {
          results.push({ email: lead.email, rep: repKey, outcome: 'failed_activate' });
          continue;
        }
        activated.add(repKey);
      }

      const created = await createLead(repCfg.campaignId, lead);
      if (created) createdThisRequest.add(emailKey);
      results.push({ email: lead.email, rep: repKey, outcome: created ? 'added' : 'failed_create' });
    }

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error('Sourcing dialer error:', err?.message, err?.stack);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
