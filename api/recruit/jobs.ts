// ============================================
// GET /api/recruit/jobs - Recruit Job Openings Data
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

interface ZohoJobOpening {
  id: string;
  Posting_Title: string;
  Client_Name: any; // Can be string or {name, id} lookup
  Job_Opening_Status: string;
  Number_of_Positions: number;
  Number_of_Associated_Candidates: number;
  Priority: string;
  Assigned_Recruiter: { name: string; id: string } | null;
  Created_Time: string;
  Modified_Time: string;
  Target_Date: string | null;
  City: string;
  Job_Type: string;
  Is_Hot_Job_Opening: boolean;
}

async function fetchAllJobs(accessToken: string): Promise<ZohoJobOpening[]> {
  const allJobs: ZohoJobOpening[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Job_Openings?fields=Posting_Title,Client_Name,Job_Opening_Status,Number_of_Positions,Number_of_Associated_Candidates,Priority,Assigned_Recruiter,Created_Time,Modified_Time,Target_Date,City,Job_Type,Is_Hot_Job_Opening&page=${page}&per_page=200`;

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
      allJobs.push(...data.data);
    }

    hasMore = data.info?.more_records ?? false;
    page++;
  }

  return allJobs;
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
    const accessToken = await getZohoAccessToken();
    const jobs = await fetchAllJobs(accessToken);

    // Aggregate: Jobs by Client
    const jobsByClient: Record<string, { inProgress: number; filled: number; onHold: number; inactive: number; total: number }> = {};
    jobs.forEach((job) => {
      const client = zohoStr(job.Client_Name);
      if (!jobsByClient[client]) {
        jobsByClient[client] = { inProgress: 0, filled: 0, onHold: 0, inactive: 0, total: 0 };
      }
      jobsByClient[client].total++;
      const status = (job.Job_Opening_Status || '').toLowerCase();
      if (status === 'in-progress') jobsByClient[client].inProgress++;
      else if (status === 'filled') jobsByClient[client].filled++;
      else if (status === 'on-hold' || status === 'on hold') jobsByClient[client].onHold++;
      else if (status === 'inactive') jobsByClient[client].inactive++;
    });

    // Pipeline status counts
    const statusCounts: Record<string, number> = {};
    jobs.forEach((job) => {
      const status = job.Job_Opening_Status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Zero submission jobs (in-progress only)
    const zeroSubmissionJobs = jobs
      .filter(
        (job) =>
          (job.Job_Opening_Status || '').toLowerCase() === 'in-progress' &&
          (job.Number_of_Associated_Candidates ?? 0) === 0
      )
      .map((job) => ({
        jobId: job.id,
        postingTitle: job.Posting_Title,
        clientName: zohoStr(job.Client_Name),
        numberOfPositions: job.Number_of_Positions || 1,
        daysOpen: Math.floor((Date.now() - new Date(job.Created_Time).getTime()) / (1000 * 60 * 60 * 24)),
        priority: job.Priority || 'N/A',
      }));

    // Overview stats
    const activeJobs = jobs.filter((j) => (j.Job_Opening_Status || '').toLowerCase() === 'in-progress');
    const overview = {
      totalOpenJobs: activeJobs.length,
      totalJobs: jobs.length,
      filledJobs: jobs.filter((j) => (j.Job_Opening_Status || '').toLowerCase() === 'filled').length,
      onHoldJobs: jobs.filter((j) => (j.Job_Opening_Status || '').toLowerCase().includes('hold')).length,
      zeroSubmissionCount: zeroSubmissionJobs.length,
    };

    return res.status(200).json({
      success: true,
      data: {
        overview,
        jobsByClient: Object.entries(jobsByClient)
          .map(([clientName, data]) => ({ clientName, ...data }))
          .sort((a, b) => b.inProgress - a.inProgress),
        statusCounts: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        zeroSubmissionJobs: zeroSubmissionJobs.sort((a, b) => b.daysOpen - a.daysOpen),
        totalRecords: jobs.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Recruit jobs error:', error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}
