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
  const STATUS_ACTIVE = 1;
  const STATUS_PAUSED = 2;

  try {
    const accounts = await fetchAllAccounts(apiKey);

    // Decide the action for each account from its health score:
    //   score <  97  -> pause (turn off sending; warmup keeps running)
    //   score >= 97  -> resume + ensure daily_limit is set
    const toPause = accounts.filter(
      (a) => a.stat_warmup_score != null && a.stat_warmup_score < MIN_SCORE && a.status !== STATUS_PAUSED
    );
    const toResume = accounts.filter(
      (a) => a.stat_warmup_score != null && a.stat_warmup_score >= MIN_SCORE && a.status === STATUS_PAUSED
    );
    const noScore = accounts.filter((a) => a.stat_warmup_score == null);
    // HARD CAP: every account whose daily_limit has drifted off the target gets
    // pinned back, regardless of health or pause state. This is critical because
    // Instantly does NOT honor a daily_limit of 0 as "off" — it ignores the 0 and
    // sends its own default (~30/day). The only way to guarantee "never more than
    // <dailyLimit> per mailbox" is to keep every account pinned to a real, non-zero
    // value on every run.
    const toFixLimit = accounts.filter((a) => a.daily_limit !== dailyLimit);

    const pausedEmails: string[] = [];
    const resumedEmails: string[] = [];
    const limitFixedEmails: string[] = [];

    // Run actions in parallel batches so the job covers all accounts within the timeout.
    // (The old version did one sequential PATCH per account and could time out partway,
    // leaving most unhealthy accounts still sending.)
    const BATCH = 15;

    for (let i = 0; i < toPause.length; i += BATCH) {
      const batch = toPause.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          if (await pauseAccount(a.email, headers)) {
            pausedEmails.push(`${a.email} (score: ${a.stat_warmup_score})`);
          }
        })
      );
    }

    for (let i = 0; i < toResume.length; i += BATCH) {
      const batch = toResume.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          const ok = await resumeAccount(a.email, headers);
          if (ok) {
            await setDailyLimit(a.email, dailyLimit, headers);
            resumedEmails.push(`${a.email} (score: ${a.stat_warmup_score})`);
          }
        })
      );
    }

    // Enforce the target daily_limit on healthy, already-active accounts whose
    // limit drifted. Only touches the drifted ones, so it stays cheap.
    for (let i = 0; i < toFixLimit.length; i += BATCH) {
      const batch = toFixLimit.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (a) => {
          await setDailyLimit(a.email, dailyLimit, headers);
          limitFixedEmails.push(`${a.email} (was: ${a.daily_limit})`);
        })
      );
    }

    const result = {
      total: accounts.length,
      paused: pausedEmails.length,
      resumed: resumedEmails.length,
      limit_fixed: limitFixedEmails.length,
      already_correct: accounts.length - toPause.length - toResume.length - toFixLimit.length - noScore.length,
      no_score_skipped: noScore.length,
      min_score: MIN_SCORE,
      daily_limit_setting: dailyLimit,
      paused_emails: pausedEmails,
      resumed_emails: resumedEmails,
      limit_fixed_emails: limitFixedEmails,
      timestamp: new Date().toISOString(),
    };

    console.log('Health score manager result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Health score manager error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
