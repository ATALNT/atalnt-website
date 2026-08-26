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
// Must cover the whole gap between passes, or the audit inspects a sliver of it
// and reports ALL CLEAR for time it never looked at. Enforcement is 4-hourly
// (workflow cron), so the default matches at 240 minutes.
const AUDIT_WINDOW_MIN = Number(process.env.AUDIT_WINDOW_MIN || 240);

// PROTECTED WARMUP-ONLY MAILBOXES (operator directive 2026-07-16): these team
// mailboxes use Instantly for warmup ONLY. They must NEVER be added to any
// campaign's sender roster, no matter how healthy they get. Also entered in the
// Instantly block-list so campaigns can never email them, and tagged
// "warmup-only-protected" in the UI. Do not remove entries without the operator.
const PROTECTED_WARMUP_ONLY = new Set([
  'daniel@atalntcandidates.com',
  'gabriel@atalntcandidates.com',
  'mikee@atalntrecruiting.com',
  'kelona@atalntrecruiting.com',
  'remishka@atalntrecruiting.com',
  'dee@atalntrecruiting.com',
  'jessica@atalntrecruiting.com',
  'jeet@atalntrecruiting.com',
]);

// DIALER CARVE-OUT (2026-07-22, extended 2026-08-03): the sales pair (daniel@,
// gabriel@) and the sourcing/ops six run ISOLATED dial-companion systems
// (portal-fed, 30/day). They may send ONLY through campaigns whose name starts
// with "ISOLATED:". Those campaigns are never roster-synced; sends from these
// mailboxes inside ISOLATED campaigns are legitimate. Everything else about the
// 8 protected mailboxes is unchanged.
//
// ISOLATED_OWNER is the source of truth for the self-heal below: campaign id ->
// the ONE mailbox allowed to send from it. Explicit ids, not name matching — a
// substring probe ("dee" in DIALER_SENDERS) can collide with an unrelated
// campaign name and heal a campaign onto the wrong sender.
const ISOLATED_OWNER = new Map([
  ['f55852de-740d-471e-b57c-07fa3115d6c2', 'daniel@atalntcandidates.com'],   // ISOLATED: Daniel Dialer
  ['d2afdd99-ea82-4847-a150-cb4cc93e0b67', 'gabriel@atalntcandidates.com'],  // ISOLATED: Gabriel Dialer
  ['b95a285b-00db-4f8c-acc5-f039f164e51d', 'mikee@atalntrecruiting.com'],    // ISOLATED: Mikee Candidate Outreach
  ['e885013a-cea3-482a-911c-026ba93710c0', 'dee@atalntrecruiting.com'],      // ISOLATED: Dee Candidate Outreach
  ['df047d8b-3dc5-494a-8c53-9374e35a343b', 'jeet@atalntrecruiting.com'],     // ISOLATED: Jeet Candidate Outreach
  ['a8c83126-9d82-4596-9fc0-b399ef6eb81b', 'remishka@atalntrecruiting.com'], // ISOLATED: Remishka Candidate Outreach
  ['a8b06382-1a01-413d-a515-d97953076458', 'kelona@atalntrecruiting.com'],   // ISOLATED: Kelona Candidate Outreach
  ['e1498c48-6a03-47c9-b4e9-7d1793a6a02d', 'jessica@atalntrecruiting.com'],  // ISOLATED: Jessica Candidate Outreach
]);
const DIALER_SENDERS = new Set(ISOLATED_OWNER.values());
const DIALER_LIMIT = 30;

// DOMAIN WARMUP RAMP (2026-08-20, operator directive: "send 5 emails from healthy
// domain emails"). The new 300-mailbox fleet is 2-5 days old. Instantly's warmup
// score hits 100 long before Google and Microsoft form an opinion, so a fresh
// domain sending 20/day is exactly how the previous fleet burned. Any non-free
// mailbox younger than DOMAIN_RAMP_DAYS is capped at DOMAIN_RAMP_LIMIT regardless
// of score; it graduates to DAILY_LIMIT automatically once it ages past the gate.
const DOMAIN_RAMP_LIMIT = 10;
const DOMAIN_RAMP_DAYS = 21;
const ageDays = (a) => {
  const t = Date.parse(a.timestamp_created || '');
  return Number.isFinite(t) ? (Date.now() - t) / 86_400_000 : Infinity;
};

// DOMAIN-ONLY campaigns: name prefix "DOMAIN:" restricts the roster to non-free
// mailboxes, the mirror of the GMAIL: rule. Without it the roster sync would mix
// the gmail fleet into a deliberately domain-only ramp campaign.
const isDomainOnlyName = (n) => (n || '').startsWith('DOMAIN:');
const isIsolatedName = (n) => (n || '').startsWith('ISOLATED:');

