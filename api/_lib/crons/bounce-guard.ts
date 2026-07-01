// ============================================
// GET /api/instantly/cron-bounce-guard — Bounce-rate Circuit Breaker
// Checks every ACTIVE campaign's bounce rate and PAUSES any that crosses a
// danger threshold, so a bad data batch can't keep burning the domains.
//   - emergency:  bounce > 10% with >= 100 sent  -> pause
//   - sustained:  bounce >  5% with >= 300 sent  -> pause
// Min-volume gates stop a tiny campaign (e.g. 6 bounces / 58 sent) from
// tripping it. Runs every couple hours (see vercel.json). Pairs with the
// daily lead-pruner and the mailbox health cron.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  campaign_status: number; // 1 active, 2 paused, 3 done
  bounced_count: number | null;
  emails_sent_count: number | null;
}

const STATUS_ACTIVE = 1;

async function pauseCampaign(id: string, headers: Record<string, string>): Promise<boolean> {
  const resp = await fetch(`https://api.instantly.ai/api/v2/campaigns/${id}/pause`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!resp.ok) {
    console.error(`Failed to pause campaign ${id}: ${resp.status} ${await resp.text()}`);
    return false;
  }
  return true;
}

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // Thresholds (env-overridable)
  const SUSTAINED_RATE = Number(process.env.BOUNCE_SUSTAINED_RATE) || 0.05;
  const SUSTAINED_MIN_SENT = Number(process.env.BOUNCE_SUSTAINED_MIN_SENT) || 300;
  const EMERGENCY_RATE = Number(process.env.BOUNCE_EMERGENCY_RATE) || 0.10;
  const EMERGENCY_MIN_SENT = Number(process.env.BOUNCE_EMERGENCY_MIN_SENT) || 100;

  try {
    const resp = await fetch('https://api.instantly.ai/api/v2/campaigns/analytics', { method: 'GET', headers });
    if (!resp.ok) throw new Error(`analytics ${resp.status}`);
    const rows: CampaignAnalytics[] = await resp.json();

    const active = rows.filter((r) => r.campaign_status === STATUS_ACTIVE);
    const offenders = active
      .map((r) => {
        const sent = r.emails_sent_count || 0;
        const bounced = r.bounced_count || 0;
        const rate = sent > 0 ? bounced / sent : 0;
        const emergency = rate > EMERGENCY_RATE && sent >= EMERGENCY_MIN_SENT;
        const sustained = rate > SUSTAINED_RATE && sent >= SUSTAINED_MIN_SENT;
        return { r, sent, bounced, rate, trip: emergency || sustained, reason: emergency ? 'emergency' : sustained ? 'sustained' : '' };
      })
      .filter((x) => x.trip);

    const paused: any[] = [];
    for (const o of offenders) {
      const ok = await pauseCampaign(o.r.campaign_id, headers);
      paused.push({
        campaign: o.r.campaign_name,
        campaign_id: o.r.campaign_id,
        bounce_rate: `${(o.rate * 100).toFixed(1)}%`,
        bounced: o.bounced,
        sent: o.sent,
        reason: o.reason,
        paused: ok,
      });
    }

    const result = {
      checked_active_campaigns: active.length,
      paused_count: paused.length,
      paused,
      thresholds: { sustained: `>${SUSTAINED_RATE * 100}% & >=${SUSTAINED_MIN_SENT} sent`, emergency: `>${EMERGENCY_RATE * 100}% & >=${EMERGENCY_MIN_SENT} sent` },
      timestamp: new Date().toISOString(),
    };
    console.log('Bounce guard result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Bounce guard error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
