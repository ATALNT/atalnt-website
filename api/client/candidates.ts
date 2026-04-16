// ============================================
// GET /api/client/candidates - Client Portal Data
// Returns candidates submitted to a specific client
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TokenResponse { access_token: string; token_type: string; expires_in: number; api_domain: string; }
let cachedToken: { token: string; expiresAt: number } | null = null;

const CLIENT_CONFIG: Record<string, { secretEnv: string; matchTerms: string[] }> = {
  balfour: { secretEnv: 'BALFOUR_SECRET', matchTerms: ['balfour'] },
};

function verifyClientToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  for (const [slug, config] of Object.entries(CLIENT_CONFIG)) {
    const secret = process.env[config.secretEnv];
    if (secret && token === secret) return slug;
  }
  return null;
}

async function getZohoAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) return cachedToken.token;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing Zoho OAuth credentials');
  const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  if (!response.ok) throw new Error(`Zoho OAuth failed: ${response.status}`);
  const data: TokenResponse = await response.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function zohoStr(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.length === 0 ? fallback : zohoStr(val[0], fallback);
  if (typeof val === 'object') return val.name || val.display_value || val.full_name || fallback;
  return String(val);
}

async function fetchAllApplications(accessToken: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Applications?fields=Full_Name,First_Name,Last_Name,Application_Status,Job_Opening_Name,Client_Name,Created_Time,Updated_On,City,State,Assigned_Recruiter,Application_Owner&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) break;
    const data = await res.json();
    if (data.data) all.push(...data.data);
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 25) break;
  }
  return all;
}

async function fetchJobOpenings(accessToken: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Job_Openings?fields=Job_Opening_Name,Client_Name,Account_Name,Job_Opening_Status,City,State,Created_Time&page=${page}&per_page=200`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) break;
    const data = await res.json();
    if (data.data) all.push(...data.data);
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 10) break;
  }
  return all;
}

function matchesClient(record: any, matchTerms: string[]): boolean {
  const jobName = (record.Job_Opening_Name || '').toLowerCase();
  const clientName = zohoStr(record.Client_Name, '').toLowerCase();
  const accountName = zohoStr(record.Account_Name, '').toLowerCase();
  return matchTerms.some(term => jobName.includes(term) || clientName.includes(term) || accountName.includes(term));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientSlug = verifyClientToken(req);
  if (!clientSlug) return res.status(401).json({ error: 'Unauthorized' });

  const config = CLIENT_CONFIG[clientSlug];
  if (!config) return res.status(400).json({ error: 'Unknown client' });

  try {
    const accessToken = await getZohoAccessToken();

    const [allApplications, allJobs] = await Promise.all([
      fetchAllApplications(accessToken),
      fetchJobOpenings(accessToken),
    ]);

    // Find jobs matching this client
    const clientJobs = allJobs.filter(j => matchesClient(j, config.matchTerms));
    const clientJobNames = new Set(clientJobs.map(j => j.Job_Opening_Name));

    // Find applications for matching jobs OR with matching client name
    const clientApps = allApplications.filter(a =>
      clientJobNames.has(a.Job_Opening_Name) || matchesClient(a, config.matchTerms)
    );

    // Map to clean data (hide recruiter internal details)
    const candidates = clientApps.map(a => {
      const status = a.Application_Status || 'New';
      // Map internal statuses to client-friendly labels
      const statusMap: Record<string, string> = {
        'Associated': 'Submitted',
        'New': 'Submitted',
        'In-Review': 'Under Review',
        'Submitted-to-Client': 'Submitted to You',
        'Interview-Scheduled': 'Interview Scheduled',
        'Interview-in-Progress': 'Interview in Progress',
        'To-be-Offered': 'Offer Pending',
        'Offer-Accepted': 'Offer Accepted',
        'Hired': 'Hired',
        'Rejected': 'Not Selected',
        'Rejected-by-Client': 'Not Selected',
        'On Hold': 'On Hold',
        'Withdrawn': 'Withdrawn',
      };
      const friendlyStatus = statusMap[status] || status.replace(/-/g, ' ');

      return {
        candidateName: a.Full_Name || 'Unknown',
        firstName: a.First_Name || '',
        lastName: a.Last_Name || '',
        jobTitle: a.Job_Opening_Name || 'Unknown',
        status: friendlyStatus,
        rawStatus: status,
        city: zohoStr(a.City, ''),
        state: zohoStr(a.State, ''),
        submittedDate: a.Created_Time || '',
        lastUpdated: a.Updated_On || '',
      };
    }).sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime());

    // Summary stats
    const statusCounts: Record<string, number> = {};
    candidates.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const jobs = clientJobs.map(j => ({
      jobTitle: j.Job_Opening_Name || 'Unknown',
      status: j.Job_Opening_Status || 'Open',
      city: zohoStr(j.City, ''),
      state: zohoStr(j.State, ''),
      createdDate: j.Created_Time || '',
      candidateCount: clientApps.filter(a => a.Job_Opening_Name === j.Job_Opening_Name).length,
    }));

    return res.status(200).json({
      success: true,
      data: {
        clientName: clientSlug.charAt(0).toUpperCase() + clientSlug.slice(1),
        totalCandidates: candidates.length,
        totalJobs: jobs.length,
        statusCounts,
        candidates,
        jobs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Client portal API error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