// GMAIL-ONLY campaigns: name prefix "GMAIL:" restricts that campaign's sender
// roster to free mailboxes only. Needed because the roster sync below otherwise
// drafts EVERY clean mailbox into EVERY active campaign, so a hand-built
// gmail-only campaign would silently acquire the whole domain fleet on the next
// run. Mirrored in api/_lib/crons/health-score.ts; both must agree.
const FREE_MAILBOX_RE = /@(gmail|yahoo|hotmail|outlook|aol|icloud|live|msn)\.com$/i;
const isFreeMailbox = (e) => FREE_MAILBOX_RE.test((e || '').trim());
const isGmailOnlyName = (n) => (n || '').startsWith('GMAIL:');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(m);

// Instantly rate-limits ~20 req/min PER WORKSPACE. On a GitHub Actions runner
// (shared egress IPs, and our own concurrent calls) that ceiling is hit routinely,
// while the same code on a home IP never sees it. The old backoff topped out at
// ~15s total across 5 tries, which is far too short to ride out a 60s window, so
// reads failed on CI and the guard reported them as breaches. Now: exponential
// backoff with jitter, honoring Retry-After, up to ~2.5 minutes.
async function req(url, opts = {}, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H, ...opts });
      if (r.status === 429 || r.status >= 500) {
        const ra = Number(r.headers.get('retry-after'));
        const wait = Number.isFinite(ra) && ra > 0
          ? Math.min(ra * 1000, 60_000)
          : Math.min(2000 * 2 ** i, 30_000) + Math.floor(Math.random() * 750);
        await sleep(wait);
        continue;
      }
      return r;
    } catch {
      await sleep(Math.min(2000 * 2 ** i, 30_000) + Math.floor(Math.random() * 750));
    }
  }
  return null;
}

