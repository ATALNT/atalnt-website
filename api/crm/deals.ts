// ============================================
// GET /api/crm/deals - Zoho CRM Sales Dashboard
// Leads, Deals Pipeline, Revenue, Activities
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Inlined auth helpers (same pattern as api/recruit/applications.ts) ---

function verifyDashboardToken(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return false;
  return token === secret;
}

interface TokenResponse { access_token: string; token_type: string; expires_in: number; api_domain: string; }
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getZohoAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) return cachedToken.token;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Missing Zoho OAuth credentials');
  const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  if (!response.ok) { const errorText = await response.text(); throw new Error(`Zoho OAuth failed: ${response.status} - ${errorText}`); }
  const data: TokenResponse = await response.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function zohoStr(val: any, fallback = 'Unknown'): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.length === 0 ? fallback : zohoStr(val[0], fallback);
  if (typeof val === 'object') return val.name || val.display_value || val.full_name || fallback;
  return String(val);
}

function daysBetween(date1: Date, date2: Date): number {
  const t1 = date1.getTime();
  const t2 = date2.getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
}

// --- Zoho Sign auth (separate refresh token) ---
let cachedSignToken: { token: string; expiresAt: number } | null = null;

async function getZohoSignAccessToken(): Promise<string | null> {
  if (cachedSignToken && Date.now() < cachedSignToken.expiresAt - 60000) return cachedSignToken.token;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_SIGN_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken });
  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  if (!response.ok) return null;
  const data: TokenResponse = await response.json();
  if (!data.access_token) return null;
  cachedSignToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function fetchZohoSignDocuments(accessToken: string): Promise<any[]> {
  const all: any[] = [];
  let startIndex = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://sign.zoho.com/api/v1/requests?data={"page_context":{"row_count":100,"start_index":${startIndex}}}`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) break;
    const data = await res.json();
    if (data.requests) all.push(...data.requests);
    hasMore = data.page_context?.has_more_rows ?? false;
    startIndex += data.page_context?.row_count ?? 100;
    if (startIndex > 500) break; // safety limit
  }
  return all;
}

// --- Zoho CRM fetch helpers ---

async function fetchCrmModule(accessToken: string, module: string, fields: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://www.zohoapis.com/crm/v2/${module}?fields=${fields}&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) { if (res.status === 204) break; break; }
    const data = await res.json();
    if (data.data) all.push(...data.data);
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 25) break;
  }
  return all;
}

