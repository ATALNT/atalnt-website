// ============================================
// /api/client/portal - Multi-portal handler
// POST = login, GET = data (Balfour=Recruit, Sales=CRM)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TokenResponse { access_token: string; token_type: string; expires_in: number; api_domain: string; }
let cachedRecruitToken: { token: string; expiresAt: number } | null = null;
let cachedCrmToken: { token: string; expiresAt: number } | null = null;
let cachedSignToken: { token: string; expiresAt: number } | null = null;

const CLIENT_CONFIG: Record<string, {
  passwordEnv: string; secretEnv: string; displayName: string;
  type: 'recruit' | 'sales'; matchTerms?: string[];
}> = {
  balfour: { passwordEnv: 'BALFOUR_PASSWORD', secretEnv: 'BALFOUR_SECRET', displayName: 'Balfour & Co', type: 'recruit', matchTerms: ['balfour'] },
  sales:   { passwordEnv: 'SALES_PASSWORD',   secretEnv: 'SALES_SECRET',   displayName: 'ATALNT Sales', type: 'sales' },
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

function zohoStr(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.length === 0 ? fallback : zohoStr(val[0], fallback);
  if (typeof val === 'object') return val.name || val.display_value || val.full_name || fallback;
  return String(val);
}

async function getOAuthToken(
  clientId: string | undefined, clientSecret: string | undefined, refreshToken: string | undefined,
  cache: { token: string; expiresAt: number } | null, baseUrl = 'https://accounts.zoho.com'
): Promise<{ token: string; cache: { token: string; expiresAt: number } }> {
  if (cache && Date.now() < cache.expiresAt - 60000) return { token: cache.token, cache };
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing OAuth credentials');
  const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
  const resp = await fetch(`${baseUrl}/oauth/v2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  if (!resp.ok) throw new Error(`OAuth failed: ${resp.status}`);
  const data: TokenResponse = await resp.json();
  const newCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return { token: data.access_token, cache: newCache };
}

async function getZohoRecruitToken(): Promise<string> {
  const result = await getOAuthToken(process.env.ZOHO_CLIENT_ID, process.env.ZOHO_CLIENT_SECRET, process.env.ZOHO_REFRESH_TOKEN, cachedRecruitToken);
  cachedRecruitToken = result.cache;
  return result.token;
}

async function getZohoCrmToken(): Promise<string> {
  const result = await getOAuthToken(process.env.ZOHO_CLIENT_ID, process.env.ZOHO_CLIENT_SECRET, process.env.ZOHO_REFRESH_TOKEN, cachedCrmToken);
  cachedCrmToken = result.cache;
  return result.token;
}

async function getZohoSignToken(): Promise<string | null> {
  try {
    const result = await getOAuthToken(process.env.ZOHO_CLIENT_ID, process.env.ZOHO_CLIENT_SECRET, process.env.ZOHO_SIGN_REFRESH_TOKEN, cachedSignToken);
    cachedSignToken = result.cache;
    return result.token;
  } catch { return null; }
}

async function fetchRecruitModule(accessToken: string, module: string, fields: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const url = `https://recruit.zoho.com/recruit/v2/${module}?fields=${fields}&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) break;
    const data = await res.json();
    if (data.data) all.push(...data.data);
    if (!data.info?.more_records || page >= 25) break;
    page++;
  }
  return all;
}

async function fetchCrmModule(accessToken: string, module: string, fields: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const url = `https://www.zohoapis.com/crm/v2/${module}?fields=${fields}&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) break;
    const data = await res.json();
    if (data.data) all.push(...data.data);
    if (!data.info?.more_records || page >= 25) break;
    page++;
  }
  return all;
}

// ─── Login handler ───────────────────────────
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  let password: string | undefined;
  let clientSlug: string | undefined;
  if (req.body && typeof req.body === 'object') { password = req.body.password; clientSlug = req.body.client; }
  else if (req.body && typeof req.body === 'string') {
    try { const p = JSON.parse(req.body); password = p?.password; clientSlug = p?.client; } catch {}
  }
  if (!password || !clientSlug) return res.status(400).json({ error: 'Password and client required' });
  const config = CLIENT_CONFIG[clientSlug.toLowerCase()];
  if (!config) return res.status(400).json({ error: 'Unknown client' });
  const clientPassword = process.env[config.passwordEnv];
  const clientSecret = process.env[config.secretEnv];
  if (!clientPassword || !clientSecret) return res.status(500).json({ error: 'Server config error' });
  if (password !== clientPassword) return res.status(401).json({ error: 'Invalid password' });
  return res.status(200).json({ token: clientSecret, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
}

// ─── Balfour (Recruit) data ───────────────────
async function handleRecruitData(config: typeof CLIENT_CONFIG[string], res: VercelResponse) {
  const accessToken = await getZohoRecruitToken();
  const [allApplications, allJobs] = await Promise.all([
    fetchRecruitModule(accessToken, 'Applications', 'id,Full_Name,First_Name,Last_Name,Application_Status,Job_Opening_Name,Client_Name,Created_Time,Updated_On,City,State'),
    fetchRecruitModule(accessToken, 'Job_Openings', 'Job_Opening_Name,Client_Name,Account_Name,Client,Job_Opening_Status,City,State,Created_Time,Number_of_Positions,Priority1'),
  ]);

  const matchTerms = config.matchTerms || [];
  const clientJobs = allJobs.filter(j => {
    const client = zohoStr(j.Client, '').toLowerCase();
    const clientName = zohoStr(j.Client_Name, '').toLowerCase();
    const accountName = zohoStr(j.Account_Name, '').toLowerCase();
    return matchTerms.some(term => client.includes(term) || clientName.includes(term) || accountName.includes(term));
  });
  const clientJobNames = new Set(clientJobs.map(j => j.Job_Opening_Name));

  const INTERNAL_ONLY = new Set(['associated','applied','new','in-review','rejected by ops','rejected-by-ops','unqualified','withdrawn','on hold','on-hold','archived','inactive']);
  const clientApplications = allApplications
    .filter(a => clientJobNames.has(a.Job_Opening_Name))
    .filter(a => !INTERNAL_ONLY.has((a.Application_Status || '').toLowerCase().trim()));

  const statusMap: Record<string, string> = {
    'submitted-to-client': 'Submitted', 'submitted-to-hiring manager': 'Submitted', 'submitted-to-hiring-manager': 'Submitted',
    'interview-scheduled': 'Interview Scheduled', 'interview scheduled': 'Interview Scheduled',
    '2nd interview-scheduled': '2nd Interview', '3rd interview-scheduled': '3rd Interview',
    'interview-in-progress': 'Interview in Progress',
    'interviewed - rejected': 'Not Selected', 'interviewed-rejected': 'Not Selected',
    'rejected by hiring manager': 'Not Selected', 'rejected-by-hiring-manager': 'Not Selected',
    'to-be-offered': 'Offer Pending', 'offer-accepted': 'Offer Accepted', 'hired': 'Hired',
    'rejected': 'Not Selected', 'rejected-by-client': 'Not Selected',
    'on hold': 'On Hold', 'on-hold': 'On Hold', 'qualified': 'Under Review',
  };

  const notesMap: Record<string, Array<{ note: string; date: string; by: string }>> = {};
  await Promise.all(clientApplications.map(async (a) => {
    if (!a.id) return;
    try {
      const resp = await fetch(`https://recruit.zoho.com/recruit/v2/Applications/${a.id}/Notes?per_page=50`, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.data?.length > 0) {
        notesMap[a.id] = data.data.map((n: any) => ({
          note: n.Note_Content || '', date: n.Created_Time || n.Modified_Time || '',
          by: zohoStr(n.Created_By, '') || zohoStr(n.Owner, ''),
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    } catch {}
  }));

  const candidates = clientApplications.map(a => {
    const status = a.Application_Status || 'New';
    return {
      id: a.id || '', candidateName: a.Full_Name || 'Unknown',
      firstName: a.First_Name || '', lastName: a.Last_Name || '',
      jobTitle: a.Job_Opening_Name || 'Unknown',
      status: statusMap[status.toLowerCase().trim()] || status.replace(/-/g, ' '),
      rawStatus: status, city: zohoStr(a.City, ''), state: zohoStr(a.State, ''),
      submittedDate: a.Created_Time || '', lastUpdated: a.Updated_On || '',
      notes: notesMap[a.id] || [],
    };
  }).sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime());

  const statusCounts: Record<string, number> = {};
  candidates.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  const jobs = clientJobs.map(j => ({
    jobTitle: j.Job_Opening_Name || 'Unknown', status: j.Job_Opening_Status || 'Open',
    city: zohoStr(j.City, ''), state: zohoStr(j.State, ''),
    numberOfPositions: j.Number_of_Positions || 1, createdDate: j.Created_Time || '',
    candidateCount: clientApplications.filter(a => a.Job_Opening_Name === j.Job_Opening_Name).length,
  }));

  const roleMap: Record<string, any> = {};
  for (const j of jobs) {
    const key = j.jobTitle;
    if (!roleMap[key]) roleMap[key] = { jobTitle: j.jobTitle, status: j.status, city: j.city, state: j.state, numberOfPositions: j.numberOfPositions, createdDate: j.createdDate, totalSubmissions: 0, inInterview: 0, hired: 0, rejected: 0, active: 0 };
    roleMap[key].totalSubmissions += j.candidateCount;
  }
  for (const c of candidates) {
    const role = roleMap[c.jobTitle]; if (!role) continue;
    const raw = (c.rawStatus || '').toLowerCase();
    if (raw.includes('interview')) role.inInterview++;
    else if (raw === 'hired') role.hired++;
    else if (raw.includes('reject') || raw === 'unqualified') role.rejected++;
    else if (!['withdrawn', 'on hold'].includes(raw)) role.active++;
  }
  const rolesSummary = Object.values(roleMap).filter((r: any) => r.status.toLowerCase() === 'in-progress').sort((a: any, b: any) => b.totalSubmissions - a.totalSubmissions);

  return res.status(200).json({
    success: true,
    data: { portalType: 'recruit', clientName: config.displayName, totalCandidates: candidates.length, totalJobs: jobs.length, activeRoles: rolesSummary.length, statusCounts, candidates, jobs, rolesSummary },
    timestamp: new Date().toISOString(),
  });
}

