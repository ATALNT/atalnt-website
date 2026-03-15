// ============================================
// GET /api/voice/calls - Zoho Voice Call Data
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getZohoAccessToken, createAuthHeaders } from '../lib/zoho-auth';
import { verifyDashboardToken, corsHeaders } from '../lib/auth-middleware';

interface ZohoVoiceCallLog {
  id: string;
  call_type: string; // incoming, outgoing
  caller_number: string;
  receiver_number: string;
  agent_name: string;
  agent_email: string;
  queue_name: string;
  call_duration: number; // seconds
  start_time: string;
  end_time: string;
  call_status: string; // answered, missed, voicemail, etc.
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
      headers: createAuthHeaders(accessToken),
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
    if (page > 50) break; // Safety limit
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
    default:
      // Default to last 7 days
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: sevenDaysAgo.toISOString(), to };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (!verifyDashboardToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { preset = 'last_7_days', from: customFrom, to: customTo } = req.query as Record<string, string>;

    const dateRange = customFrom && customTo
      ? { from: customFrom, to: customTo }
      : getDateRange(preset);

    const accessToken = await getZohoAccessToken('voice');
    const callLogs = await fetchCallLogs(accessToken, dateRange.from, dateRange.to);

    // Aggregate: Calls by person
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

    // Aggregate: Daily call volume
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

    // Aggregate: Hourly call load
    const hourlyLoad: Record<string, number> = {};
    callLogs.forEach((call) => {
      const hour = new Date(call.start_time).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      hourlyLoad[hourKey] = (hourlyLoad[hourKey] || 0) + 1;
    });

    // Overview stats
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
          totalDuration: Math.round(totalDuration / 60), // minutes
          avgCallDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0, // seconds
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
