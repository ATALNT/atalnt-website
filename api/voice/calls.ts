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

async function fetchSmsLogs(accessToken: string, from: string, to: string): Promise<any[]> {
  const allLogs: any[] = [];
  let startIndex = 0;
  const pageSize = 200;
  let hasMore = true;

  // SMS API uses yyyymmdd HH:MM format
  const fromDt = new Date(from);
  const toDt = new Date(to);
  const fromDate = `${fromDt.getFullYear()}${String(fromDt.getMonth() + 1).padStart(2, '0')}${String(fromDt.getDate()).padStart(2, '0')} 00:00`;
  const toDate = `${toDt.getFullYear()}${String(toDt.getMonth() + 1).padStart(2, '0')}${String(toDt.getDate()).padStart(2, '0')} 23:59`;

  while (hasMore) {
    const params = new URLSearchParams({
      from: String(startIndex),
      size: String(pageSize),
      fromDate,
      toDate,
      messageType: 'All',
    });

    const url = `https://voice.zoho.com/rest/json/v1/sms/logs?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 204) break;
      // If SMS scope isn't available, return empty gracefully
      if (response.status === 401 || response.status === 403) {
        console.warn('SMS API not authorized - may need ZohoVoice.sms.READ scope');
        return [];
      }
      const errorText = await response.text();
      console.error(`SMS API error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();

    if (data.smsLogQuery && Array.isArray(data.smsLogQuery)) {
      allLogs.push(...data.smsLogQuery);
      const totalRecords = data.meta?.total || 0;
      startIndex += pageSize;
      hasMore = startIndex < totalRecords;
    } else {
      hasMore = false;
    }

    if (startIndex > 5000) break;
  }

  return allLogs;
}

