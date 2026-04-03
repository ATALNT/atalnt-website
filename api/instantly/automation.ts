// ============================================
// GET/POST /api/instantly/automation — Automation stats & kill switch
// GET: Returns lead response stats + cron enabled/disabled state
// POST: Toggle cron on/off
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

function verifyDashboardToken(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return false;
  return token === secret;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function supabaseUrl(path: string): string {
  return `${process.env.VITE_SUPABASE_URL}/rest/v1${path}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyDashboardToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'POST') {
      // Toggle a cron on/off
      const { key, enabled } = req.body as { key: string; enabled: boolean };
      if (!key || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'key and enabled (boolean) required' });
      }

      const resp = await fetch(
        supabaseUrl(`/automation_settings?key=eq.${encodeURIComponent(key)}`),
        {
          method: 'PATCH',
          headers: supabaseHeaders(),
          body: JSON.stringify({ enabled, updated_at: new Date().toISOString() }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(500).json({ error: errText });
      }

      const updated = await resp.json();
      return res.status(200).json({ success: true, setting: updated[0] });
    }

    // GET: Return stats + settings
    const [settingsResp, statsResp] = await Promise.all([
      fetch(supabaseUrl('/automation_settings?select=*'), { headers: supabaseHeaders() }),
      fetch(supabaseUrl('/lead_responses?select=lead_email,status,instantly_sent,nik_email_sent,sent_at,industry&order=sent_at.asc'), { headers: supabaseHeaders() }),
    ]);

    const settings = settingsResp.ok ? await settingsResp.json() : [];
    const leads = statsResp.ok ? await statsResp.json() : [];

    // Build summary stats
    const total = leads.length;
    const part1Sent = leads.filter((l: any) => l.instantly_sent).length;
    const part2Sent = leads.filter((l: any) => l.nik_email_sent && l.status === 'completed').length;
    const skipped = leads.filter((l: any) => l.status === 'skipped_existing').length;
    const errors = leads.filter((l: any) => l.status === 'error').length;
    const pending = leads.filter((l: any) => l.status === 'part1_sent' && !l.nik_email_sent).length;

    // Build daily activity for chart (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyMap: Record<string, { date: string; part1: number; part2: number; errors: number }> = {};

    // Pre-fill last 30 days
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, part1: 0, part2: 0, errors: 0 };
    }

    for (const lead of leads) {
      if (!lead.sent_at) continue;
      const day = new Date(lead.sent_at).toISOString().split('T')[0];
      if (!dailyMap[day]) continue;
      if (lead.instantly_sent) dailyMap[day].part1++;
      if (lead.nik_email_sent && lead.status === 'completed') dailyMap[day].part2++;
      if (lead.status === 'error') dailyMap[day].errors++;
    }

    const dailyActivity = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Industry breakdown
    const industries: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.industry) {
        industries[lead.industry] = (industries[lead.industry] || 0) + 1;
      }
    }

    // Convert settings to a map
    const settingsMap: Record<string, boolean> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.enabled;
    }

    return res.status(200).json({
      stats: {
        total,
        part1_sent: part1Sent,
        part2_sent: part2Sent,
        skipped,
        errors,
        pending,
      },
      dailyActivity,
      industries,
      settings: settingsMap,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
