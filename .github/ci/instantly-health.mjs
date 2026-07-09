#!/usr/bin/env node
// ============================================
// Instantly Health Guard — runs on GitHub Actions every ~20 minutes, 24/7.
// (.github/workflows/instantly-health.yml — independent of Vercel plan limits,
// laptops, and bot checkpoints: talks straight to the Instantly API.)
//
// SETTLED FACTS (2026-07-09, empirical):
//   - daily_limit:0 does NOT stop campaign sends (accounts at 0 sent 22-30/day).
//   - Pausing an account stops its warmup (paused accounts show 0 warmup emails).
//   - A campaign can ONLY send from mailboxes in its email_list — BUT removing a
//     mailbox does not cancel its already-queued sends; a campaign pause->activate
//     cycle is required to rebuild the queue (also proven 2026-07-09).
//
// WHAT THIS DOES, in order:
//   1. health >= 97 -> daily_limit 20 ; health <= 96 -> daily_limit 0 (belt only)
//   2. Nothing stays paused (limit set BEFORE resume, so no send window)
//   3. Every ACTIVE campaign's email_list = healthy (97+) mailboxes only,
//      verified by fresh GET after every write.
//   4. AUDIT REALITY: count actual sent emails (ue_type=1) per mailbox over the
//      last AUDIT_WINDOW_MIN minutes. If ANY sub-97 mailbox sent ANYTHING, exit 1
//      -> the workflow fails -> GitHub emails the repo owner. Settings lie; sends don't.
// ============================================

const KEY = process.env.INSTANTLY_API_KEY;
if (!KEY) { console.error('INSTANTLY_API_KEY missing'); process.exit(2); }
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'atalnt-health-guard' };
const MIN_SCORE = 97;
const DAILY_LIMIT = 20;
const AUDIT_WINDOW_MIN = Number(process.env.AUDIT_WINDOW_MIN || 75);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, opts = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H, ...opts });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue; }
      return r;
    } catch { await sleep(1500 * (i + 1)); }
  }
  return null;
}

