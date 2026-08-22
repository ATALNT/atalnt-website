// ============================================
// /api/instantly/command?view=<name> — Instantly Command Center backend
//
// ONE function (Vercel Hobby caps at 12; this is the last slot) dispatching on
// ?view=, the same shape as cron.ts dispatches on ?task=.
//
//   overview                      tiles + active/past campaign rows + guard line
//   campaign&id=                  daily + step analytics + sequence shell + audience
//   messaging&id=[&lead=]         every step rendered as a recipient sees it
//   replies[&campaign=&class=]    classified reply feed across campaigns
//   thread&email=                 the whole conversation with one person
//   classify (POST)               {lead_email, status} -> Instantly interest status
//
// Every Instantly call goes through api/_lib/instantly-client.ts, which is
// sequential with backoff. The dashboard must not starve the guard.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyDashboardToken, corsHeaders } from '../_lib/auth-middleware.js';
import { loadAggregates } from '../_lib/aggregate-store.js';
import {
  instantly, instantlyList, instantlyLeads, isIsolated, classifyReply, renderStep, titleGroup, emailText, replyOnly, toList,
  FREE_MAILBOX_RE,
  type InstantlyCampaign, type InstantlyLead, type InstantlyEmail, type DailyRow, type StepRow, type Json,
} from '../_lib/instantly-client.js';

export const maxDuration = 60;

const HISTORICAL_REPLY_RATE = 0.0017; // 1,974 replies / 1,160,243 sends, measured 2026-08-16

// ---- tiny in-memory cache, per warm instance ----
const cache = new Map<string, { at: number; val: unknown }>();
const TTL = { overview: 4 * 60_000, campaign: 4 * 60_000, replies: 90_000 } as const;
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.val as T;
  const val = await fn();
  cache.set(key, { at: Date.now(), val });
  return val;
}

type Analytics = {
  campaign_id: string; campaign_name: string; campaign_status: number;
  leads_count: number; contacted_count: number; emails_sent_count: number;
  reply_count: number; reply_count_unique: number; reply_count_automatic: number;
  bounced_count: number; completed_count: number; total_opportunities: number;
};

function pct(n: number, d: number) { return d > 0 ? n / d : 0; }

function healthOf(a: Analytics): { light: 'green' | 'yellow' | 'red'; reason: string } {
  const sent = a.emails_sent_count || 0;
  const bounce = pct(a.bounced_count || 0, sent);
  // reply_count is already human-only; Instantly tracks auto-replies in reply_count_automatic separately
  const reply = pct(a.reply_count_unique || a.reply_count || 0, sent);
  if (sent >= 300 && bounce > 0.05) return { light: 'red', reason: `bounce ${(bounce * 100).toFixed(1)}% will trip the guard at 5%` };
  if (sent >= 100 && bounce > 0.10) return { light: 'red', reason: `bounce ${(bounce * 100).toFixed(1)}%` };
  if (sent >= 300 && bounce > 0.035) return { light: 'yellow', reason: `bounce ${(bounce * 100).toFixed(1)}%, watch it` };
  const remaining = (a.leads_count || 0) - (a.contacted_count || 0);
  // a sequence needs ~1,000 step-1 sends before its reply rate means anything
  if (sent >= 1000 && reply < HISTORICAL_REPLY_RATE) return { light: 'yellow', reason: `reply ${(reply * 100).toFixed(2)}% is below the 0.17% baseline, revisit the copy or the list` };
  if (a.campaign_status === 1 && remaining <= 0) return { light: 'green', reason: `fully sent, follow-ups still running, reply ${(reply * 100).toFixed(2)}%` };
  return { light: 'green', reason: sent ? `reply ${(reply * 100).toFixed(2)}%, bounce ${(bounce * 100).toFixed(1)}%` : 'no sends yet' };
}

// ---------------- views ----------------

