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

// Zoho lookup fields can be string, {name,id}, [{name,id}], etc.
function zohoStr(val: any, fallback = 'Unknown'): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return fallback;
    return zohoStr(val[0], fallback);
  }
  if (typeof val === 'object') {
    return val.name || val.display_value || val.full_name || fallback;
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

// ============================================
// GET /api/recruit/jobs?q=<text> - Global dashboard search
// Candidates (with every job they're on) and clients (Recruit jobs + CRM accounts).
// Lives in this function because the Hobby plan caps the project at 12 functions.
// ============================================

const RECRUIT_ORG = '896681960';
const CRM_ORG = '898500281';

// Preview deployments don't get ZOHO_REFRESH_TOKEN; fall back to the EXEC_ZOHO_* client there.
let cachedSearchToken: { token: string; expiresAt: number } | null = null;

async function getSearchToken(): Promise<string> {
  if (process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN) {
    return getZohoAccessToken();
  }
  if (cachedSearchToken && Date.now() < cachedSearchToken.expiresAt - 60000) return cachedSearchToken.token;
  const { EXEC_ZOHO_CLIENT_ID: id, EXEC_ZOHO_CLIENT_SECRET: secret, EXEC_ZOHO_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) throw new Error('Missing Zoho OAuth credentials');
  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh }).toString(),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error(`Zoho OAuth failed: ${response.status}`);
  cachedSearchToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Zoho search returns 204 for no matches and 400 for a criteria it can't run; both mean "nothing"
async function zohoSearch(url: string, accessToken: string): Promise<any[]> {
  const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  if (!response.ok || response.status === 204) return [];
  const data = await response.json();
  return data.data || [];
}

function recruitSearchUrl(module: string, criteria: string, perPage: number): string {
  return `https://recruit.zoho.com/recruit/v2/${module}/search?criteria=${encodeURIComponent(criteria)}&per_page=${perPage}`;
}

