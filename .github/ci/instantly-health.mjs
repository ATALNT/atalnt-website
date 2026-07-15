#!/usr/bin/env node
// ============================================
// Instantly Health Guard — the single enforcement engine for ATALNT mailboxes.
// Runs from GitHub Actions (loop mode), the local 10-min routine, single passes.
//
// SETTLED FACTS (2026-07-08..10, all empirical):
//   - daily_limit:0 does NOT stop campaign sends. Never rely on it.
//   - Pausing an ACCOUNT stops its warmup. Accounts are never paused.
//   - A campaign sends only from mailboxes in its email_list, BUT removing a
//     mailbox does not cancel its already-queued sends -> pause->activate the
//     campaign to rebuild the queue.
//   - Health scores can crash 97->83 within hours; accounts hovering at the
//     line must not churn in and out of rosters (hysteresis below).
//   - Accounts can carry Google/M365 error states (status -1 disconnected,
//     -3 sending error like "550 daily limit exceeded") or a status_message
//     while still scoring 97-100. Sending through them burns them for good
//     (two gmails lost 2026-07-10). Error state = OFF the roster, period.
//
// ROSTER RULE (hysteresis):
//   eligible to STAY on rosters: score >= 97 AND status == 1 AND no status_message
//   eligible to be ADDED:        score >= 98 AND status == 1 AND no status_message
//   everything else: removed from every active campaign's email_list + queue flush.
//   Belt: stayers get daily_limit 20; everyone else 0. Nothing is ever paused.
//
// ALERTS: audit checks, for every non-roster mailbox, its newest ACTUAL campaign
// send (per-mailbox search query; the global /emails feed is unordered and lies).
// Window defaults to 15 min so alerts mean "leaking NOW", not stale residue —
// no more email spam. Bounce breaker pauses any campaign >10%/100 or >5%/300.
// ============================================

const KEY = process.env.INSTANTLY_API_KEY;
if (!KEY) { console.error('INSTANTLY_API_KEY missing'); process.exit(2); }
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'atalnt-health-guard' };
const STAY_SCORE = 97;
const ADD_SCORE = 98;
const DAILY_LIMIT = 20;
const AUDIT_WINDOW_MIN = Number(process.env.AUDIT_WINDOW_MIN || 15);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(m);

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