// --- Stage ordering for pipeline ---
const DEAL_STAGE_ORDER: Record<string, number> = {
  'Qualification': 1,
  'Value Proposition': 2,
  'Identify Decision Makers': 3,
  'Perception Analysis': 4,
  'Proposal/Price Quote': 5,
  'Negotiation/Review': 6,
  'Closed Won': 7,
  'Closed Lost': 8,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyDashboardToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromTime = from ? new Date(from).getTime() : 0;
    const toTime = to ? new Date(to).getTime() : Date.now();

    const [accessToken, signAccessToken] = await Promise.all([
      getZohoAccessToken(),
      getZohoSignAccessToken(),
    ]);
    const now = new Date();

    // Fetch all CRM modules + Zoho Sign in parallel
    const [allLeads, allDeals, allCalls, allAccounts, signDocs] = await Promise.all([
      fetchCrmModule(accessToken, 'Leads', 'First_Name,Last_Name,Email,Phone,Lead_Source,Lead_Status,Owner,Created_Time,Company'),
      fetchCrmModule(accessToken, 'Deals', 'Deal_Name,Stage,Amount,Closing_Date,Account_Name,Owner,Created_Time,Modified_Time'),
      fetchCrmModule(accessToken, 'Calls', 'Subject,Call_Type,Call_Duration,Owner,Created_Time,Call_Status,Who_Id'),
      fetchCrmModule(accessToken, 'Accounts', 'Account_Name,Phone,Website,Industry,Owner,Created_Time'),
      signAccessToken ? fetchZohoSignDocuments(signAccessToken) : Promise.resolve([]),
    ]);

    // Apply date filter to leads and calls
    const leads = allLeads.filter((l) => {
      const t = new Date(l.Created_Time).getTime();
      return t >= fromTime && t <= toTime;
    });

    const calls = allCalls.filter((c) => {
      const t = new Date(c.Created_Time).getTime();
      return t >= fromTime && t <= toTime;
    });

    // Deals: keep all for pipeline, but filter for period revenue
    const openDeals = allDeals.filter((d) => d.Stage !== 'Closed Won' && d.Stage !== 'Closed Lost');
    const closedWonDeals = allDeals.filter((d) => d.Stage === 'Closed Won');
    const closedWonInPeriod = closedWonDeals.filter((d) => {
      const t = new Date(d.Modified_Time || d.Created_Time).getTime();
      return t >= fromTime && t <= toTime;
    });

    // =============================================
    // OVERVIEW KPIs
    // =============================================
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.Amount) || 0), 0);
    const totalRevenue = closedWonInPeriod.reduce((sum, d) => sum + (Number(d.Amount) || 0), 0);

    const overview = {
      newLeadsThisPeriod: leads.length,
      totalLeads: allLeads.length,
      openDeals: openDeals.length,
      closedWonDeals: closedWonInPeriod.length,
      totalPipelineValue: Math.round(totalPipelineValue),
      totalRevenue: Math.round(totalRevenue),
      totalCalls: calls.length,
    };

    // =============================================
    // LEADS BY SOURCE
    // =============================================
    const sourceMap: Record<string, number> = {};
    leads.forEach((l) => {
      const src = zohoStr(l.Lead_Source, 'Direct');
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const leadsBySource = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // =============================================
    // LEADS BY STATUS
    // =============================================
    const statusMap: Record<string, number> = {};
    leads.forEach((l) => {
      const s = zohoStr(l.Lead_Status, 'Not Contacted');
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const leadsByStatus = Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // =============================================
    // DEALS BY STAGE
    // =============================================
    const stageMap: Record<string, { count: number; totalValue: number }> = {};
    allDeals.forEach((d) => {
      const stage = zohoStr(d.Stage, 'Unknown');
      if (!stageMap[stage]) stageMap[stage] = { count: 0, totalValue: 0 };
      stageMap[stage].count++;
      stageMap[stage].totalValue += Number(d.Amount) || 0;
    });
    const dealsByStage = Object.entries(stageMap)
      .map(([stage, s]) => ({ stage, count: s.count, totalValue: Math.round(s.totalValue) }))
      .sort((a, b) => (DEAL_STAGE_ORDER[a.stage] || 99) - (DEAL_STAGE_ORDER[b.stage] || 99));

    // =============================================
    // DEALS BY OWNER
    // =============================================
    const ownerMap: Record<string, { totalDeals: number; openDeals: number; closedWon: number; totalValue: number; wonValue: number }> = {};
    allDeals.forEach((d) => {
      const owner = zohoStr(d.Owner, 'Unassigned');
      if (!ownerMap[owner]) ownerMap[owner] = { totalDeals: 0, openDeals: 0, closedWon: 0, totalValue: 0, wonValue: 0 };
      const o = ownerMap[owner];
      o.totalDeals++;
      o.totalValue += Number(d.Amount) || 0;
      if (d.Stage === 'Closed Won') { o.closedWon++; o.wonValue += Number(d.Amount) || 0; }
      else if (d.Stage !== 'Closed Lost') o.openDeals++;
    });
    const dealsByOwner = Object.entries(ownerMap)
      .map(([ownerName, o]) => ({
        ownerName,
        totalDeals: o.totalDeals,
        openDeals: o.openDeals,
        closedWon: o.closedWon,
        totalValue: Math.round(o.totalValue),
        wonValue: Math.round(o.wonValue),
        winRate: o.totalDeals > 0 ? Math.round((o.closedWon / o.totalDeals) * 100) : 0,
      }))
      .sort((a, b) => b.totalDeals - a.totalDeals);

    // =============================================
    // RECENT DEALS (top 25 open deals)
    // =============================================
    const recentDeals = [...openDeals]
      .sort((a, b) => new Date(b.Modified_Time || b.Created_Time).getTime() - new Date(a.Modified_Time || a.Created_Time).getTime())
      .slice(0, 25)
      .map((d) => {
        const closing = d.Closing_Date ? new Date(d.Closing_Date) : null;
        const daysUntilClose = closing ? daysBetween(now, closing) : null;
        return {
          dealName: zohoStr(d.Deal_Name, 'Unnamed Deal'),
          stage: zohoStr(d.Stage, 'Unknown'),
          amount: Number(d.Amount) || 0,
          accountName: zohoStr(d.Account_Name, '—'),
          ownerName: zohoStr(d.Owner, 'Unassigned'),
          closingDate: d.Closing_Date || '',
          daysUntilClose,
          isOverdue: daysUntilClose !== null && daysUntilClose < 0,
        };
      });

    // =============================================
    // CALLS BY OWNER
    // =============================================
    const callOwnerMap: Record<string, { totalCalls: number; inbound: number; outbound: number }> = {};
    calls.forEach((c) => {
      const owner = zohoStr(c.Owner, 'Unassigned');
      if (!callOwnerMap[owner]) callOwnerMap[owner] = { totalCalls: 0, inbound: 0, outbound: 0 };
      callOwnerMap[owner].totalCalls++;
      const type = (c.Call_Type || '').toLowerCase();
      if (type === 'inbound') callOwnerMap[owner].inbound++;
      else callOwnerMap[owner].outbound++;
    });
    const callsByOwner = Object.entries(callOwnerMap)
      .map(([ownerName, c]) => ({ ownerName, ...c }))
      .sort((a, b) => b.totalCalls - a.totalCalls);

    // =============================================
    // CLIENTS (ACCOUNTS)
    // =============================================
    const clients = allAccounts
      .map((a) => ({
        accountName: zohoStr(a.Account_Name, 'Unnamed'),
        phone: zohoStr(a.Phone, ''),
        website: zohoStr(a.Website, ''),
        industry: zohoStr(a.Industry, ''),
        owner: zohoStr(a.Owner, 'Unassigned'),
        createdTime: a.Created_Time || '',
      }))
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    // =============================================
    // ZOHO SIGN DOCUMENTS
    // =============================================
    const signDocuments = signDocs.map((doc) => {
      const actions = doc.actions || [];
      const recipients = actions.map((a: any) => ({
        name: `${a.recipient_name || ''}`.trim() || 'Unknown',
        email: a.recipient_email || '',
        status: a.action_status || '',
      }));
      return {
        documentName: doc.request_name || 'Untitled',
        status: doc.request_status || 'unknown',
        createdTime: doc.created_time ? new Date(doc.created_time).toISOString() : '',
        modifiedTime: doc.modified_time ? new Date(doc.modified_time).toISOString() : '',
        expirationDays: doc.validity ?? null,
        owner: `${doc.owner_first_name || ''} ${doc.owner_last_name || ''}`.trim() || 'Unknown',
        recipients,
        requestId: doc.request_id || '',
      };
    }).sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    return res.status(200).json({
      success: true,
      data: {
        overview,
        leadsBySource,
        leadsByStatus,
        dealsByStage,
        dealsByOwner,
        recentDeals,
        callsByOwner,
        clients,
        signDocuments,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('CRM deals API error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
