// ============================================
// GET /api/instantly/cron-health-score — Health Score Auto-Manager
// Fetches ALL Instantly accounts and enforces the rule:
//   warmup score <  97  -> PAUSE the account (stops sending, warmup continues)
//   warmup score >= 97  -> RESUME the account and set daily_limit to 20
// Pause/resume is the only reliable on/off switch — daily_limit:0 is ignored
// by the Instantly API. Runs on a schedule (see vercel.json) a few times a day.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MIN_SCORE = 97;
const DEFAULT_DAILY_LIMIT = 20;

interface InstantlyAccount {
  email: string;
  status: number;
  daily_limit: number | null;
  stat_warmup_score: number | null;
}

interface InstantlyListResponse {
  items: InstantlyAccount[];
  next_starting_after?: string;
}

async function fetchAllAccounts(apiKey: string): Promise<InstantlyAccount[]> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  // Straight pagination via next_starting_after reliably returns every account.
  // (The old two-letter-search workaround silently skipped accounts, so
  // low-health / limit-drifted mailboxes were never paused or re-capped.)
  const allAccounts: InstantlyAccount[] = [];
  const seen = new Set<string>();
  let startAfter: string | undefined;
  while (true) {
    const url = `https://api.instantly.ai/api/v2/accounts?limit=100${startAfter ? `&starting_after=${encodeURIComponent(startAfter)}` : ''}`;
    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) break;
    const data: InstantlyListResponse = await resp.json();
    for (const item of data.items || []) {
      if (!seen.has(item.email)) {
        seen.add(item.email);
        allAccounts.push(item);
      }
    }
    if (data.next_starting_after) startAfter = data.next_starting_after;
    else break;
  }
  return allAccounts;
}

// Pause an account (stops campaign sending, warmup continues). Sets status=2.
// NOTE: daily_limit:0 does NOT work — the Instantly API silently ignores it and
// keeps the limit at its previous value. The pause/resume endpoints are the only
// reliable on/off switch.
async function pauseAccount(email: string, headers: Record<string, string>): Promise<boolean> {
  const resp = await fetch(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(email)}/pause`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!resp.ok) {
    console.error(`Failed to pause ${email}: ${resp.status} ${await resp.text()}`);
    return false;
  }
  return true;
}

// Resume an account (re-enables campaign sending). Sets status=1.
async function resumeAccount(email: string, headers: Record<string, string>): Promise<boolean> {
  const resp = await fetch(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(email)}/resume`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!resp.ok) {
    console.error(`Failed to resume ${email}: ${resp.status} ${await resp.text()}`);
    return false;
  }
  return true;
}

// Ensure daily_limit is set to the desired sending volume (only non-zero values persist).
async function setDailyLimit(email: string, limit: number, headers: Record<string, string>): Promise<void> {
  const resp = await fetch(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ daily_limit: limit }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Failed to update ${email}: ${resp.status} ${errText}`);
  }
}

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });
  }

  const dailyLimit = Number(process.env.INSTANTLY_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // status codes: 1 = active (sending), 2 = paused
  const HEALTHY_SCORE = 97;
  const STATUS_PAUSED = 2;
  try {
    const accounts = await fetchAllAccounts(apiKey);

    // The rule (NEVER pause — pausing an account halts its warmup, which freezes
    // an unhealthy mailbox instead of letting it heal):
    //   health >= 97  -> daily_limit = <dailyLimit>  (send + warm)
    //   health <= 96  -> daily_limit = 0             (warm only, no cold sending)
    // Warmup keeps running at any daily_limit including 0, so low-health mailboxes
    // recover instead of freezing. Also un-pause anything still paused.
    const desiredLimit = (score: number | null | undefined) =>
      (score ?? 0) >= HEALTHY_SCORE ? dailyLimit : 0;

    const toResume = accounts.filter((a) => a.status === STATUS_PAUSED);
    const toFixLimit = accounts.filter(
      (a) => (a.daily_limit ?? -1) !== desiredLimit(a.stat_warmup_score)
    );

    const resumedEmails: string[] = [];
    const limitSetEmails: string[] = [];
    const BATCH = 15;

    // ORDER MATTERS (root cause of the "30 of 0" sends): set every account's
    // daily_limit FIRST — while any still-paused account is still paused — so no
    // account is ever active while carrying a stale/non-zero limit. A sub-97
    // account must reach limit 0 BEFORE it goes active, or campaigns fire ~30
    // in the gap.
    for (let i = 0; i < toFixLimit.length; i += BATCH) {
      const batch = toFixLimit.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          const lim = desiredLimit(a.stat_warmup_score);
          await setDailyLimit(a.email, lim, headers);
          limitSetEmails.push(`${a.email} -> ${lim} (score ${a.stat_warmup_score})`);
        })
      );
    }

    // THEN un-pause anything paused, and re-assert its limit in the same step so
    // it's active with the correct limit (0 for sub-97) from the first second.
    for (let i = 0; i < toResume.length; i += BATCH) {
      const batch = toResume.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          await setDailyLimit(a.email, desiredLimit(a.stat_warmup_score), headers);
          if (await resumeAccount(a.email, headers)) resumedEmails.push(a.email);
        })
      );
    }

    const result = {
      total: accounts.length,
      resumed: resumedEmails.length,
      limit_set: limitSetEmails.length,
      healthy_sending: accounts.filter((a) => (a.stat_warmup_score ?? 0) >= HEALTHY_SCORE).length,
      warming_at_zero: accounts.filter((a) => (a.stat_warmup_score ?? 0) < HEALTHY_SCORE).length,
      healthy_score: HEALTHY_SCORE,
      daily_limit_setting: dailyLimit,
      policy: 'never pause; health>=97 -> daily_limit 20, health<=96 -> daily_limit 0 (warmup keeps running)',
      timestamp: new Date().toISOString(),
    };

    console.log('Health score manager result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Health score manager error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
