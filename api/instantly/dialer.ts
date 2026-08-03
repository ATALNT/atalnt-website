// ============================================
// /api/instantly/dialer  (dashboard auth required)
//
// Sourcing/ops dial companion. The six recruiters paste the candidates they have
// called and left voicemails for; each candidate is created as a lead in that
// recruiter's own ISOLATED: Instantly campaign and receives the 4-email sequence
// the team already wrote, sent from that recruiter's own mailbox (30/day, stops
// on reply).
//
// The sequence copy lives in Instantly and is NEVER touched from here. This
// endpoint only supplies the merge-field values the copy expects:
//   {{JobTitle}} {{Bullet 1}} {{Bullet 2}} {{Bullet 3}}
//   {{Unique Selling Point}} {{Specific Experience}}
// {{firstName}} and {{sendingAccountName}} are filled by Instantly itself.
//
// GET  ?action=status                  -> per-rep queue + send stats
// GET  ?action=list&rep=<key>          -> that rep's leads with step/state
// POST { action:'add', rep, job, leads:[...] }   (max 25 leads per request)
// POST { action:'delete', id }
//
// Safety rails carried over from the sales dialer:
//  - every merge value validated non-empty before a lead is created, so the
//    sequence can never send with a raw "{{Bullet 2}}" in the body
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

const DAILY_CAP = 30;
const SEQUENCE_STEPS = 4;
const MAX_LEADS_PER_REQUEST = 25;

// Sending window — must match the campaign_schedule on all six campaigns
// (Asia/Kolkata, 09:00-17:00, Mon-Fri). Used only to estimate "next email".
const TIMEZONE = 'Asia/Kolkata';
const WINDOW_START = 9;
const WINDOW_END = 17;

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface LeadInput {
  firstName: string;
  lastName?: string;
  email: string;
  company?: string;
  title?: string;
  specificExperience?: string;
}

interface JobInput {
  jobTitle: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  usp: string;
  specificExperience: string;
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

// ── Merge values ────────────────────────────────────────────────────────────
// The campaign copy is fixed, so an empty value would render a literal
// "{{Bullet 2}}" to a candidate. Everything is validated before a lead exists.
function cleanValue(raw: string | undefined): string {
  return (raw || '').replace(/\s+/g, ' ').trim();
}

function validateJob(job: Partial<JobInput> | undefined): { ok: true; job: JobInput } | { ok: false; missing: string[] } {
  const fields: { key: keyof JobInput; label: string }[] = [
    { key: 'jobTitle', label: 'Job title' },
    { key: 'bullet1', label: 'Bullet 1' },
    { key: 'bullet2', label: 'Bullet 2' },
    { key: 'bullet3', label: 'Bullet 3' },
    { key: 'usp', label: 'Unique selling point' },
    { key: 'specificExperience', label: 'Specific experience' },
  ];
  const out = {} as JobInput;
  const missing: string[] = [];
  for (const f of fields) {
    const v = cleanValue(job?.[f.key]);
    if (!v) missing.push(f.label);
    out[f.key] = v;
  }
  return missing.length ? { ok: false, missing } : { ok: true, job: out };
}

// ── Sending-window estimate ─────────────────────────────────────────────────
// Next Mon-Fri 09:00-17:00 in the campaign timezone, at or after `from`.
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
    // Past the window (or a weekend): jump to the next day's window start.
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

async function createLead(campaignId: string, lead: LeadInput, job: JobInput): Promise<boolean> {
  // Custom-variable keys must match the campaign copy EXACTLY, spaces included.
  const r = await inst(`${INSTANTLY}/leads`, {
    method: 'POST',
    body: JSON.stringify({
      campaign: campaignId,
      email: lead.email,
      first_name: lead.firstName,
      last_name: lead.lastName || '',
      company_name: lead.company || '',
      custom_variables: {
        JobTitle: job.jobTitle,
        'Bullet 1': job.bullet1,
        'Bullet 2': job.bullet2,
        'Bullet 3': job.bullet3,
        'Unique Selling Point': job.usp,
        'Specific Experience': cleanValue(lead.specificExperience) || job.specificExperience,
      },
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
        company: l.company_name || '',
        // Instantly accepts custom_variables on write but reads them back
        // flattened into `payload` (keys preserved verbatim, spaces and all).
        jobTitle: l.payload?.JobTitle || '',
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
  const mailboxScore: number | null = mb.score ?? null;
  const mailboxLimit: number | null = mb.limit ?? null;
  const mailboxStatus: number | null = mb.status ?? null;

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
    mailboxScore,
    mailboxLimit,
    mailboxStatus,
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

      if (action === 'list') {
        const repKey = ((req.query?.rep as string) || '').toLowerCase();
        if (!REPS[repKey]) return res.status(400).json({ error: 'rep required' });
        return res.status(200).json({ rep: repKey, leads: await listLeads(repKey) });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, rep, job, leads, id } = (req.body || {}) as {
      action?: string;
      rep?: string;
      job?: Partial<JobInput>;
      leads?: LeadInput[];
      id?: string;
    };

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const ok = await deleteLead(id);
      return res.status(ok ? 200 : 500).json({ deleted: ok, id });
    }

    if (action !== 'add') return res.status(400).json({ error: 'Unknown action' });

    const repCfg = REPS[(rep || '').toLowerCase()];
    if (!repCfg) return res.status(400).json({ error: `rep must be one of: ${Object.keys(REPS).join(', ')}` });

    const validated = validateJob(job);
    if (!validated.ok) {
      return res.status(400).json({ error: `Missing job details: ${validated.missing.join(', ')}` });
    }
    if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: 'leads required' });
    if (leads.length > MAX_LEADS_PER_REQUEST) {
      return res.status(400).json({ error: `max ${MAX_LEADS_PER_REQUEST} leads per request; chunk the paste` });
    }

    const activated = await ensureCampaignActive(repCfg.campaignId);
    if (!activated) {
      return res.status(502).json({ error: `Could not activate ${repCfg.name}'s campaign in Instantly; nothing was queued.` });
    }

    // Sequential: the workspace is capped at 20 Instantly requests/minute and each
    // lead costs a dedupe check plus a create. Parallelising here trips the cap.
    const results: any[] = [];
    for (const raw of leads) {
      const lead: LeadInput = {
        firstName: cleanValue(raw.firstName),
        lastName: cleanValue(raw.lastName),
        email: cleanValue(raw.email),
        company: cleanValue(raw.company),
        title: cleanValue(raw.title),
        specificExperience: cleanValue(raw.specificExperience),
      };
      if (!lead.email || !EMAIL_RE.test(lead.email)) {
        results.push({ email: lead.email, outcome: 'skipped_bad_email' });
        continue;
      }
      if (!lead.firstName) {
        results.push({ email: lead.email, outcome: 'skipped_no_first_name' });
        continue;
      }
      if (await existsInAccount(lead.email)) {
        results.push({ email: lead.email, outcome: 'skipped_duplicate' });
        continue;
      }
      const created = await createLead(repCfg.campaignId, lead, validated.job);
      results.push({ email: lead.email, outcome: created ? 'added' : 'failed_create' });
    }

    return res.status(200).json({ rep, results });
  } catch (err: any) {
    console.error('Sourcing dialer error:', err?.message, err?.stack);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
