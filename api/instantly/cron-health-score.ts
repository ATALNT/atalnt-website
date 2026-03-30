// ============================================
// GET /api/instantly/cron-health-score — Daily Health Score Auto-Manager
// Fetches all Instantly accounts, sets daily_limit=0 for unhealthy
// accounts (keeps warmup active), restores for healthy ones.
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
  const baseUrl = 'https://api.instantly.ai/api/v2/accounts?limit=100';
  const allAccounts: InstantlyAccount[] = [];
  let startAfter: string | undefined;

  while (true) {
    const url = startAfter
      ? `${baseUrl}&starting_after=${encodeURIComponent(startAfter)}`
      : baseUrl;

    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Instantly API error ${resp.status}: ${errText}`);
    }

    const data: InstantlyListResponse = await resp.json();
    const items = data.items || [];
    allAccounts.push(...items);

    if (data.next_starting_after) {
      startAfter = data.next_starting_after;
    } else {
      break;
    }
  }

  return allAccounts;
}

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

  try {
    const accounts = await fetchAllAccounts(apiKey);

    let throttledCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;
    const throttledEmails: string[] = [];
    const restoredEmails: string[] = [];

    for (const account of accounts) {
      const { email, daily_limit, stat_warmup_score: healthScore } = account;

      if (healthScore == null) {
        skippedCount++;
        continue;
      }

      if (healthScore < MIN_SCORE && daily_limit !== 0) {
        await setDailyLimit(email, 0, headers);
        throttledCount++;
        throttledEmails.push(`${email} (score: ${healthScore})`);
      } else if (healthScore >= MIN_SCORE && daily_limit === 0) {
        await setDailyLimit(email, dailyLimit, headers);
        restoredCount++;
        restoredEmails.push(`${email} (score: ${healthScore})`);
      } else {
        skippedCount++;
      }
    }

    const result = {
      total: accounts.length,
      throttled_to_zero: throttledCount,
      restored_sends: restoredCount,
      skipped: skippedCount,
      daily_limit_setting: dailyLimit,
      throttled_emails: throttledEmails,
      restored_emails: restoredEmails,
      timestamp: new Date().toISOString(),
    };

    console.log('Health score manager result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Health score manager error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
