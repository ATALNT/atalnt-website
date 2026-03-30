// ============================================
// GET /api/instantly/accounts — Fetch all Instantly email accounts
// Returns health scores, daily limits, and status for the dashboard
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyDashboardToken, corsHeaders } from '../lib/auth-middleware';

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

async function fetchWithSearch(search: string, headers: Record<string, string>, seen: Set<string>, allAccounts: InstantlyAccount[]): Promise<void> {
  let startAfter: string | undefined;
  while (true) {
    const url = startAfter
      ? `https://api.instantly.ai/api/v2/accounts?limit=100&search=${encodeURIComponent(search)}&starting_after=${encodeURIComponent(startAfter)}`
      : `https://api.instantly.ai/api/v2/accounts?limit=100&search=${encodeURIComponent(search)}`;

    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) break;

    const data: InstantlyListResponse = await resp.json();
    const items = data.items || [];
    for (const item of items) {
      if (!seen.has(item.email)) {
        seen.add(item.email);
        allAccounts.push(item);
      }
    }

    if (data.next_starting_after) {
      startAfter = data.next_starting_after;
    } else {
      break;
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyDashboardToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });
  }

  const apiHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const allAccounts: InstantlyAccount[] = [];
    const seen = new Set<string>();

    // Instantly API v2 pagination is broken — search by letter to get all accounts
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const letter of letters) {
      await fetchWithSearch(letter, apiHeaders, seen, allAccounts);
    }
    for (let i = 0; i <= 9; i++) {
      await fetchWithSearch(String(i), apiHeaders, seen, allAccounts);
    }

    // Also fetch by status to catch disconnected/error accounts missed by search
    for (const status of [1, 2, 3, -1, -2, -3]) {
      let startAfter: string | undefined;
      while (true) {
        const url = startAfter
          ? `https://api.instantly.ai/api/v2/accounts?limit=100&status=${status}&starting_after=${encodeURIComponent(startAfter)}`
          : `https://api.instantly.ai/api/v2/accounts?limit=100&status=${status}`;
        const resp = await fetch(url, { method: 'GET', headers: apiHeaders });
        if (!resp.ok) break;
        const data: InstantlyListResponse = await resp.json();
        for (const item of data.items || []) {
          if (!seen.has(item.email)) {
            seen.add(item.email);
            allAccounts.push(item);
          }
        }
        if (data.next_starting_after) {
          startAfter = data.next_starting_after;
        } else {
          break;
        }
      }
    }

    const minScore = 97;
    const summary = {
      total: allAccounts.length,
      healthy: allAccounts.filter(a => a.stat_warmup_score != null && a.stat_warmup_score >= minScore).length,
      unhealthy: allAccounts.filter(a => a.stat_warmup_score != null && a.stat_warmup_score < minScore).length,
      no_score: allAccounts.filter(a => a.stat_warmup_score == null).length,
      throttled: allAccounts.filter(a => a.daily_limit === 0).length,
    };

    return res.status(200).json({
      summary,
      accounts: allAccounts.map(a => ({
        email: a.email,
        status: a.status,
        daily_limit: a.daily_limit,
        health_score: a.stat_warmup_score,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Instantly accounts error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