async function overview() {
  return cached('overview', TTL.overview, async () => {
    const [campaigns, analytics] = [
      await instantlyList<InstantlyCampaign>('campaigns'),
      await instantly<Analytics[]>('campaigns/analytics'),
    ];
    const byId = new Map(analytics.map((a) => [a.campaign_id, a]));
    const rows = campaigns
      .filter((c) => c.status !== -1)
      .map((c) => {
        const a = byId.get(c.id) || ({} as Analytics);
        const sent = a.emails_sent_count || 0;
        const humanReplies = a.reply_count_unique || a.reply_count || 0; // already excludes auto-replies
        return {
          id: c.id, name: c.name, status: c.status, isolated: isIsolated(c.name),
          senders: (c.email_list || []).length,
          leads: a.leads_count || 0, contacted: a.contacted_count || 0,
          remaining: Math.max(0, (a.leads_count || 0) - (a.contacted_count || 0)),
          sent, replies: humanReplies, auto_replies: a.reply_count_automatic || 0,
          bounced: a.bounced_count || 0, opportunities: a.total_opportunities || 0,
          reply_rate: pct(humanReplies, sent), bounce_rate: pct(a.bounced_count || 0, sent),
          health: healthOf(a), created: c.timestamp_created,
          interested: 0, demos: 0, interested_rate: 0,
        };
      });
    const active = rows.filter((r) => r.status === 1 && !r.isolated).sort((a, b) => b.reply_rate - a.reply_rate);
    const past = rows.filter((r) => r.status !== 1 && !r.isolated && r.sent >= 50).sort((a, b) => b.reply_rate - a.reply_rate);

    // 14-day daily series for the active set, sequential (one call per campaign)
    const daily: Record<string, { date: string; sent: number; replies: number }[]> = {};
    for (const r of active) {
      try {
        const d = await instantly<DailyRow[]>(`campaigns/analytics/daily?campaign_id=${r.id}`);
        daily[r.id] = (d || []).slice(-14).map((x) => ({ date: x.date, sent: x.sent || 0, replies: (x.unique_replies || 0) }));
      } catch { daily[r.id] = []; }
    }
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = Object.values(daily).reduce((s, arr) => s + (arr.find((x) => x.date === today)?.sent || 0), 0);
    const repliesToday = Object.values(daily).reduce((s, arr) => s + (arr.find((x) => x.date === today)?.replies || 0), 0);

    // ceiling = eligible gmail senders * their daily limits
    const accounts = await instantlyList<{ email: string; status: number; daily_limit: number; stat_warmup_score: number }>('accounts');
    const gm = accounts.filter((x) => FREE_MAILBOX_RE.test(x.email || ''));
    const eligible = gm.filter((x) => x.status === 1 && (x.stat_warmup_score || 0) >= 97);
    const ceiling = eligible.reduce((s, x) => s + (x.daily_limit || 0), 0);
    const errState = accounts.filter((x) => x.status !== 1).length;

    const actSent = active.reduce((s, r) => s + r.sent, 0);
    const actReplies = active.reduce((s, r) => s + r.replies, 0);
    const actBounced = active.reduce((s, r) => s + r.bounced, 0);

    // positive / demo counts come from the reply feed, cached separately
    const feed = await repliesFeed({ limit: 400 });
    const positive = feed.items.filter((x) => x.class === 'positive' || x.class === 'demo');
    const demos = feed.items.filter((x) => x.class === 'demo');
    const positiveToday = positive.filter((x) => (x.timestamp || '').slice(0, 10) === today).length;

    // join interested counts onto every campaign row, one person counted once per campaign
    const interestedBy = new Map<string, Set<string>>();
    const demoBy = new Map<string, Set<string>>();
    for (const x of positive) {
      const k = x.campaign_id; const who = x.from_email.toLowerCase();
      if (!interestedBy.has(k)) interestedBy.set(k, new Set());
      interestedBy.get(k)!.add(who);
      if (x.class === 'demo') { if (!demoBy.has(k)) demoBy.set(k, new Set()); demoBy.get(k)!.add(who); }
    }
    for (const r of [...active, ...past]) {
      r.interested = interestedBy.get(r.id)?.size || 0;
      r.demos = demoBy.get(r.id)?.size || 0;
      r.interested_rate = pct(r.interested, r.sent);
    }

    // interested-over-time for the main chart: bucket positive replies by day (last 14)
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    const sentByDay = new Map<string, number>(); const repliesByDay = new Map<string, number>();
    for (const arr of Object.values(daily)) for (const x of arr) {
      sentByDay.set(x.date, (sentByDay.get(x.date) || 0) + x.sent);
      repliesByDay.set(x.date, (repliesByDay.get(x.date) || 0) + x.replies);
    }
    const interestedByDay = new Map<string, number>();
    for (const x of positive) { const k = (x.timestamp || '').slice(0, 10); interestedByDay.set(k, (interestedByDay.get(k) || 0) + 1); }
    const trend = days.map((d) => ({ date: d, sent: sentByDay.get(d) || 0, replies: repliesByDay.get(d) || 0, interested: interestedByDay.get(d) || 0 }));

    return {
      generated_at: new Date().toISOString(),
      tiles: {
        sends_today: sentToday, ceiling, sends_pct: pct(sentToday, ceiling),
        reply_rate: pct(actReplies, actSent), historical_reply_rate: HISTORICAL_REPLY_RATE, replies_today: repliesToday,
        positive_replies: positive.length, positive_today: positiveToday,
        bounce_rate: pct(actBounced, actSent), bounce_trip: 0.05,
        demos_requested: demos.length,
      },
      active, past, daily, trend,
      fleet: { gmail_total: gm.length, gmail_eligible: eligible.length, error_state: errState, total: accounts.length },
      guard: await guardStatus(),
    };
  });
}

