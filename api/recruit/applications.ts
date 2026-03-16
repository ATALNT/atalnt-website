// ============================================
// GET /api/recruit/applications - Pipeline & Application Data
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

// Zoho lookup fields can be string, {name,id}, {display_value,...}, etc.
function zohoStr(val: any, fallback = 'Unknown'): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.display_value || val.full_name || val.first_name || JSON.stringify(val);
  }
  return String(val);
}

// --- End inlined helpers ---

interface ZohoApplication {
  id: string;
  Candidate_Name: any;
  Job_Opening: any;
  Client_Name: any;
  Application_Status: string;
  Created_Time: string;
  Modified_Time: string;
  Assigned_Recruiter: any;
}

async function fetchApplications(accessToken: string, dateFrom?: string, dateTo?: string): Promise<ZohoApplication[]> {
  const allApps: ZohoApplication[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Applications?fields=Candidate_Name,Job_Opening,Client_Name,Application_Status,Created_Time,Modified_Time,Assigned_Recruiter&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 204) break;
      throw new Error(`Zoho Recruit API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.data) {
      allApps.push(...data.data);
    }

    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 25) break;
  }

  // Filter by date range if provided
  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() : Date.now();
    return allApps.filter((app) => {
      const created = new Date(app.Created_Time).getTime();
      return created >= from && created <= to;
    });
  }

  return allApps;
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
    const { from, to } = req.query as { from?: string; to?: string };
    const accessToken = await getZohoAccessToken();
    const applications = await fetchApplications(accessToken, from, to);

    // Pipeline by status
    const statusCounts: Record<string, number> = {};
    applications.forEach((app) => {
      const status = app.Application_Status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Submissions by recruiter
    const recruiterStats: Record<string, { submissions: number; interviews: number; hires: number }> = {};
    applications.forEach((app) => {
      const recruiter = zohoStr(app.Assigned_Recruiter, 'Unassigned');
      if (!recruiterStats[recruiter]) {
        recruiterStats[recruiter] = { submissions: 0, interviews: 0, hires: 0 };
      }
      recruiterStats[recruiter].submissions++;
      const status = (app.Application_Status || '').toLowerCase();
      if (status.includes('interview')) recruiterStats[recruiter].interviews++;
      if (status === 'hired') recruiterStats[recruiter].hires++;
    });

    // Applications by client
    const clientApps: Record<string, number> = {};
    applications.forEach((app) => {
      const client = zohoStr(app.Client_Name);
      clientApps[client] = (clientApps[client] || 0) + 1;
    });

    // Daily application volume (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyVolume: Record<string, number> = {};
    applications
      .filter((app) => new Date(app.Created_Time) >= thirtyDaysAgo)
      .forEach((app) => {
        const date = app.Created_Time.split('T')[0];
        dailyVolume[date] = (dailyVolume[date] || 0) + 1;
      });

    // This week and this month stats
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const submissionsThisWeek = applications.filter(
      (app) => new Date(app.Created_Time) >= startOfWeek
    ).length;
    const submissionsThisMonth = applications.filter(
      (app) => new Date(app.Created_Time) >= startOfMonth
    ).length;
    const hiresThisMonth = applications.filter(
      (app) =>
        new Date(app.Created_Time) >= startOfMonth &&
        (app.Application_Status || '').toLowerCase() === 'hired'
    ).length;

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalApplications: applications.length,
          submissionsThisWeek,
          submissionsThisMonth,
          hiresThisMonth,
        },
        pipelineByStatus: Object.entries(statusCounts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
        recruiterPerformance: Object.entries(recruiterStats)
          .map(([name, stats]) => ({ recruiterName: name, ...stats }))
          .sort((a, b) => b.submissions - a.submissions),
        applicationsByClient: Object.entries(clientApps)
          .map(([clientName, count]) => ({ clientName, count }))
          .sort((a, b) => b.count - a.count),
        dailyVolume: Object.entries(dailyVolume)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Recruit applications error:', error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}
