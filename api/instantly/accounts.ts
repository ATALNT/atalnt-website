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
    const baseUrl = 'https://api.instantly.ai/api/v2/accounts?limit=100';
    const allAccounts: InstantlyAccount[] = [];
    let startAfter = '';
    let hasMore = true;

    while (hasMore) {
      const url = startAfter
        ? `${baseUrl}&starting_after=${encodeURIComponent(startAfter)}`
        : baseUrl;

      const resp = await fetch(url, { method: 'GET', headers: apiHeaders });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Instantly API error ${resp.status}: ${errText}`);
      }

      const data: InstantlyListResponse = await resp.json();
      const items = data.items || [];
      allAccounts.push(...items);

      if (items.length === 100) {
        startAfter = items[items.length - 1].email;
      } else {
        hasMore = false;
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