async function handleSearch(rawQuery: string, res: VercelResponse) {
  // Strip characters that would break Zoho's criteria syntax
  const q = rawQuery.replace(/[(),:\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return res.status(200).json({ success: true, data: { query: q, candidates: [], clients: [] } });

  const accessToken = await getSearchToken();
  const words = q.split(' ');
  const nameCriteria = words.length > 1
    ? `((Full_Name:starts_with:${q})or((First_Name:starts_with:${words[0]})and(Last_Name:starts_with:${words[words.length - 1]})))`
    : `((Full_Name:starts_with:${q})or(Last_Name:starts_with:${q})or(Email:starts_with:${q}))`;
  const appCriteria = words.length > 1
    ? `((Full_Name:starts_with:${q})or((First_Name:starts_with:${words[0]})and(Last_Name:starts_with:${words[words.length - 1]})))`
    : `((Full_Name:starts_with:${q})or(Last_Name:starts_with:${q}))`;

  const [candidates, applications, clientJobs, crmAccounts] = await Promise.all([
    zohoSearch(recruitSearchUrl('Candidates', nameCriteria, 10), accessToken),
    zohoSearch(recruitSearchUrl('Applications', appCriteria, 40), accessToken),
    zohoSearch(recruitSearchUrl('Job_Openings', `(Client:starts_with:${q})`, 50), accessToken),
    zohoSearch(`https://www.zohoapis.com/crm/v8/Accounts/search?word=${encodeURIComponent(q)}&per_page=10`, accessToken),
  ]);

  // Applications carry the job but not always its client, so look up each job once
  const jobIds = [...new Set(applications.map((a: any) => a.$Job_Opening_Id).filter(Boolean))].slice(0, 15);
  const jobs = await Promise.all(jobIds.map(async (id) => {
    const r = await fetch(`https://recruit.zoho.com/recruit/v2/Job_Openings/${id}`, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!r.ok || r.status === 204) return null;
    return ((await r.json()).data || [])[0] || null;
  }));
  const jobById = new Map(jobs.filter(Boolean).map((j: any) => [j.id, j]));

  const appsByCandidate = new Map<string, any[]>();
  applications.forEach((a: any) => {
    const job = jobById.get(a.$Job_Opening_Id);
    const entry = {
      jobTitle: a.Job_Opening_Name || a.Posting_Title || 'Unknown job',
      clientName: zohoStr(a.Client, '') || zohoStr(job?.Client, '') || zohoStr(a.Client_Name, ''),
      status: a.Application_Status || 'Unknown',
      recruiter: zohoStr(a.Assigned_Recruiter, '') || zohoStr(a.Application_Owner, ''),
      updated: a.Updated_On || a.Created_Time || null,
    };
    const key = a.$Candidate_Id || a.Full_Name;
    if (!appsByCandidate.has(key)) appsByCandidate.set(key, []);
    appsByCandidate.get(key)!.push(entry);
  });

  const candidateResults = candidates.map((c: any) => ({
    id: c.id,
    name: c.Full_Name || `${c.First_Name || ''} ${c.Last_Name || ''}`.trim(),
    email: c.Email || '',
    title: c.Current_Job_Title || '',
    location: [c.City, c.State].filter(Boolean).join(', '),
    sourcer: zohoStr(c.Recruiter, ''),
    owner: zohoStr(c.Candidate_Owner, ''),
    created: c.Created_Time || null,
    applications: (appsByCandidate.get(c.id) || appsByCandidate.get(c.Full_Name) || [])
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated))),
    url: `https://recruit.zoho.com/recruit/org${RECRUIT_ORG}/EntityInfo.do?module=Candidates&id=${c.id}`,
  }));

  const clientMap = new Map<string, any>();
  clientJobs.forEach((j: any) => {
    const name = zohoStr(j.Client, '') || 'Unknown client';
    if (!clientMap.has(name.toLowerCase())) {
      clientMap.set(name.toLowerCase(), { name, openRoles: 0, totalRoles: 0, roles: [] as any[], crmUrl: null as string | null });
    }
    const c = clientMap.get(name.toLowerCase());
    c.totalRoles++;
    if ((j.Job_Opening_Status || '').toLowerCase() === 'in-progress') c.openRoles++;
    c.roles.push({
      title: j.Posting_Title || 'Untitled',
      status: j.Job_Opening_Status || 'Unknown',
      priority: zohoStr(j.Priority1, ''),
      opsManager: zohoStr(j.Account_Manager, ''),
      url: `https://recruit.zoho.com/recruit/org${RECRUIT_ORG}/EntityInfo.do?module=JobOpenings&id=${j.id}`,
    });
  });
  crmAccounts.forEach((acc: any) => {
    const name = acc.Account_Name || 'Unknown account';
    const match = [...clientMap.values()].find((c) => c.name.toLowerCase().startsWith(name.toLowerCase().split(' ')[0]));
    const url = `https://crm.zoho.com/crm/org${CRM_ORG}/tab/Accounts/${acc.id}`;
    if (match) match.crmUrl = match.crmUrl || url;
    else clientMap.set(name.toLowerCase(), { name, openRoles: 0, totalRoles: 0, roles: [], crmUrl: url });
  });
  const statusRank = (s: string) => (s.toLowerCase() === 'in-progress' ? 0 : s.toLowerCase() === 'paused' ? 1 : 2);
  const clientResults = [...clientMap.values()]
    .map((c) => ({ ...c, roles: c.roles.sort((a: any, b: any) => statusRank(a.status) - statusRank(b.status)) }))
    .sort((a, b) => b.openRoles - a.openRoles || a.name.localeCompare(b.name))
    .slice(0, 10);

  return res.status(200).json({
    success: true,
    data: { query: q, candidates: candidateResults, clients: clientResults },
    timestamp: new Date().toISOString(),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyDashboardToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (typeof req.query.q === 'string') {
    try {
      return await handleSearch(req.query.q, res);
    } catch (error) {
      console.error('Dashboard search error:', error);
      return res.status(500).json({ success: false, error: String(error) });
    }
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
