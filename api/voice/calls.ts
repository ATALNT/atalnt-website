// ============================================
// GET /api/voice/calls - Zoho Voice Call Data
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Inlined auth helpers (Vercel ESM can't resolve ../lib imports) ---

function verifyDashboardToken(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return false;
  return token === secret;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getZohoAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Zoho OAuth credentials');
  }
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho OAuth failed: ${response.status} - ${errorText}`);
  }
  const data: TokenResponse = await response.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// --- End inlined helpers ---

interface ZohoVoiceCallLog {
  id: string;
  call_type: string;
  caller_number: string;
  receiver_number: string;
  agent_name: string;
  agent_email: string;
  queue_name: string;
  call_duration: number;
  start_time: string;
  end_time: string;
  call_status: string;
  disposition: string;
  has_recording: boolean;
}

async function fetchCallLogs(accessToken: string, from: string, to: string): Promise<ZohoVoiceCallLog[]> {
  const allLogs: ZohoVoiceCallLog[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://voice.zoho.com/api/v1/calllogs?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}&page=${page}&per_page=200`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 204) break;
      const errorText = await response.text();
      throw new Error(`Zoho Voice API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      allLogs.push(...data.data);
      hasMore = data.data.length === 200;
    } else if (data.call_logs && Array.isArray(data.call_logs)) {
      allLogs.push(...data.call_logs);
      hasMore = data.call_logs.length === 200;
    } else {
      hasMore = false;
    }

    page++;
    if (page > 50) break;
  }

  return allLogs;
}

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case 'today': {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: from.toISOString(), to };
    }
    case 'this_week': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return { from: startOfWeek.toISOString(), to };
    }
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth.toISOString(), to };
    }
    case 'last_7_days': {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: sevenDaysAgo.toISOString(), to };
    }
    case 'last_30_days': {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: thirtyDaysAgo.toISOString(), to };
    }
    default: {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: sevenDaysAgo.toISOString(), to };
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyDashboardToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { preset = 'last_7_days', from: customFrom, to: customTo } = req.query as Record<string, string>;

    const dateRange = customFrom && customTo
      ? { from: customFrom, to: customTo }
      : getDateRange(preset);

    const accessToken = await getZohoAccessToken();
    const callLogs = await fetchCallLogs(accessToken, dateRange.from, dateRange.to);

    // Calls by person
    const agentStats: Record<string, { inbound: number; outbound: number; missed: number; totalDuration: number; callCount: number }> = {};
    callLogs.forEach((call) => {
      const agent = call.agent_name || 'Unknown';
      if (!agentStats[agent]) {
        agentStats[agent] = { inbound: 0, outbound: 0, missed: 0, totalDuration: 0, callCount: 0 };
      }
      agentStats[agent].callCount++;
      agentStats[agent].totalDuration += call.call_duration || 0;

      const type = (call.call_type || '').toLowerCase();
      const status = (call.call_status || '').toLowerCase();

      if (status === 'missed' || status === 'no-answer' || status === 'no answer') {
        agentStats[agent].missed++;
      } else if (type === 'incoming' || type === 'inbound') {
        agentStats[agent].inbound++;
      } else if (type === 'outgoing' || type === 'outbound') {
        agentStats[agent].outbound++;
      }
    });

    // Daily call volume
    const dailyVolume: Record<string, { inbound: number; outbound: number; missed: number; total: number }> = {};
    callLogs.forEach((call) => {
      const date = (call.start_time || '').split('T')[0] || 'Unknown';
      if (!dailyVolume[date]) {
        dailyVolume[date] = { inbound: 0, outbound: 0, missed: 0, total: 0 };
      }
      dailyVolume[date].total++;

      const type = (call.call_type || '').toLowerCase();
      const status = (call.call_status || '').toLowerCase();

      if (status === 'missed' || status === 'no-answer' || status === 'no answer') {
        dailyVolume[date].missed++;
      } else if (type === 'incoming' || type === 'inbound') {
        dailyVolume[date].inbound++;
      } else if (type === 'outgoing' || type === 'outbound') {
        dailyVolume[date].outbound++;
      }
    });

    // Hourly call load
    const hourlyLoad: Record<string, number> = {};
    callLogs.forEach((call) => {
      const hour = new Date(call.start_time).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      hourlyLoad[hourKey] = (hourlyLoad[hourKey] || 0) + 1;
    });

    // Overview
    const totalCalls = callLogs.length;
    const inboundCalls = callLogs.filter((c) => (c.call_type || '').toLowerCase().includes('in')).length;
    const outboundCalls = callLogs.filter((c) => (c.call_type || '').toLowerCase().includes('out')).length;
    const missedCalls = callLogs.filter((c) => {
      const s = (c.call_status || '').toLowerCase();
      return s === 'missed' || s === 'no-answer' || s === 'no answer';
    }).length;
    const totalDuration = callLogs.reduce((sum, c) => sum + (c.call_duration || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCalls,
          inboundCalls,
          outboundCalls,
          missedCalls,
          totalDuration: Math.round(totalDuration / 60),
          avgCallDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
        },
        callsByPerson: Object.entries(agentStats)
          .map(([agentName, stats]) => ({
            agentName,
            inbound: stats.inbound,
            outbound: stats.outbound,
            missed: stats.missed,
            totalDuration: Math.round(stats.totalDuration / 60),
            avgDuration: stats.callCount > 0 ? Math.round(stats.totalDuration / stats.callCount) : 0,
          }))
          .sort((a, b) => (b.inbound + b.outbound + b.missed) - (a.inbound + a.outbound + a.missed)),
        dailyVolume: Object.entries(dailyVolume)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        hourlyLoad: Object.entries(hourlyLoad)
          .map(([hour, count]) => ({ hour, count }))
          .sort((a, b) => a.hour.localeCompare(b.hour)),
        dateRange,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Voice calls error:', error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}