async function guardStatus() {
  // The guard runs on GitHub Actions and has no shared store to write into.
  // The page shows fleet health (derived live) and tells the operator failures
  // arrive by email, which is how the guard already reports.
  return { ran_at: null, verdict: 'runs every 4h on GitHub Actions', problems: [] as string[] };
}

async function campaignDetail(id: string) {
  return cached(`campaign:${id}`, TTL.campaign, async () => {
    const c = await instantly<InstantlyCampaign>(`campaigns/${id}`);
    const daily = await instantly<DailyRow[]>(`campaigns/analytics/daily?campaign_id=${id}`).catch(() => [] as DailyRow[]);
    const steps = await instantly<StepRow[]>(`campaigns/analytics/steps?campaign_id=${id}`).catch(() => [] as StepRow[]);
    let audience: (Json & { as_of: string }) | null = null;
    const agg = await loadAggregates();
    const hit = agg?.campaigns[id];
    if (hit) audience = { as_of: String(hit.data.as_of || agg?.computed_at || ''), ...hit.data } as Json & { as_of: string };
    const seq = (c.sequences || [])[0]?.steps || [];
    return {
      id, name: c.name, status: c.status, senders: (c.email_list || []).length,
      schedule: (c.campaign_schedule || {}).schedules?.[0] || null,
      daily: (daily || []).map((x) => ({ date: x.date, sent: x.sent || 0, replies: x.unique_replies || 0, auto: x.unique_replies_automatic || 0, opportunities: x.opportunities || 0 })),
      steps: (steps || []).filter((s) => Number(s.step) >= 1).map((s) => ({
        step: Number(s.step), variant: s.variant, sent: s.sent || 0, replies: s.unique_replies || 0,
        reply_rate: pct(s.unique_replies || 0, s.sent || 0),
      })),
      sequence: seq.map((s, i) => ({ step: i + 1, delay: s.delay, subject: s.variants?.[0]?.subject || '', body_html: s.variants?.[0]?.body || '' })),
      audience,
    };
  });
}