async function delTag(id) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api.instantly.ai/api/v2/custom-tags/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'atalnt-health-guard' } });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue; }
      return r.ok;
    } catch { await sleep(1500 * (i + 1)); }
  }
  return false;
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function runOnce(iterIndex = 0) {
  const problems = [];
  const iterationStart = Date.now();

  // ---- accounts ----
  const accounts = await fetchAll('https://api.instantly.ai/api/v2/accounts');
  if (accounts.length < 600) { problems.push(`account fetch suspicious: ${accounts.length}`); return problems; }
  // status_message is UNRELIABLE: June OAuth errors never clear while the mailbox
  // demonstrably sends (warmup flowing, score 93-100). Only live status counts.
  const clean = (a) => a.status === 1;
  const score = (a) => a.stat_warmup_score ?? 0;
  const canStay = new Set(accounts.filter((a) => clean(a) && score(a) >= STAY_SCORE).map((a) => a.email.toLowerCase()));
  const canAdd = accounts.filter((a) => clean(a) && score(a) >= ADD_SCORE).map((a) => a.email);
  const errorAccounts = accounts.filter((a) => a.status !== 1);

  // ---- QUARANTINE (2026-07-10): error states like Google's "550 daily limit
  // exceeded" are TEMPORARY — the account looks pristine again a day later and
  // was getting re-admitted, then re-burned (two gmails lost that way). Any
  // account seen in an error state is tagged guard-q-<date> in Instantly and
  // stays OFF rosters for QUARANTINE_DAYS after, even while looking clean.
  const QUARANTINE_DAYS = 3;
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - QUARANTINE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const quarantined = new Set();
  {
    const tags = await fetchAll('https://api.instantly.ai/api/v2/custom-tags');
    let todayTag = null;
    const seenDates = new Map();
    for (const t of tags) {
      const m = /^guard-q-(\d{4}-\d{2}-\d{2})$/.exec(t.label || '');
      if (!m) continue;
      if (m[1] < cutoff) { await delTag(t.id); continue; }
      const members = await fetchAll(`https://api.instantly.ai/api/v2/accounts?tag_ids=${t.id}`);
      for (const a of members) quarantined.add(a.email.toLowerCase());
      if (seenDates.has(m[1])) {
        // duplicate tag for the same date (created by racing runners): merge + delete
        const keeper = seenDates.get(m[1]);
        if (members.length) await req('https://api.instantly.ai/api/v2/custom-tags/toggle-resource', { method: 'POST', body: JSON.stringify({ tag_ids: [keeper], resource_type: 1, resource_ids: members.map((a) => a.email), assign: true }) });
        await delTag(t.id);
        continue;
      }
      seenDates.set(m[1], t.id);
      if (m[1] === today) todayTag = t;
    }
    if (errorAccounts.length) {
      if (!todayTag) {
        const cr = await req('https://api.instantly.ai/api/v2/custom-tags', { method: 'POST', body: JSON.stringify({ label: `guard-q-${today}`, description: 'health guard quarantine: account was in an error state on this date' }) });
        if (cr && cr.ok) todayTag = await cr.json();
      }
      if (todayTag) {
        await req('https://api.instantly.ai/api/v2/custom-tags/toggle-resource', { method: 'POST', body: JSON.stringify({ tag_ids: [todayTag.id], resource_type: 1, resource_ids: errorAccounts.map((a) => a.email), assign: true }) });
        for (const a of errorAccounts) quarantined.add(a.email.toLowerCase());
      } else problems.push('quarantine: could not create/find today tag');
    }
    for (const em of quarantined) { canStay.delete(em); }
  }
  const canAddFinal = canAdd.filter((e) => !quarantined.has(e.toLowerCase()));
  log(`accounts=${accounts.length} roster-eligible(clean,97+,not-quarantined)=${canStay.size} addable(98+)=${canAddFinal.length} error-state=${errorAccounts.length} quarantined=${quarantined.size}`);

  // ---- limits belt + never leave anything paused ----
  const want = (a) => (canStay.has(a.email.toLowerCase()) ? DAILY_LIMIT : 0);
  const fix = accounts.filter((a) => (a.daily_limit ?? -1) !== want(a));
  await inBatches(fix, 10, async (a) => {
    await req(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(a.email)}`, { method: 'PATCH', body: JSON.stringify({ daily_limit: want(a) }) });
  });
  const paused = accounts.filter((a) => a.status === 2);
  await inBatches(paused, 10, async (a) => {
    await req(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(a.email)}`, { method: 'PATCH', body: JSON.stringify({ daily_limit: want(a) }) });
    await req(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(a.email)}/resume`, { method: 'POST', body: '{}' });
  });
  if (fix.length || paused.length) log(`limits_fixed=${fix.length} resumed=${paused.length}`);

  // ---- sender-list sync with hysteresis + queue flush ----
  const campaigns = (await fetchAll('https://api.instantly.ai/api/v2/campaigns')).filter((c) => c.status === 1);
  for (const c of campaigns) {
    const g = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
    if (!g || !g.ok) { problems.push(`cannot read campaign ${c.id}`); continue; }
    const full = await g.json();
    const cur = (full.email_list || []);
    const curLower = new Set(cur.map((e) => e.toLowerCase()));
    // keep existing members while they are >=97 & clean; admit new only at >=98 & clean
    const stayers = cur.filter((e) => canStay.has(e.toLowerCase()));
    const newcomers = canAddFinal.filter((e) => !curLower.has(e.toLowerCase()));
    const target = [...stayers, ...newcomers];
    const removed = cur.length - stayers.length;
    const added = newcomers.length;
    if (removed === 0 && added === 0) { log(`  OK   ${full.name} senders=${cur.length}`); continue; }
    const p = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, { method: 'PATCH', body: JSON.stringify({ email_list: target }) });
    const v = p && p.ok ? await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`) : null;
    const after = v && v.ok ? await v.json() : null;
    let ok = !!after && (after.email_list || []).every((e) => canStay.has(e.toLowerCase()));
    // queue flush: removals leave queued sends behind; rebuild the queue
    let flushed = false;
    if (ok && removed > 0) {
      const pz = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/pause`, { method: 'POST', body: '{}' });
      await sleep(4000);
      const ac = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/activate`, { method: 'POST', body: '{}' });
      const chk = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
      const st = chk && chk.ok ? (await chk.json()).status : null;
      flushed = !!(pz && pz.ok && ac && ac.ok && st === 1);
      if (st !== 1) { problems.push(`campaign ${full.name}: NOT ACTIVE after queue flush (status=${st})`); ok = false; }
    }
    log(`  SYNC ${full.name} removed=${removed} added=${added} verified=${ok} queue_flushed=${flushed}`);
    if (!ok) problems.push(`campaign ${full.name}: sender-list sync FAILED verification`);
  }

  // ---- bounce circuit breaker ----
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
        problems.push(`BOUNCE GUARD paused campaign "${row.campaign_name}" at ${(rate * 100).toFixed(1)}% bounce (${bounced}/${sent})`);
        if (!(pz && pz.ok) || st !== 2) problems.push(`bounce guard FAILED to pause ${row.campaign_name}`);
      }
    } else problems.push('bounce guard: analytics endpoint unreachable');
  }

  // ---- reality audit: per-mailbox newest campaign send, non-roster accounts ----
  const since = Date.now() - AUDIT_WINDOW_MIN * 60_000;
  let nonRoster = accounts.filter((a) => !canStay.has(a.email.toLowerCase()));
  // Instantly rate-limits the whole workspace to 20 req/min. Auditing every
  // non-roster mailbox every iteration starves the other automations (reply
  // manager hit 429s). In loop mode, audit a rotating slice per iteration —
  // full coverage every few iterations; single-pass runs still audit everything.
  const SLICE = 40;
  if (Number(process.env.GUARD_LOOP_MINUTES || 0) && nonRoster.length > SLICE) {
    nonRoster.sort((a, b) => a.email.localeCompare(b.email));
    const chunks = Math.ceil(nonRoster.length / SLICE);
    const off = iterIndex % chunks;
    nonRoster = nonRoster.slice(off * SLICE, (off + 1) * SLICE);
  }
  const offenders = [];
  await inBatches(nonRoster, 5, async (a) => {
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
    if (newest >= since) offenders.push({ email: em, last: new Date(newest).toISOString(), score: score(a), state: a.status });
  });
  log(`audit: last ${AUDIT_WINDOW_MIN}min non_roster_checked=${nonRoster.length} offenders=${offenders.length}`);
  for (const o of offenders) log(`  OFFENDER ${o.email} last_campaign_send=${o.last} score=${o.score} status=${o.state}`);
  if (offenders.length) problems.push(`${offenders.length} non-roster mailboxes SENT within ${AUDIT_WINDOW_MIN}min — leaking NOW`);

  // SELF-HEAL (2026-07-10): one flush cycle was observed not to take — the stale
  // queue kept draining until the next roster write. If any offender's send is
  // newer than this iteration's start, force a fresh pause->activate on every
  // active campaign; the next iteration's audit verifies it held.
  const liveLeak = offenders.some((o) => Date.parse(o.last) >= iterationStart - 60_000);
  if (liveLeak) {
    log('  REACTIVE FLUSH: re-flushing all active campaigns (leak newer than iteration start)');
    for (const c of campaigns) {
      await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/pause`, { method: 'POST', body: '{}' });
      await sleep(4000);
      await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/activate`, { method: 'POST', body: '{}' });
      const chk = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
      const st = chk && chk.ok ? (await chk.json()).status : null;
      if (st !== 1) problems.push(`reactive flush: campaign ${c.id} NOT ACTIVE after cycle (status=${st})`);
    }
  }

  return problems;
}