// ─── Sales (CRM) data ────────────────────────
// Scope every metric to this owner's activity only (case-insensitive substring match).
const SALES_OWNER_FILTER = 'kavya';

async function handleSalesData(config: typeof CLIENT_CONFIG[string], res: VercelResponse) {
  const crmToken = await getZohoCrmToken();
  const signToken = await getZohoSignToken();

  const [leadsRaw, dealsRaw, accountsRaw, callsRaw] = await Promise.all([
    fetchCrmModule(crmToken, 'Leads', 'First_Name,Last_Name,Full_Name,Lead_Source,Lead_Status,Owner,Created_Time,Phone,Email,Company'),
    fetchCrmModule(crmToken, 'Deals', 'Deal_Name,Stage,Amount,Close_Date,Account_Name,Owner,Created_Time,Probability'),
    fetchCrmModule(crmToken, 'Accounts', 'Account_Name,Phone,Website,Industry,Owner,Created_Time,Billing_City,Billing_State'),
    fetchCrmModule(crmToken, 'Calls', 'Subject,Status,Duration_in_seconds,Owner,Created_Time,Call_Type'),
  ]);

  // Filter all CRM records to the scoped owner
  const ownerMatches = (rec: any) => zohoStr(rec?.Owner, '').toLowerCase().includes(SALES_OWNER_FILTER);
  const leads = leadsRaw.filter(ownerMatches);
  const deals = dealsRaw.filter(ownerMatches);
  const accounts = accountsRaw.filter(ownerMatches);
  const calls = callsRaw.filter(ownerMatches);

  // Fetch Zoho Sign documents if token available (also filtered by owner)
  let signDocuments: any[] = [];
  if (signToken) {
    try {
      const signResp = await fetch('https://sign.zoho.com/api/v1/requests?limit=100', { headers: { Authorization: `Zoho-oauthtoken ${signToken}` } });
      if (signResp.ok) {
        const signData = await signResp.json();
        const docs = signData?.requests?.list || [];
        signDocuments = docs.map((d: any) => ({
          documentName: d.request_name || 'Untitled',
          status: d.request_status || 'Unknown',
          createdTime: d.created_time || '',
          owner: d.owner_first_name ? `${d.owner_first_name} ${d.owner_last_name || ''}`.trim() : 'Unknown',
          recipients: (d.actions || []).map((a: any) => ({ name: `${a.recipient_name || ''}`.trim(), email: a.recipient_email || '', status: a.action_status || '' })),
        })).filter((d: any) => (d.owner || '').toLowerCase().includes(SALES_OWNER_FILTER));
      }
    } catch {}
  }

  // Overview stats
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const newLeads30d = leads.filter(l => new Date(l.Created_Time) >= thirtyDaysAgo).length;
  const openDeals = deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.Stage || ''));
  const closedWon = deals.filter(d => d.Stage === 'Closed Won');
  const totalRevenue = closedWon.reduce((sum: number, d: any) => sum + (parseFloat(d.Amount) || 0), 0);

  // Leads by status
  const leadsByStatus: Record<string, number> = {};
  leads.forEach(l => { const s = l.Lead_Status || 'Unknown'; leadsByStatus[s] = (leadsByStatus[s] || 0) + 1; });

  // Leads by source
  const leadsBySource: Record<string, number> = {};
  leads.forEach(l => { const s = l.Lead_Source || 'Unknown'; leadsBySource[s] = (leadsBySource[s] || 0) + 1; });

  // Deals by stage
  const dealsByStage: Record<string, { count: number; value: number }> = {};
  deals.forEach(d => {
    const s = d.Stage || 'Unknown';
    if (!dealsByStage[s]) dealsByStage[s] = { count: 0, value: 0 };
    dealsByStage[s].count++;
    dealsByStage[s].value += parseFloat(d.Amount) || 0;
  });

  // Deals by owner
  const dealsByOwner: Record<string, { count: number; value: number }> = {};
  deals.forEach(d => {
    const owner = zohoStr(d.Owner, 'Unknown');
    if (!dealsByOwner[owner]) dealsByOwner[owner] = { count: 0, value: 0 };
    dealsByOwner[owner].count++;
    dealsByOwner[owner].value += parseFloat(d.Amount) || 0;
  });

  // Calls by owner
  const callsByOwner: Record<string, number> = {};
  calls.forEach(c => { const o = zohoStr(c.Owner, 'Unknown'); callsByOwner[o] = (callsByOwner[o] || 0) + 1; });

  // Recent deals (last 20)
  const recentDeals = deals.slice(0, 20).map(d => ({
    dealName: d.Deal_Name || 'Untitled', stage: d.Stage || 'Unknown',
    amount: parseFloat(d.Amount) || 0, closeDate: d.Close_Date || '',
    accountName: zohoStr(d.Account_Name, ''), owner: zohoStr(d.Owner, ''),
    createdTime: d.Created_Time || '', probability: d.Probability || 0,
  }));

  // All leads as individual records
  const leadRecords = leads.map((l: any) => ({
    firstName: l.First_Name || '',
    lastName: l.Last_Name || '',
    fullName: l.Full_Name || `${l.First_Name || ''} ${l.Last_Name || ''}`.trim() || 'Unknown',
    company: l.Company || '',
    email: l.Email || '',
    phone: l.Phone || '',
    leadSource: l.Lead_Source || '',
    leadStatus: l.Lead_Status || '',
    owner: zohoStr(l.Owner, 'Unknown'),
    createdTime: l.Created_Time || '',
  })).sort((a: any, b: any) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

  // Leads by owner summary
  const leadsByOwner: Record<string, number> = {};
  leadRecords.forEach((l: any) => { leadsByOwner[l.owner] = (leadsByOwner[l.owner] || 0) + 1; });

  // Clients list
  const clients = accounts.map((a: any) => ({
    accountName: a.Account_Name || 'Unknown', phone: a.Phone || '',
    website: a.Website || '', industry: a.Industry || '',
    owner: zohoStr(a.Owner, ''), createdTime: a.Created_Time || '',
    city: a.Billing_City || '', state: a.Billing_State || '',
  }));

  return res.status(200).json({
    success: true,
    data: {
      portalType: 'sales',
      clientName: config.displayName,
      ownerScope: 'Kavya Nishad',
      overview: {
        totalLeads: leads.length, newLeads30d, openDeals: openDeals.length,
        totalDeals: deals.length, closedWon: closedWon.length,
        totalRevenue, totalClients: accounts.length, totalCalls: calls.length,
        totalSignDocs: signDocuments.length,
      },
      leadRecords,
      leadsByOwner: Object.entries(leadsByOwner).map(([owner, count]) => ({ owner, count })).sort((a, b) => b.count - a.count),
      leadsByStatus: Object.entries(leadsByStatus).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      leadsBySource: Object.entries(leadsBySource).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      dealsByStage: Object.entries(dealsByStage).map(([stage, d]) => ({ stage, count: d.count, value: d.value })).sort((a, b) => b.count - a.count),
      dealsByOwner: Object.entries(dealsByOwner).map(([owner, d]) => ({ owner, count: d.count, value: d.value })).sort((a, b) => b.count - a.count),
      callsByOwner: Object.entries(callsByOwner).map(([owner, count]) => ({ owner, count })).sort((a, b) => b.count - a.count),
      recentDeals,
      clients,
      signDocuments,
    },
    timestamp: new Date().toISOString(),
  });
}

// ─── Data router ─────────────────────────────
async function handleGetData(req: VercelRequest, res: VercelResponse) {
  const clientSlug = verifyClientToken(req);
  if (!clientSlug) return res.status(401).json({ error: 'Unauthorized' });
  const config = CLIENT_CONFIG[clientSlug];
  if (config.type === 'sales') return handleSalesData(config, res);
  return handleRecruitData(config, res);
}

// ─── Main handler ────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'POST') return handleLogin(req, res);
    if (req.method === 'GET') return handleGetData(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Portal error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