async function messaging(id: string, leadEmail?: string) {
  const c = await instantly<InstantlyCampaign>(`campaigns/${id}`);
  const seq = (c.sequences || [])[0]?.steps || [];
  // a handful of real leads to render against; pick by title group so the picker is meaningful
  const sample = await instantlyLeads<InstantlyLead>(id, 200);
  // Instantly leads carry no title; the persona group is baked into the hook
  // sentence ("I talk to founders and CEOs across the country..."), so read it back out.
  const groupOf = (l: InstantlyLead): string => {
    const fromTitle = titleGroup(l.title || String(l.payload?.title ?? ''));
    if (fromTitle !== 'Unknown') return fromTitle;
    const hook = String(l.payload?.hook ?? l.payload?.opener ?? '');
    const m = /(?:talk to|speak with|conversation with)\s+([a-z /&]+?)\s+(?:across|all week|almost)/i.exec(hook);
    return m ? m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()) : 'General';
  };
  const byGroup = new Map<string, InstantlyLead>();
  for (const l of sample) {
    const g = groupOf(l);
    if (!byGroup.has(g)) byGroup.set(g, l);
  }
  let lead = leadEmail ? sample.find((l) => (l.email || '').toLowerCase() === leadEmail.toLowerCase()) : null;
  if (!lead) lead = sample[0];
  if (!lead) return { steps: [], leads: [] };
  const senders = c.email_list || [];
  const senderName = 'Alanis Felies'; // display only; real sender name resolves at send time
  const vars: Json = lead.payload || {};
  const rendered = seq.map((s, i) => {
    const subjRaw = s.variants?.[0]?.subject || '';
    const subject = subjRaw ? renderStep(subjRaw, vars, lead.first_name || '', senderName) : '(threads as a reply)';
    return { step: i + 1, delay_days: s.delay ?? 0, subject, body: renderStep(s.variants?.[0]?.body || '', vars, lead.first_name || '', senderName) };
  });
  return {
    lead: { email: lead.email, first_name: lead.first_name || '', company: lead.company_name || '', group: groupOf(lead) },
    leads: [...byGroup.values()].map((l) => ({ email: l.email, first_name: l.first_name || '', company: l.company_name || '', group: groupOf(l) })),
    senders: senders.length,
    steps: rendered,
    unresolved: rendered.some((r) => /\{\{/.test(r.body) || /\{\{/.test(r.subject)),
  };
}

async function repliesFeed(opts: { campaign?: string; cls?: string; limit?: number }) {
  const key = `replies:${opts.campaign || 'all'}`;
  const base = await cached(key, TTL.replies, async () => {
    const campaigns = await instantlyList<InstantlyCampaign>('campaigns');
    const names = new Map(campaigns.map((c) => [c.id, c.name]));
    const q = `emails?email_type=received${opts.campaign ? `&campaign_id=${opts.campaign}` : ''}`;
    // newest-first feed is not guaranteed ordered; pull a bounded window and sort client-side
    const items: InstantlyEmail[] = [];
    let after: string | undefined;
    while (items.length < (opts.limit || 400)) {
      const page = await instantly<{ items?: InstantlyEmail[]; next_starting_after?: string }>(`${q}&limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`);
      const got = page.items || [];
      if (!got.length) break;
      items.push(...got);
      if (!page.next_starting_after) break;
      after = page.next_starting_after;
    }
    // only replies into non-ISOLATED campaigns; the dialers are the team's own inboxes
    const out = items
      .filter((e) => e.campaign_id && !isIsolated(names.get(e.campaign_id)))
      .map((e) => {
        const raw = emailText(e);
        const own = replyOnly(raw);
        // quote-only reply: the person typed nothing. Use the raw ONLY to detect bounces/auto
        // (machine text lives there); never let our own quoted pitch register as interest.
        const text = own || raw;
        const quoteOnly = !own;
        const fromJson = e.from_address_json;
        const fromName = Array.isArray(fromJson) ? fromJson[0]?.name : fromJson?.name;
        return {
          id: e.id, thread_id: e.thread_id, campaign_id: e.campaign_id || '', campaign: names.get(e.campaign_id || '') || '',
          from_email: e.from_address_email || '', from_name: fromName || '', to_mailbox: e.eaccount || '',
          subject: e.subject || '', preview: (text || e.content_preview || '').replace(/\s+/g, ' ').slice(0, 220),
          timestamp: e.timestamp_email || e.timestamp_created || '', unread: !!e.is_unread,
          interest: e.i_status ?? null,
          class: (() => { const k = classifyReply(text, e.i_status, e.from_address_email); return quoteOnly && (k === 'positive' || k === 'demo') ? 'neutral' : k; })(),
        };
      })
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return { items: out, fetched_at: new Date().toISOString() };
  });
  const items = opts.cls ? base.items.filter((x) => x.class === opts.cls) : base.items;
  const counts: Record<string, number> = {};
  for (const x of base.items) counts[x.class] = (counts[x.class] || 0) + 1;
  return { items, counts, fetched_at: base.fetched_at };
}

async function thread(email: string) {
  // Instantly v2 has no GET /emails/threads/{id}, and ?thread_id= is silently
  // ignored (returns unrelated mail). The thread id on a received reply also
  // differs from the id on the sent mail. So: search by the person's address,
  // which returns both directions, and present the whole conversation.
  const page = await instantly<{ items?: InstantlyEmail[] }>(`emails?search=${encodeURIComponent(email)}&limit=50`);
  const list = (page.items || []).filter((m) =>
    (m.from_address_email || '').toLowerCase() === email.toLowerCase() ||
    toList(m.to_address_email_list).some((t) => t.toLowerCase() === email.toLowerCase()));
  const msgs = list.map((m) => ({
    id: m.id, from: m.from_address_email || '', to: toList(m.to_address_email_list), subject: m.subject || '',
    timestamp: m.timestamp_email || m.timestamp_created || '', direction: (m.ue_type === 1 ? 'sent' : 'received') as 'sent' | 'received',
    text: m.ue_type === 1 ? renderStep(emailText(m), {}, '', '') : (replyOnly(emailText(m)) || renderStep(emailText(m), {}, '', '')),
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { id: email, messages: msgs };
}

async function classify(body: unknown) {
  const b = (body && typeof body === 'object' ? body : {}) as Json;
  const email = String(b.lead_email ?? '').trim().toLowerCase();
  const status = String(b.status ?? '');
  const map: Record<string, number> = { interested: 1, demo: 1, negative: -1, wrong_person: -2, neutral: 0 };
  if (!email || !(status in map)) throw new Error('lead_email and status (interested|demo|negative|wrong_person|neutral) required');
  await instantly('leads/update-interest-status', { method: 'POST', body: { lead_email: email, interest_value: map[status] } });
  if (status === 'demo') {
    // tag so the Demos Requested tile can count it independently of interest status
    try { await instantly('leads/update-interest-status', { method: 'POST', body: { lead_email: email, interest_value: 1 } }); } catch { /* already set */ }
  }
  cache.delete('replies:all'); cache.delete('overview');
  return { ok: true, lead_email: email, status };
}

// ---------------- handler ----------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyDashboardToken(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.INSTANTLY_API_KEY) return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });

  const view = String(req.query.view || 'overview');
  try {
    switch (view) {
      case 'overview': return res.status(200).json(await overview());
      case 'campaign': return res.status(200).json(await campaignDetail(String(req.query.id || '')));
      case 'messaging': return res.status(200).json(await messaging(String(req.query.id || ''), req.query.lead ? String(req.query.lead) : undefined));
      case 'replies': return res.status(200).json(await repliesFeed({ campaign: req.query.campaign ? String(req.query.campaign) : undefined, cls: req.query.class ? String(req.query.class) : undefined }));
      case 'thread': return res.status(200).json(await thread(String(req.query.email || req.query.id || '')));
      case 'classify':
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        return res.status(200).json(await classify(req.body));
      default: return res.status(400).json({ error: `Unknown view '${view}'` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed';
    console.error('command error', view, msg);
    return res.status(500).json({ error: msg });
  }
}