async function fetchAll(base) {
  const out = [];
  let after;
  while (true) {
    const url = `${base}${base.includes('?') ? '&' : '?'}limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`;
    const r = await req(url);
    if (!r || !r.ok) break;
    const d = await r.json();
    out.push(...(d.items || []));
    if (d.next_starting_after) after = d.next_starting_after; else break;
  }
  return out;
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

const problems = [];
const log = (m) => console.log(m);

// ---- 1+2: accounts: limits belt + never paused ----
const accounts = await fetchAll('https://api.instantly.ai/api/v2/accounts');
if (accounts.length < 600) { console.error(`account fetch suspicious: ${accounts.length}`); process.exit(2); }
const healthy = new Set(accounts.filter((a) => (a.stat_warmup_score ?? 0) >= MIN_SCORE && a.status !== -1).map((a) => a.email.toLowerCase()));
log(`accounts=${accounts.length} healthy(97+)=${healthy.size} sub97=${accounts.length - healthy.size}`);

const want = (a) => (healthy.has(a.email.toLowerCase()) ? DAILY_LIMIT : 0);
const fix = accounts.filter((a) => (a.daily_limit ?? -1) !== want(a));
await inBatches(fix, 10, async (a) => {
  await req(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(a.email)}`, { method: 'PATCH', body: JSON.stringify({ daily_limit: want(a) }) });
});
const paused = accounts.filter((a) => a.status === 2);
await inBatches(paused, 10, async (a) => {
  await req(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(a.email)}`, { method: 'PATCH', body: JSON.stringify({ daily_limit: want(a) }) });
  await req(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(a.email)}/resume`, { method: 'POST', body: '{}' });
});
log(`limits_fixed=${fix.length} resumed=${paused.length}`);

// ---- 3: sender-list sync (the actual off switch) ----
const campaigns = (await fetchAll('https://api.instantly.ai/api/v2/campaigns')).filter((c) => c.status === 1);
const healthyList = accounts.filter((a) => healthy.has(a.email.toLowerCase())).map((a) => a.email);
for (const c of campaigns) {
  const g = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
  if (!g || !g.ok) { problems.push(`cannot read campaign ${c.id}`); continue; }
  const full = await g.json();
  const cur = (full.email_list || []).map((e) => e.toLowerCase());
  const bad = cur.filter((e) => !healthy.has(e)).length;
  const missing = healthyList.filter((e) => !cur.includes(e.toLowerCase())).length;
  if (bad === 0 && missing === 0) { log(`  OK   ${full.name} senders=${cur.length}`); continue; }
  const p = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, { method: 'PATCH', body: JSON.stringify({ email_list: healthyList }) });
  const v = p && p.ok ? await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`) : null;
  const after = v && v.ok ? await v.json() : null;
  let clean = after && (after.email_list || []).every((e) => healthy.has(e.toLowerCase())) && after.status === 1;
  // CRITICAL (proven 2026-07-09): removing a mailbox from email_list does NOT
  // cancel already-queued sends assigned to it — the queue keeps draining.
  // A pause -> activate cycle rebuilds the queue from the current sender list.
  let flushed = false;
  if (clean && bad > 0) {
    const pz = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/pause`, { method: 'POST', body: '{}' });
    await sleep(1000);
    const ac = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/activate`, { method: 'POST', body: '{}' });
    const chk = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
    const st = chk && chk.ok ? (await chk.json()).status : null;
    flushed = !!(pz && pz.ok && ac && ac.ok && st === 1);
    if (st !== 1) { problems.push(`campaign ${full.name}: NOT ACTIVE after queue flush (status=${st})`); clean = false; }
  }
  log(`  SYNC ${full.name} removed=${bad} added=${missing} verified=${clean} queue_flushed=${flushed}`);
  if (!clean) problems.push(`campaign ${full.name}: sender-list sync FAILED verification`);
}

// ---- 4: audit actual sends over the rolling window ----
const since = Date.now() - AUDIT_WINDOW_MIN * 60_000;
const counts = new Map();
let after;
let pages = 0;
outer: while (pages < 60) {
  const url = `https://api.instantly.ai/api/v2/emails?limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`;
  const r = await req(url);
  if (!r || !r.ok) break;
  const d = await r.json();
  pages++;
  for (const e of d.items || []) {
    const ts = Date.parse(e.timestamp_email || e.timestamp_created || 0);
    if (ts && ts < since) break outer;
    if (e.ue_type === 1 && e.eaccount && e.campaign_id) { // campaign sends only; warmup has no campaign_id
      const k = e.eaccount.toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  if (!d.next_starting_after) break;
  after = d.next_starting_after;
}
const offenders = [...counts.entries()]
  .filter(([e]) => !healthy.has(e))
  .map(([email, sent]) => ({ email, sent, score: accounts.find((a) => a.email.toLowerCase() === email)?.stat_warmup_score ?? null }))
  .sort((a, b) => b.sent - a.sent);
const totalSent = [...counts.values()].reduce((a, b) => a + b, 0);
log(`audit: last ${AUDIT_WINDOW_MIN}min pages=${pages} total_sent=${totalSent} unique_senders=${counts.size} sub97_offenders=${offenders.length}`);
for (const o of offenders) log(`  OFFENDER ${o.email} sent=${o.sent} score=${o.score}`);

if (offenders.length) problems.push(`${offenders.length} sub-97 mailboxes SENT in the last ${AUDIT_WINDOW_MIN}min — settings are being bypassed`);
if (problems.length) {
  console.error('\nPROBLEMS:\n- ' + problems.join('\n- '));
  process.exit(1); // fail the workflow -> GitHub notifies the owner by email
}
log('\nALL CLEAR: sub-97 mailboxes delisted everywhere, zero sub-97 sends in window.');
