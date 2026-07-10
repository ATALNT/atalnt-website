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

const log = (m) => console.log(m);

async function runOnce() {
  const problems = [];

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

// ---- 3.5: bounce circuit breaker (every run, not just daily) ----
// If a campaign's bounce rate crosses the danger line, PAUSE it immediately
// and fail the run so the operator gets an email. Min-volume gates stop tiny
// campaigns from false-tripping. A human decides when to resume.
{
  const r = await req('https://api.instantly.ai/api/v2/campaigns/analytics');
  if (r && r.ok) {
    const rows = await r.json();
    for (const row of rows) {
      if (row.campaign_status !== 1) continue;
      const sent = row.emails_sent_count || 0;
      const bounced = row.bounced_count || 0;
      const rate = sent > 0 ? bounced / sent : 0;
      const trip = (rate > 0.10 && sent >= 100) || (rate > 0.05 && sent >= 300);
      if (!trip) continue;
      const pz = await req(`https://api.instantly.ai/api/v2/campaigns/${row.campaign_id}/pause`, { method: 'POST', body: '{}' });
      const chk = await req(`https://api.instantly.ai/api/v2/campaigns/${row.campaign_id}`);
      const st = chk && chk.ok ? (await chk.json()).status : null;
      log(`  BOUNCE-TRIP ${row.campaign_name} rate=${(rate * 100).toFixed(1)}% (${bounced}/${sent}) paused=${st === 2}`);
      problems.push(`BOUNCE GUARD paused campaign "${row.campaign_name}" at ${(rate * 100).toFixed(1)}% bounce (${bounced}/${sent}) — investigate before resuming`);
      if (!(pz && pz.ok) || st !== 2) problems.push(`bounce guard FAILED to pause ${row.campaign_name}`);
    }
  } else {
    problems.push('bounce guard: analytics endpoint unreachable');
  }
}

// ---- 4: audit actual sends over the rolling window ----
// Per-mailbox precision query (the global /emails feed is unordered and can
// resurface/duplicate old items — it produced false alarms). For each sub-97
// mailbox, fetch ITS recent items and take the newest real campaign send
// (ue_type=1 AND campaign_id set AND eaccount matches; warmup has no campaign_id).
const since = Date.now() - AUDIT_WINDOW_MIN * 60_000;
const unhealthyAccounts = accounts.filter((a) => !healthy.has(a.email.toLowerCase()));
const counts = new Map(); // email -> newest in-window campaign-send ts
await inBatches(unhealthyAccounts, 8, async (a) => {
  const em = a.email.toLowerCase();
  const r = await req(`https://api.instantly.ai/api/v2/emails?limit=50&search=${encodeURIComponent(a.email)}`);
  if (!r || !r.ok) return;
  const d = await r.json();
  let newest = 0;
  for (const e of d.items || []) {
    if (e.ue_type === 1 && e.campaign_id && (e.eaccount || '').toLowerCase() === em) {
      const ts = Date.parse(e.timestamp_email || e.timestamp_created || '');
      if (Number.isFinite(ts) && ts > newest) newest = ts;
    }
  }
  if (newest >= since) counts.set(em, newest);
});
const pages = unhealthyAccounts.length; // reported as accounts checked
const offenders = [...counts.entries()]
  .map(([email, ts]) => ({ email, last_campaign_send: new Date(ts).toISOString(), score: accounts.find((a) => a.email.toLowerCase() === email)?.stat_warmup_score ?? null }))
  .sort((a, b) => (a.last_campaign_send < b.last_campaign_send ? 1 : -1));
log(`audit: last ${AUDIT_WINDOW_MIN}min sub97_checked=${pages} sub97_offenders=${offenders.length}`);
for (const o of offenders) log(`  OFFENDER ${o.email} last_campaign_send=${o.last_campaign_send} score=${o.score}`);

if (offenders.length) problems.push(`${offenders.length} sub-97 mailboxes SENT in the last ${AUDIT_WINDOW_MIN}min — settings are being bypassed`);
  return problems;
}

// ---- driver: single pass by default; continuous loop when GUARD_LOOP_MINUTES is set ----
// GitHub throttles cron schedules to 1.5-3.5h gaps (observed 2026-07-10), which let
// mid-day health-droppers send for hours. Fix: each workflow run IS the cadence —
// it re-enforces every 10 minutes for ~GUARD_LOOP_MINUTES, and runs chain back to
// back (concurrency group queues the next scheduled run), giving 24/7 coverage.
const LOOP_MIN = Number(process.env.GUARD_LOOP_MINUTES || 0);
const INTERVAL_MS = 10 * 60_000;
const deadline = Date.now() + LOOP_MIN * 60_000;
const allProblems = [];
for (let iter = 1; ; iter++) {
  const t0 = Date.now();
  log(`\n===== guard iteration ${iter} @ ${new Date().toISOString()} =====`);
  let probs = [];
  try { probs = await runOnce(); } catch (e) { probs = [`iteration crashed: ${e.message}`]; }
  for (const pr of probs) console.error(`::error::${pr}`);
  allProblems.push(...probs);
  if (Date.now() + INTERVAL_MS > deadline) break;
  const wait = Math.max(5_000, INTERVAL_MS - (Date.now() - t0));
  log(`-- iteration ${iter}: ${probs.length} problem(s); next in ${Math.round(wait / 1000)}s --`);
  await sleep(wait);
}
if (allProblems.length) {
  console.error('\nPROBLEMS THIS RUN:\n- ' + allProblems.join('\n- '));
  process.exit(1); // fail -> GitHub emails the owner
}
log('\nALL CLEAR: sub-97 mailboxes delisted everywhere, zero sub-97 sends, no bounce trips.');
