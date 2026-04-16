// ============================================
// GET /api/recruit/candidates - Candidate Sourcing Data
// Splits into: Form Data (Recruiter picklist filled) vs Operations (direct Zoho entry)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Inlined auth helpers ---

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

// --- End helpers ---

interface ZohoCandidate {
  id: string;
  Full_Name: string;
  Source: string;
  Origin: string;
  Created_Time: string;
  Candidate_Owner: any;
  Recruiter: string | null;
  Job_Opening1: string | null;
}

// Stage ranking: higher = further in pipeline
function stageRank(status: string): number {
  const s = status.toLowerCase().trim();
  if (s === 'hired') return 6;
  if (s.includes('offer')) return 5;
  if (s === 'qualified') return 4;
  if (s.includes('interview')) return 3;
  if (s.includes('submitted')) return 2;
  if (s === 'associated' || s === 'applied') return 1;
  if (s.includes('reject') || s === 'unqualified' || s === 'withdrawn') return 0;
  return 0;
}

interface AppEntry { job: string; status: string; rank: number }

// Fetch all applications and build name → [{job, status}] map
async function fetchCandidateAppMap(accessToken: string): Promise<Record<string, AppEntry[]>> {
  const map: Record<string, AppEntry[]> = {};
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 25) {
    const url = `https://recruit.zoho.com/recruit/v2/Applications?fields=Full_Name,Application_Status,Job_Opening_Name&per_page=200&page=${page}&sort_by=Created_Time&sort_order=desc`;
    const resp = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!resp.ok) break;
    const data = await resp.json();
    if (!data.data || data.data.length === 0) break;
    for (const a of data.data) {
      const name = (a.Full_Name || '').trim();
      const status = a.Application_Status || '';
      const job = (a.Job_Opening_Name || '').trim();
      if (name && status) {
        if (!map[name]) map[name] = [];
        map[name].push({ job, status, rank: stageRank(status) });
      }
    }
    hasMore = data.info?.more_records ?? false;
    page++;
  }
  return map;
}

// Find best matching application status for a candidate + job combo
function resolveStage(appMap: Record<string, AppEntry[]>, candidateName: string, candidateJob: string): string {
  const apps = appMap[candidateName];
  if (!apps || apps.length === 0) return '';
  if (apps.length === 1) return apps[0].status;

  // Try to match by job name overlap
  const cjLower = candidateJob.toLowerCase();
  if (cjLower) {
    for (const app of apps) {
      const ajLower = app.job.toLowerCase();
      // Check if either contains the other, or they share significant words
      if (cjLower.includes(ajLower) || ajLower.includes(cjLower)) {
        return app.status;
      }
      // Check for shared significant words (3+ chars)
      const cWords = cjLower.split(/[\s,|+\-–—&]+/).filter(w => w.length >= 3);
      const aWords = ajLower.split(/[\s,|+\-–—&]+/).filter(w => w.length >= 3);
      const shared = cWords.filter(w => aWords.includes(w));
      if (shared.length >= 2) return app.status;
    }
  }

  // No job match — return the most advanced stage
  return apps.reduce((best, a) => a.rank > best.rank ? a : best, apps[0]).status;
}

async function fetchJobClientMap(accessToken: string): Promise<Record<string, string>> {
  const byName: Record<string, string> = {};
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 10) {
    const url = `https://recruit.zoho.com/recruit/v2/Job_Openings?fields=Client,Job_Opening_Name&per_page=200&page=${page}`;
    const resp = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!resp.ok) break;
    const data = await resp.json();
    if (!data.data || data.data.length === 0) break;
    for (const j of data.data) {
      if (j.Client && j.Job_Opening_Name) byName[j.Job_Opening_Name] = j.Client;
    }
    hasMore = data.info?.more_records ?? false;
    page++;
  }
  return byName;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyDashboardToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const accessToken = await getZohoAccessToken();

    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params required' });

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Fetch candidates with job opening field
    const candidates: ZohoCandidate[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
      const url = `https://recruit.zoho.com/recruit/v2/Candidates?fields=Full_Name,Source,Origin,Created_Time,Candidate_Owner,Recruiter,Job_Opening1&per_page=200&page=${page}&sort_by=Created_Time&sort_order=desc`;
      const resp = await fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });

      if (!resp.ok) {
        if (resp.status === 204) break;
        const errText = await resp.text();
        throw new Error(`Zoho API error: ${resp.status} - ${errText}`);
      }

      const data = await resp.json();
      if (!data.data || data.data.length === 0) break;

      for (const c of data.data) {
        const created = new Date(c.Created_Time);
        if (created >= fromDate && created <= toDate) {
          candidates.push(c);
        } else if (created < fromDate) {
          hasMore = false;
          break;
        }
      }

      hasMore = hasMore && data.info?.more_records === true;
      page++;
    }

    // Fetch job → client mapping, then candidate → application status
    const jobClientMap = await fetchJobClientMap(accessToken);
    const candidateAppMap = await fetchCandidateAppMap(accessToken);

    // Split: Form Data (Recruiter field filled) vs Operations (no Recruiter field)
    interface CandidateDetail { name: string; source: string; date: string; job: string; client: string; stage: string }
    interface GroupData { count: number; sources: Record<string, number>; candidates: CandidateDetail[] }
    const formByRecruiter: Record<string, GroupData> = {};
    const opsByOwner: Record<string, GroupData> = {};

    for (const c of candidates) {
      const recruiterField = (c.Recruiter || '').trim();
      const source = c.Source || 'Unknown';
      const jobName = c.Job_Opening1 || '';
      const client = jobClientMap[jobName] || '';
      const candidateName = c.Full_Name || 'Unknown';
      const detail: CandidateDetail = {
        name: candidateName,
        source,
        date: c.Created_Time,
        job: jobName,
        client,
        stage: resolveStage(candidateAppMap, candidateName, jobName),
      };

      if (recruiterField) {
        // Form submission — group by Recruiter picklist
        if (!formByRecruiter[recruiterField]) formByRecruiter[recruiterField] = { count: 0, sources: {}, candidates: [] };
        formByRecruiter[recruiterField].count++;
        formByRecruiter[recruiterField].sources[source] = (formByRecruiter[recruiterField].sources[source] || 0) + 1;
        formByRecruiter[recruiterField].candidates.push(detail);
      } else {
        // Direct Zoho entry — group by Candidate_Owner
        const owner = zohoStr(c.Candidate_Owner, 'Unassigned');
        if (!opsByOwner[owner]) opsByOwner[owner] = { count: 0, sources: {}, candidates: [] };
        opsByOwner[owner].count++;
        opsByOwner[owner].sources[source] = (opsByOwner[owner].sources[source] || 0) + 1;
        opsByOwner[owner].candidates.push(detail);
      }
    }

    function toSorted(map: Record<string, GroupData>) {
      return Object.entries(map)
        .map(([recruiterName, data]) => ({
          recruiterName,
          count: data.count,
          topSources: Object.entries(data.sources)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([source, count]) => ({ source, count })),
          candidates: data.candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        }))
        .sort((a, b) => b.count - a.count);
    }

    const formData = toSorted(formByRecruiter);
    const operations = toSorted(opsByOwner);

    return res.status(200).json({
      totalCandidates: candidates.length,
      formData,
      formTotal: formData.reduce((s, r) => s + r.count, 0),
      operations,
      opsTotal: operations.reduce((s, r) => s + r.count, 0),
      dateRange: { from, to },
    });
  } catch (error: any) {
    console.error('Candidates API error:', error?.message, error?.stack);
    return res.status(500).json({ error: 'Failed to fetch candidate data', details: error?.message });
  }
}
