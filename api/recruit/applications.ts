// ============================================
// GET /api/recruit/applications - Pipeline & Application Data
// Full recruiting agency analytics with funnel, velocity, bottleneck detection
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

// Define the pipeline stage order for a direct placement recruiting firm
// This represents the candidate journey from entry to placement
const PIPELINE_ORDER = [
  'Associated',
  'Applied',
  'Submitted-to-hiring-manager',
  'Interview-Scheduled',
  'Qualified',
  'Hired',
];

// Terminal/exit statuses — candidates no longer active in the pipeline
const TERMINAL_STATUSES = ['Hired', 'Rejected', 'Rejected-by-ops', 'Archived'];

// Active statuses where candidates should be progressing
const ACTIVE_STATUSES = ['Associated', 'Applied', 'Submitted-to-hiring-manager', 'Interview-Scheduled', 'Qualified'];

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

function daysBetween(date1: Date, date2: Date): number {
  const t1 = date1.getTime();
  const t2 = date2.getTime();
  if (isNaN(t1) || isNaN(t2)) return 0; // Guard against invalid dates
  return Math.floor(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24));
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
    const now = new Date();

    // =============================================
    // 1. PIPELINE BY STATUS (existing, improved)
    // =============================================
    const statusCounts: Record<string, number> = {};
    applications.forEach((app) => {
      const status = app.Application_Status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // =============================================
    // 2. CONVERSION FUNNEL
    // Tracks how candidates flow through the pipeline
    // Each stage shows: count, % of total, conversion from prev stage
    // =============================================
    const funnelCounts: Record<string, number> = {};
    PIPELINE_ORDER.forEach((stage) => {
      funnelCounts[stage] = 0;
    });
    // Count candidates who REACHED each stage (current status or beyond)
    applications.forEach((app) => {
      const status = app.Application_Status || '';
      const stageIndex = PIPELINE_ORDER.indexOf(status);
      if (stageIndex >= 0) {
        // Candidate reached this stage and all prior stages
        for (let i = 0; i <= stageIndex; i++) {
          funnelCounts[PIPELINE_ORDER[i]]++;
        }
      }
      // Also count terminal statuses for where they exited
      // Rejected candidates still passed through earlier stages
      if (status === 'Rejected' || status === 'Rejected-by-ops') {
        // They at least applied
        funnelCounts['Associated'] = (funnelCounts['Associated'] || 0) + 1;
        funnelCounts['Applied'] = (funnelCounts['Applied'] || 0) + 1;
      }
    });

    const totalEntrants = funnelCounts['Associated'] || funnelCounts['Applied'] || applications.length;
    const funnel = PIPELINE_ORDER.map((stage, index) => {
      const count = funnelCounts[stage] || 0;
      const prevCount = index > 0 ? (funnelCounts[PIPELINE_ORDER[index - 1]] || 1) : totalEntrants;
      return {
        stage,
        count,
        percentOfTotal: totalEntrants > 0 ? Math.round((count / totalEntrants) * 100) : 0,
        conversionFromPrev: index === 0 ? 100 : (prevCount > 0 ? Math.round((count / prevCount) * 100) : 0),
        dropoff: index === 0 ? 0 : Math.max(0, prevCount - count),
      };
    });

    // =============================================
    // 3. STAGE VELOCITY (Bottleneck Detection)
    // How long are candidates sitting in each stage?
    // Uses Modified_Time to calculate days since last activity
    // =============================================
    const stageVelocity: Record<string, { totalDays: number; count: number; staleCount: number; candidates: string[] }> = {};
    ACTIVE_STATUSES.forEach((s) => {
      stageVelocity[s] = { totalDays: 0, count: 0, staleCount: 0, candidates: [] };
    });

    applications.forEach((app) => {
      const status = app.Application_Status || '';
      if (ACTIVE_STATUSES.includes(status)) {
        const modified = new Date(app.Modified_Time);
        const daysInStage = daysBetween(modified, now);
        if (stageVelocity[status]) {
          stageVelocity[status].totalDays += daysInStage;
          stageVelocity[status].count++;
          if (daysInStage >= 7) {
            stageVelocity[status].staleCount++;
            stageVelocity[status].candidates.push(zohoStr(app.Candidate_Name));
          }
        }
      }
    });

    const velocity = ACTIVE_STATUSES.map((stage) => {
      const data = stageVelocity[stage];
      return {
        stage,
        activeCandidates: data.count,
        avgDaysInStage: data.count > 0 ? Math.round((data.totalDays / data.count) * 10) / 10 : 0,
        staleCandidates: data.staleCount,
        isBottleneck: data.count > 0 && (data.totalDays / data.count) > 7,
      };
    }).filter((v) => v.activeCandidates > 0);

    // =============================================
    // 4. STALE CANDIDATES (no movement 7+ days)
    // These need immediate attention
    // =============================================
    const staleCandidates = applications
      .filter((app) => {
        const status = app.Application_Status || '';
        if (!ACTIVE_STATUSES.includes(status)) return false;
        const modified = new Date(app.Modified_Time);
        return daysBetween(modified, now) >= 7;
      })
      .map((app) => ({
        candidateName: zohoStr(app.Candidate_Name),
        status: app.Application_Status,
        clientName: zohoStr(app.Client_Name),
        jobTitle: zohoStr(app.Job_Opening),
        recruiter: zohoStr(app.Assigned_Recruiter, 'Unassigned'),
        daysSinceUpdate: daysBetween(new Date(app.Modified_Time), now),
      }))
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    // =============================================
    // 5. RECRUITER PERFORMANCE (enhanced with rates)
    // =============================================
    const recruiterStats: Record<string, {
      submissions: number;
      submitted: number;
      interviews: number;
      hires: number;
      rejected: number;
      active: number;
    }> = {};

    applications.forEach((app) => {
      const recruiter = zohoStr(app.Assigned_Recruiter, 'Unassigned');
      if (!recruiterStats[recruiter]) {
        recruiterStats[recruiter] = { submissions: 0, submitted: 0, interviews: 0, hires: 0, rejected: 0, active: 0 };
      }
      recruiterStats[recruiter].submissions++;

      const status = (app.Application_Status || '').toLowerCase();
      if (status.includes('submitted') || status.includes('interview') || status.includes('qualified') || status === 'hired') {
        recruiterStats[recruiter].submitted++;
      }
      if (status.includes('interview') || status.includes('qualified') || status === 'hired') {
        recruiterStats[recruiter].interviews++;
      }
      if (status === 'hired') recruiterStats[recruiter].hires++;
      if (status.includes('reject')) recruiterStats[recruiter].rejected++;
      if (ACTIVE_STATUSES.includes(app.Application_Status || '')) recruiterStats[recruiter].active++;
    });

    const recruiterPerformance = Object.entries(recruiterStats)
      .map(([name, stats]) => ({
        recruiterName: name,
        submissions: stats.submissions,
        submittedToClient: stats.submitted,
        interviews: stats.interviews,
        hires: stats.hires,
        rejected: stats.rejected,
        activePipeline: stats.active,
        submitToInterviewRate: stats.submitted > 0 ? Math.round((stats.interviews / stats.submitted) * 100) : 0,
        interviewToHireRate: stats.interviews > 0 ? Math.round((stats.hires / stats.interviews) * 100) : 0,
        overallPlacementRate: stats.submissions > 0 ? Math.round((stats.hires / stats.submissions) * 100) : 0,
      }))
      .sort((a, b) => b.submissions - a.submissions);

    // =============================================
    // 6. CLIENT HEALTH
    // Which clients are easy vs hard to fill?
    // =============================================
    const clientStats: Record<string, {
      total: number;
      submitted: number;
      interviews: number;
      hires: number;
      rejected: number;
      active: number;
    }> = {};

    applications.forEach((app) => {
      const client = zohoStr(app.Client_Name);
      if (!clientStats[client]) {
        clientStats[client] = { total: 0, submitted: 0, interviews: 0, hires: 0, rejected: 0, active: 0 };
      }
      clientStats[client].total++;

      const status = (app.Application_Status || '').toLowerCase();
      if (status.includes('submitted') || status.includes('interview') || status.includes('qualified') || status === 'hired') {
        clientStats[client].submitted++;
      }
      if (status.includes('interview') || status.includes('qualified') || status === 'hired') {
        clientStats[client].interviews++;
      }
      if (status === 'hired') clientStats[client].hires++;
      if (status.includes('reject')) clientStats[client].rejected++;
      if (ACTIVE_STATUSES.includes(app.Application_Status || '')) clientStats[client].active++;
    });

    const clientHealth = Object.entries(clientStats)
      .map(([clientName, stats]) => ({
        clientName,
        totalCandidates: stats.total,
        submittedToClient: stats.submitted,
        interviews: stats.interviews,
        hires: stats.hires,
        rejected: stats.rejected,
        activePipeline: stats.active,
        rejectionRate: stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0,
        interviewRate: stats.submitted > 0 ? Math.round((stats.interviews / stats.submitted) * 100) : 0,
        placementRate: stats.total > 0 ? Math.round((stats.hires / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalCandidates - a.totalCandidates);

    // =============================================
    // 7. OVERVIEW STATS (fixed accuracy)
    // =============================================
    const totalApplications = applications.length;
    const totalActive = applications.filter((a) => ACTIVE_STATUSES.includes(a.Application_Status || '')).length;
    const totalSubmittedToClient = applications.filter((a) => {
      const s = (a.Application_Status || '').toLowerCase();
      return s.includes('submitted') || s.includes('interview') || s.includes('qualified') || s === 'hired';
    }).length;
    const totalInterviews = applications.filter((a) => {
      const s = (a.Application_Status || '').toLowerCase();
      return s.includes('interview') || s.includes('qualified') || s === 'hired';
    }).length;
    const totalHires = applications.filter((a) => (a.Application_Status || '').toLowerCase() === 'hired').length;
    const totalRejected = applications.filter((a) => (a.Application_Status || '').toLowerCase().includes('reject')).length;
    const totalStale = staleCandidates.length;

    // Avg days from creation to current stage for all active candidates
    const activeDaysSum = applications
      .filter((a) => ACTIVE_STATUSES.includes(a.Application_Status || ''))
      .reduce((sum, a) => sum + daysBetween(new Date(a.Created_Time), now), 0);
    const avgDaysInPipeline = totalActive > 0 ? Math.round((activeDaysSum / totalActive) * 10) / 10 : 0;

    // =============================================
    // 8. DAILY VOLUME (existing)
    // =============================================
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyVolume: Record<string, number> = {};
    applications
      .filter((app) => new Date(app.Created_Time) >= thirtyDaysAgo)
      .forEach((app) => {
        const date = app.Created_Time.split('T')[0];
        dailyVolume[date] = (dailyVolume[date] || 0) + 1;
      });

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalApplications,
          totalActive,
          totalSubmittedToClient,
          totalInterviews,
          totalHires,
          totalRejected,
          totalStale,
          avgDaysInPipeline,
        },
        funnel,
        velocity,
        staleCandidates: staleCandidates.slice(0, 20),
        pipelineByStatus: Object.entries(statusCounts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
        recruiterPerformance,
        clientHealth: clientHealth.slice(0, 15),
        applicationsByClient: clientHealth.map((c) => ({ clientName: c.clientName, count: c.totalCandidates })),
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