// Returns the full list, and records on `fetchAll.aborted` whether pagination
// ended because we ran out of pages (false) or because a request failed (true).
// Without this a rate-limited page break returns a PARTIAL list that looks like
// a real answer: the caller then sees "only 300 accounts" and either alarms
// falsely or, worse, strips rosters based on an incomplete picture.
async function fetchAll(base) {
  const out = [];
  let after;
  fetchAll.aborted = false;
  while (true) {
    const url = `${base}${base.includes('?') ? '&' : '?'}limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`;
    const r = await req(url);
    if (!r || !r.ok) { fetchAll.aborted = true; break; }
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
  // Soft failures = "could not check this cycle", NOT "something is broken".
  // The guard runs every 4 hours; a rate-limited read is noise, not a breach.
  // Only alarm if MOST reads fail, which means the key or the account is dead.
  const softFail = [];
  const iterationStart = Date.now();

  // ---- accounts ----
  const accounts = await fetchAll('https://api.instantly.ai/api/v2/accounts');
  const accountsPartial = fetchAll.aborted;
  // A partial account list must NEVER drive enforcement: acting on it would strip
  // rosters for mailboxes we simply failed to page in. Bail quietly and let the
  // next 4-hourly run do the work, rather than emailing about a rate limit.
  if (accountsPartial) {
    log(`  SKIP  account fetch incomplete (${accounts.length} paged before a failure). Doing nothing this cycle.`);
    return problems;
  }
  if (accounts.length < 600) { problems.push(`account fetch suspicious: ${accounts.length}`); return problems; }
  // status_message is UNRELIABLE: June OAuth errors never clear while the mailbox
  // demonstrably sends (warmup flowing, score 93-100). Only live status counts.
  const clean = (a) => a.status === 1 && !PROTECTED_WARMUP_ONLY.has(a.email.toLowerCase());
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
  const want = (a) => {
    const em = a.email.toLowerCase();
    if (DIALER_SENDERS.has(em)) return DIALER_LIMIT;
    if (!canStay.has(em)) return 0;
    // fresh domain mailboxes ramp at 5/day until they age past the gate
    if (!isFreeMailbox(a.email) && ageDays(a) < DOMAIN_RAMP_DAYS) return DOMAIN_RAMP_LIMIT;
    return DAILY_LIMIT;
  };
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
  const allActive = (await fetchAll('https://api.instantly.ai/api/v2/campaigns')).filter((c) => c.status === 1);
  const isolatedIds = new Set(allActive.filter((c) => isIsolatedName(c.name)).map((c) => c.id));
  const campaigns = allActive.filter((c) => !isIsolatedName(c.name));

  // SELF-HEAL ISOLATED campaigns (2026-07-22 incident: a stale-code run stuffed
  // the whole cold-fleet roster into Daniel's dialer campaign). An ISOLATED
  // campaign's sender list must be EXACTLY its designated dialer mailbox, read
  // from ISOLATED_OWNER. Restore + flush + alert on any drift. An ISOLATED-named
  // campaign with no entry in the map is unknown to us: it is still exempt from
  // roster sync, but flag it so a typo'd or rogue name cannot hide there.
  for (const c of allActive.filter((x) => isIsolatedName(x.name))) {
    const designated = ISOLATED_OWNER.get(c.id);
    if (!designated) {
      problems.push(`unknown ISOLATED campaign "${c.name}" (${c.id}) — not in ISOLATED_OWNER, add it or rename the campaign`);
      continue;
    }
    const g = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
    if (!g || !g.ok) continue;
    const full = await g.json();
    const el = (full.email_list || []).map((e) => e.toLowerCase());
    if (el.length === 1 && el[0] === designated) continue;
    await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, { method: 'PATCH', body: JSON.stringify({ email_list: [designated] }) });
    await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/pause`, { method: 'POST', body: '{}' });
    await sleep(4000);
    await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/activate`, { method: 'POST', body: '{}' });
    log(`  SELF-HEAL ${full.name}: sender list drifted (${el.length} entries), restored to ${designated} + flushed`);
    problems.push(`ISOLATED campaign "${full.name}" sender list drifted and was restored, investigate what wrote to it`);
  }
  for (const c of campaigns) {
    const g = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
    if (!g || !g.ok) { softFail.push(`campaign ${c.id} unreadable (rate limit or transient)`); log(`  SKIP  campaign ${c.id}: unreadable this cycle, will retry next run`); continue; }
    const full = await g.json();
    const cur = (full.email_list || []);
    const curLower = new Set(cur.map((e) => e.toLowerCase()));
    // GMAIL-ONLY campaigns (name starts "GMAIL:"): roster is restricted to free
    // mailboxes. Without this the sync below injects the whole domain fleet into
    // them within one run, which silently breaks a deliberately gmail-only send.
    // Same hysteresis still applies, just over a filtered pool.
    const gmailOnly = isGmailOnlyName(full.name);
    const domainOnly = isDomainOnlyName(full.name);
    const inPool = (e) => (!gmailOnly || isFreeMailbox(e)) && (!domainOnly || !isFreeMailbox(e));
    const poolStay = (e) => canStay.has(e.toLowerCase()) && inPool(e);
    const poolAdd = canAddFinal.filter((e) => inPool(e));
    // keep existing members while they are >=97 & clean; admit new only at >=98 & clean
    const stayers = cur.filter((e) => poolStay(e));
    const newcomers = poolAdd.filter((e) => !curLower.has(e.toLowerCase()));
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
        // ISOLATED campaigns are NEVER auto-paused (operator directive 2026-08-13:
        // "dont let those emails turn off from the bounce guard anymore i'll monitor
        // those manually"). Jessica (18.3%) and Kelona (13.3%) were being tripped
        // repeatedly, which stops the recruiters working. Still logged and still
        // reported as a problem so the bounce rate stays visible, just not acted on.
        // LOG ONLY, never a "problem". A problem exits the run non-zero and GitHub
        // emails on every failure. These bounce rates are cumulative and permanently
        // over threshold (the already-queued leads predate verification), so pushing
        // a problem here fired a failure email every 4 hours forever. The operator
        // monitors these manually, so visibility in the log is enough.
        if (isIsolatedName(row.campaign_name)) {
          log(`  BOUNCE-ALERT (not paused, ISOLATED, monitored manually) ${row.campaign_name} rate=${(rate * 100).toFixed(1)}% (${bounced}/${sent})`);
          continue;
        }
        const pz = await req(`https://api.instantly.ai/api/v2/campaigns/${row.campaign_id}/pause`, { method: 'POST', body: '{}' });
        const chk = await req(`https://api.instantly.ai/api/v2/campaigns/${row.campaign_id}`);
        const st = chk && chk.ok ? (await chk.json()).status : null;
        log(`  BOUNCE-TRIP ${row.campaign_name} rate=${(rate * 100).toFixed(1)}% (${bounced}/${sent}) paused=${st === 2}`);
        problems.push(`BOUNCE GUARD paused campaign "${row.campaign_name}" at ${(rate * 100).toFixed(1)}% bounce (${bounced}/${sent})`);
        if (!(pz && pz.ok) || st !== 2) problems.push(`bounce guard FAILED to pause ${row.campaign_name}`);
      }
    } else { softFail.push('analytics endpoint unreachable'); log('  SKIP  bounce guard: analytics unreachable this cycle'); }
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
        if (isolatedIds.has(e.campaign_id) && DIALER_SENDERS.has(em)) continue; // sanctioned dialer send
        const ts = Date.parse(e.timestamp_email || e.timestamp_created || '');
        if (Number.isFinite(ts) && ts > newest) newest = ts;
      }
    }
    if (newest >= since) offenders.push({ email: em, last: new Date(newest).toISOString(), score: score(a), state: a.status });
  });
  log(`audit: last ${AUDIT_WINDOW_MIN}min non_roster_checked=${nonRoster.length} offenders=${offenders.length}`);

  // Classify offenders (2026-08-15). Not every non-roster send is an emergency:
  // a mailbox that dipped from 97 to 96 gets pulled from the roster, and one
  // queued send can still fire afterward — PROVEN when a flush ran before the
  // 9:00 window opened and Instantly fired the stale send at window open
  // (priftiendri289@gmail.com, score 96, sent 9:03). That straggler is
  // self-healing: we flush below and the belt already zeroed its limit. Failing
  // the run for it just emails the operator about a fixed problem every 4 hours.
  // HARD offenders still fail loudly: protected warmup-only mailboxes (never
  // acceptable), error-state accounts, score < 95 (nowhere near the roster,
  // something else re-admitted it), or 3+ dropouts at once (systemic churn).
  const hard = [];
  const dropouts = [];
  for (const o of offenders) {
    const benign = o.state === 1 && o.score >= 95 && !PROTECTED_WARMUP_ONLY.has(o.email);
    (benign ? dropouts : hard).push(o);
    log(`  OFFENDER${benign ? ' (hysteresis dropout, self-healing)' : ''} ${o.email} last_campaign_send=${o.last} score=${o.score} status=${o.state}`);
  }
  // Escalate soft failures ONLY when they are widespread: half or more of the
  // campaigns unreadable in one cycle means the API key or account is broken,
  // which is worth an email. One or two is just the rate limiter.
  if (softFail.length && softFail.length >= Math.max(2, Math.ceil(campaigns.length / 2))) {
    problems.push(`${softFail.length} API reads failed this cycle (${softFail.slice(0, 3).join('; ')}) — key or account may be down`);
  } else if (softFail.length) {
    log(`  note: ${softFail.length} transient read failure(s), tolerated: ${softFail.join('; ')}`);
  }
  if (hard.length) problems.push(`${hard.length} non-roster mailboxes SENT within ${AUDIT_WINDOW_MIN}min — leaking NOW`);
  if (dropouts.length >= 3) problems.push(`${dropouts.length} hysteresis-dropout mailboxes leaked sends in one window — flush is not holding, investigate`);

  // SELF-HEAL (2026-07-10, widened 2026-08-15): one flush cycle was observed
  // not to take — the stale queue kept draining until the next roster write.
  // Previously this only re-flushed when a leak was newer than iteration start,
  // which let older-but-in-window stragglers keep their stale queue entries.
  // Now ANY offender in the window triggers a flush of every active campaign;
  // a failed flush is always a hard problem.
  if (offenders.length) {
    log('  REACTIVE FLUSH: re-flushing all active campaigns (offender in audit window)');
    for (const c of campaigns) {
      await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/pause`, { method: 'POST', body: '{}' });
      await sleep(4000);
      await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}/activate`, { method: 'POST', body: '{}' });
      const chk = await req(`https://api.instantly.ai/api/v2/campaigns/${c.id}`);
      const st = chk && chk.ok ? (await chk.json()).status : null;
      if (st !== 1) problems.push(`reactive flush: campaign ${c.id} NOT ACTIVE after cycle (status=${st})`);
      else log(`    flushed ${c.name} ok`);
    }
  }

  return problems;
}

// ---- driver: single pass by default; continuous loop when GUARD_LOOP_MINUTES set.
// 2026-08-05: enforcement spacing moved from 10 minutes to 4 HOURS. It churned
// constantly at 10: 142 of 730 mailboxes sit in the 95-98 band and 77 sit exactly
// on the 97 stay-threshold, so ordinary warmup drift kept knocking them off
// rosters and firing a pause/activate queue flush on every affected campaign.
//
// The interval lives here rather than in the workflow so it applies however the
// guard is invoked. For an exact 4-hourly cadence the workflow should also move
// to `cron: 0 */4 * * *` with GUARD_LOOP_MINUTES=0; while it still sets a loop
// length, spacing is right but run boundaries add some jitter.
const LOOP_MIN = Number(process.env.GUARD_LOOP_MINUTES || 0);
const INTERVAL_MS = Number(process.env.GUARD_INTERVAL_MINUTES || 240) * 60_000;
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