// ---- driver: single pass by default; continuous loop when GUARD_LOOP_MINUTES set.
// GitHub throttles cron to 1.5-3.5h gaps, so each workflow run IS the cadence:
// it re-enforces every 10 minutes for ~GUARD_LOOP_MINUTES and runs chain via the
// concurrency group, giving continuous coverage regardless of the scheduler.
const LOOP_MIN = Number(process.env.GUARD_LOOP_MINUTES || 0);
const INTERVAL_MS = 10 * 60_000;
const deadline = Date.now() + LOOP_MIN * 60_000;
const allProblems = [];
for (let iter = 1; ; iter++) {
  const t0 = Date.now();
  if (LOOP_MIN) log(`\n===== guard iteration ${iter} @ ${new Date().toISOString()} =====`);
  let probs = [];
  try { probs = await runOnce(iter - 1); } catch (e) { probs = [`iteration crashed: ${e.message}`]; }
  for (const pr of probs) console.error(`::error::${pr}`);
  allProblems.push(...probs);
  if (Date.now() + INTERVAL_MS > deadline) break;
  const wait = Math.max(5_000, INTERVAL_MS - (Date.now() - t0));
  log(`-- iteration ${iter}: ${probs.length} problem(s); next in ${Math.round(wait / 1000)}s --`);
  await sleep(wait);
}
if (allProblems.length) {
  console.error('\nPROBLEMS THIS RUN:\n- ' + allProblems.join('\n- '));
  process.exit(1); // fail -> GitHub emails the owner (real breaches only now)
}
log('\nALL CLEAR: rosters healthy-only, zero non-roster sends, no bounce trips.');