async function fetchCallLogs(accessToken: string, from: string, to: string): Promise<any[]> {
  const allLogs: any[] = [];
  let startIndex = 0;
  const pageSize = 200;
  let hasMore = true;

  // Format dates as YYYY-MM-DD for Zoho Voice API
  const fromDate = from.split('T')[0];
  const toDate = to.split('T')[0];

  while (hasMore) {
    const params = new URLSearchParams({
      from: String(startIndex),
      size: String(pageSize),
      fromDate,
      toDate,
    });

    const url = `https://voice.zoho.com/rest/json/zv/logs?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 204) break;
      const errorText = await response.text();
      throw new Error(`Zoho Voice API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.logs && Array.isArray(data.logs)) {
      allLogs.push(...data.logs);
      const totalRecords = data.meta?.total || 0;
      startIndex += pageSize;
      hasMore = startIndex < totalRecords;
    } else {
      hasMore = false;
    }

    if (startIndex > 5000) break; // Safety limit
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
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      return { from: start.toISOString(), to };
    }
    case 'last_90_days': {
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { from: ninetyDaysAgo.toISOString(), to };
    }
    case 'all_time': {
      return { from: '2020-01-01T00:00:00.000Z', to };
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
    const [callLogs, smsLogs] = await Promise.all([
      fetchCallLogs(accessToken, dateRange.from, dateRange.to),
      fetchSmsLogs(accessToken, dateRange.from, dateRange.to),
    ]);

    // Helper to get field value flexibly (Zoho Voice field names)
    function getField(obj: any, ...keys: string[]): string {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) {
          const val = obj[k];
          if (typeof val === 'object' && val.name) return val.name;
          return String(val);
        }
      }
      return '';
    }

    // Parse duration string "MM:SS" or "HH:MM:SS" to seconds
    function parseDuration(call: any): number {
      const durStr = call.duration || '';
      if (typeof durStr === 'string' && durStr.includes(':')) {
        const parts = durStr.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
      }
      // Fallback: calculate from start_time and end_time (epoch ms)
      const start = Number(call.start_time || 0);
      const end = Number(call.end_time || 0);
      if (start > 0 && end > start) return Math.round((end - start) / 1000);
      return Number(durStr) || 0;
    }

    // Calls by person
    const agentStats: Record<string, { inbound: number; outbound: number; missed: number; totalDuration: number; callCount: number }> = {};
    callLogs.forEach((call) => {
      const agent = getField(call, 'agent_number', 'agent_name', 'agentName', 'Agent_Name', 'user_name') || 'Unknown';
      if (!agentStats[agent]) {
        agentStats[agent] = { inbound: 0, outbound: 0, missed: 0, totalDuration: 0, callCount: 0 };
      }
      agentStats[agent].callCount++;
      agentStats[agent].totalDuration += parseDuration(call);

      const type = getField(call, 'call_type', 'callType', 'type', 'direction').toLowerCase();
      const status = getField(call, 'call_status', 'callStatus', 'status', 'disposition', 'hangup_cause').toLowerCase();

      if (status === 'missed' || status === 'no-answer' || status === 'no answer' || status === 'noanswer' || status === 'no_answer' || status === 'originator_cancel' || type === 'missed') {
        agentStats[agent].missed++;
      } else if (type.includes('in') || type === 'incoming' || type === 'inbound') {
        agentStats[agent].inbound++;
      } else if (type.includes('out') || type === 'outgoing' || type === 'outbound') {
        agentStats[agent].outbound++;
      }
    });

    // Daily call volume
    const dailyVolume: Record<string, { inbound: number; outbound: number; missed: number; total: number }> = {};
    callLogs.forEach((call) => {
      const timeStr = getField(call, 'start_time', 'startTime', 'Start_Time', 'callTime', 'createdTime', 'created_time');
      let date = 'Unknown';
      if (timeStr) {
        // Handle epoch ms or ISO string
        const parsed = Number(timeStr) > 1e12 ? new Date(Number(timeStr)) : new Date(timeStr);
        if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
      }
      if (!dailyVolume[date]) {
        dailyVolume[date] = { inbound: 0, outbound: 0, missed: 0, total: 0 };
      }
      dailyVolume[date].total++;

      const type = getField(call, 'call_type', 'callType', 'type', 'direction').toLowerCase();
      const status = getField(call, 'call_status', 'callStatus', 'status', 'disposition', 'hangup_cause').toLowerCase();

      if (status === 'missed' || status === 'no-answer' || status === 'no answer' || status === 'noanswer' || status === 'no_answer' || status === 'originator_cancel' || type === 'missed') {
        dailyVolume[date].missed++;
      } else if (type.includes('in') || type === 'incoming' || type === 'inbound') {
        dailyVolume[date].inbound++;
      } else if (type.includes('out') || type === 'outgoing' || type === 'outbound') {
        dailyVolume[date].outbound++;
      }
    });

    // Hourly call load
    const hourlyLoad: Record<string, number> = {};
    callLogs.forEach((call) => {
      const timeStr = getField(call, 'start_time', 'startTime', 'Start_Time', 'callTime', 'createdTime', 'created_time');
      if (timeStr) {
        const parsed = Number(timeStr) > 1e12 ? new Date(Number(timeStr)) : new Date(timeStr);
        if (!isNaN(parsed.getTime())) {
          const hourKey = `${parsed.getHours().toString().padStart(2, '0')}:00`;
          hourlyLoad[hourKey] = (hourlyLoad[hourKey] || 0) + 1;
        }
      }
    });

    // Overview
    const totalCalls = callLogs.length;
    const inboundCalls = callLogs.filter((c) => {
      const t = getField(c, 'call_type', 'callType', 'type', 'direction').toLowerCase();
      return t === 'incoming' || t === 'inbound';
    }).length;
    const outboundCalls = callLogs.filter((c) => {
      const t = getField(c, 'call_type', 'callType', 'type', 'direction').toLowerCase();
      return t === 'outgoing' || t === 'outbound';
    }).length;
    const missedCalls = callLogs.filter((c) => {
      const t = getField(c, 'call_type', 'callType', 'type', 'direction').toLowerCase();
      return t === 'missed';
    }).length;
    const totalDuration = callLogs.reduce((sum, c) => sum + parseDuration(c), 0);

    // === SMS Aggregation ===
    const totalSms = smsLogs.length;
    const inboundSms = smsLogs.filter((s) => (s.messageType || '').toUpperCase() === 'INCOMING').length;
    const outboundSms = smsLogs.filter((s) => (s.messageType || '').toUpperCase() === 'OUTGOING').length;

    // SMS by person
    const smsAgentStats: Record<string, { incoming: number; outgoing: number; total: number }> = {};
    smsLogs.forEach((sms) => {
      const agent = sms.userName || sms.senderIdName || 'Unknown';
      if (!smsAgentStats[agent]) {
        smsAgentStats[agent] = { incoming: 0, outgoing: 0, total: 0 };
      }
      smsAgentStats[agent].total++;
      const msgType = (sms.messageType || '').toUpperCase();
      if (msgType === 'INCOMING') smsAgentStats[agent].incoming++;
      else if (msgType === 'OUTGOING') smsAgentStats[agent].outgoing++;
    });

    // Daily SMS volume
    const dailySmsVolume: Record<string, { incoming: number; outgoing: number; total: number }> = {};
    smsLogs.forEach((sms) => {
      const timeStr = sms.sentTime || sms.submittedTime || '';
      let date = 'Unknown';
      if (timeStr) {
        const parsed = Number(timeStr) > 1e12 ? new Date(Number(timeStr)) : new Date(timeStr);
        if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
      }
      if (!dailySmsVolume[date]) {
        dailySmsVolume[date] = { incoming: 0, outgoing: 0, total: 0 };
      }
      dailySmsVolume[date].total++;
      const msgType = (sms.messageType || '').toUpperCase();
      if (msgType === 'INCOMING') dailySmsVolume[date].incoming++;
      else if (msgType === 'OUTGOING') dailySmsVolume[date].outgoing++;
    });

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
          totalSms,
          inboundSms,
          outboundSms,
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
        smsByPerson: Object.entries(smsAgentStats)
          .map(([agentName, stats]) => ({ agentName, ...stats }))
          .sort((a, b) => b.total - a.total),
        dailyVolume: Object.entries(dailyVolume)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        dailySmsVolume: Object.entries(dailySmsVolume)
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
