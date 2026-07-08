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
  const STATUS_ACTIVE = 1;
  const STATUS_PAUSED = 2;
  try {
    const accounts = await fetchAllAccounts(apiKey);

    // The rule (PAUSE/RESUME — verified 2026-07-08 to be the only reliable
    // on/off switch):
    //   health >= 97  -> ACTIVE + daily_limit 20   (send + warm)
    //   health <= 96  -> PAUSED                     (no cold sending)
    // Two facts this policy depends on, both tested empirically:
    //   1. daily_limit:0 is IGNORED by Instantly — an active account at limit 0
    //      still sends its ~30/day default. So 0 does NOT stop sending.
    //   2. Pausing an account (status=2) leaves warmup_status=1 untouched, so
    //      warmup KEEPS running on paused mailboxes and they still heal.
    // Never send more than daily_limit (20) from any mailbox, ever.
    const isHealthy = (a: InstantlyAccount) => (a.stat_warmup_score ?? 0) >= HEALTHY_SCORE;

    const toPause = accounts.filter((a) => !isHealthy(a) && a.status === STATUS_ACTIVE);
    const toResume = accounts.filter((a) => isHealthy(a) && a.status === STATUS_PAUSED);
    const toFixLimit = accounts.filter((a) => isHealthy(a) && (a.daily_limit ?? -1) !== dailyLimit);

    const pausedEmails: string[] = [];
    const resumedEmails: string[] = [];
    const limitSetEmails: string[] = [];
    const BATCH = 15;

    // Unhealthy + sending -> pause (stops cold sending; warmup continues)
    for (let i = 0; i < toPause.length; i += BATCH) {
      const batch = toPause.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          if (await pauseAccount(a.email, headers)) pausedEmails.push(`${a.email} (score ${a.stat_warmup_score})`);
        })
      );
    }

    // Healthy + paused -> resume, then ensure the 20/day cap
    for (let i = 0; i < toResume.length; i += BATCH) {
      const batch = toResume.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          if (await resumeAccount(a.email, headers)) {
            await setDailyLimit(a.email, dailyLimit, headers);
            resumedEmails.push(`${a.email} (score ${a.stat_warmup_score})`);
          }
        })
      );
    }

    // Healthy + active but limit drifted -> snap back to 20 (hard cap)
    for (let i = 0; i < toFixLimit.length; i += BATCH) {
      const batch = toFixLimit.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          await setDailyLimit(a.email, dailyLimit, headers);
          limitSetEmails.push(`${a.email} (was ${a.daily_limit})`);
        })
      );
    }

    const result = {
      total: accounts.length,
      paused: pausedEmails.length,
      resumed: resumedEmails.length,
      limit_set: limitSetEmails.length,
      healthy_sending: accounts.filter(isHealthy).length,
      warming_paused: accounts.filter((a) => !isHealthy(a)).length,
      healthy_score: HEALTHY_SCORE,
      daily_limit_setting: dailyLimit,
      policy: 'pause <=96 (warmup keeps running), resume + cap 20/day for >=97; daily_limit:0 is ignored by Instantly so never used',
      timestamp: new Date().toISOString(),
    };

    console.log('Health score manager result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Health score manager error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
