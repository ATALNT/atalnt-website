// ============================================
// GET /api/recruit/applications - Pipeline & Application Data
// Full recruiting agency analytics: funnel, velocity, bottleneck detection
//
// STATUS MAPPING (from real Zoho Recruit data):
// Associated → Applied → Submitted to HM → Interview (1st/2nd/3rd) → Qualified → Offer → Hired
// With rejection branches: Unqualified, Rejected by ops, Rejected by HM,
//   Interviewed-Rejected, Rejected by partner, Offer declined, Withdrawn
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

// =============================================
// REAL FUNNEL STAGES (based on actual Zoho data)
// =============================================
const FUNNEL_STAGES = [
  'Entered Pipeline',    // 0 - Associated or Applied
  'Submitted to Client', // 1 - Sent to hiring manager
  'Interviewed',         // 2 - Any interview round (1st, 2nd, 3rd)
  'Qualified',           // 3 - Passed interviews
  'Offer',               // 4 - Offer made/accepted
  'Hired',               // 5 - Placement complete
];

// Map EVERY real Zoho status to the highest funnel stage the candidate reached
// This uses lowercase matching for safety
function getMaxFunnelStage(status: string): number {
  const s = status.toLowerCase().trim();

  // Stage 5: Hired
  if (s === 'hired') return 5;

  // Stage 4: Offer (made, accepted, or declined)
  if (s.includes('offer')) return 4;

  // Stage 3: Qualified
  if (s === 'qualified') return 3;

  // Stage 2: Interviewed (any round, including post-interview rejection)
  if (s.includes('interview')) return 2;
  if (s === 'rejected by partner') return 2; // Partner rejection = post-interview

  // Stage 1: Submitted to client (including client-side rejection)
  if (s.includes('submitted')) return 1;
  if (s === 'rejected by hiring manager') return 1; // HM rejected = was submitted

  // Stage 0: Entered pipeline (applied, associated, or early rejection)
  if (s === 'associated' || s === 'applied') return 0;
  if (s === 'unqualified') return 0; // Screened out before submission
  if (s.includes('rejected by ops') || s === 'rejected by ops') return 0;
  if (s === 'rejected') return 0; // General rejection, assume pre-submission
  if (s === 'archived') return 0;
  if (s === 'withdrawn') return 0;

  // Unknown status - at least entered pipeline
  return 0;
}

// Determine if a status is "active" (candidate still progressing, needs action)
function isActiveStatus(status: string): boolean {
  const s = status.toLowerCase().trim();
  // Active = not rejected, not archived, not hired, not withdrawn, not offer-declined
  if (s === 'hired') return false;
  if (s.includes('reject')) return false;
  if (s === 'archived') return false;
  if (s === 'withdrawn') return false;
  if (s === 'unqualified') return false;
  if (s === 'offer declined') return false;
  return true;
}

// Categorize rejection reason for breakdown
function getRejectionCategory(status: string): string | null {
  const s = status.toLowerCase().trim();
  if (s === 'unqualified' || s.includes('rejected by ops')) return 'Screening';
  if (s === 'rejected by hiring manager') return 'Client Rejected';
  if (s.includes('interviewed') && s.includes('reject')) return 'Post-Interview';
  if (s === 'rejected by partner') return 'Partner Rejected';
  if (s === 'offer declined') return 'Offer Declined';
  if (s === 'withdrawn') return 'Candidate Withdrew';
  if (s === 'rejected') return 'General';
  return null;
}

interface ZohoApplication {
  id: string;
  Full_Name: string;
  Job_Opening_Name: string;
  Client_Name: any;
  Application_Status: string;
  Created_Time: string;
  Updated_On: string;     // This is the actual "Modified Time" field in Zoho Recruit
  Last_Activity_Time: string;
  Application_Owner: any; // The owner/recruiter assigned
  Account_Manager: any;   // Account manager on the job
  Assigned_Recruiter: any; // Often empty array
}

// Get the best recruiter name: prefer Assigned_Recruiter, fall back to Application_Owner
function getRecruiter(app: ZohoApplication): string {
  // Assigned_Recruiter can be an array of objects, a single object, or empty
  const ar = app.Assigned_Recruiter;
  if (ar) {
    if (Array.isArray(ar) && ar.length > 0) return zohoStr(ar[0], '');
    if (typeof ar === 'object' && !Array.isArray(ar)) return zohoStr(ar, '');
    if (typeof ar === 'string' && ar) return ar;
  }
  // Fall back to Application_Owner
  const owner = app.Application_Owner;
  if (owner) return zohoStr(owner, 'Unassigned');
  return 'Unassigned';
}

// Fetch candidates from the Candidates module, optionally filtered by Created_Time date range.
// Uses the Zoho Recruit search API when a date range is provided for server-side efficiency.
// Returns each candidate's name, recruiter, and creation date.
async function fetchCandidatesInRange(
  accessToken: string,
  from?: string,
  to?: string,
): Promise<Array<{
  recordId: string; fullName: string; firstName: string; lastName: string;
  city: string; candidateStage: string; recruiter: string; source: string;
  jobOpening: string; createdTime: string;
}>> {
  const results: Array<{
    recordId: string; fullName: string; firstName: string; lastName: string;
    city: string; candidateStage: string; recruiter: string; source: string;
    jobOpening: string; createdTime: string;
  }> = [];
  let page = 1;
  let hasMore = true;
  const fromTime = from ? new Date(from).getTime() : 0;
  const toTime = to ? new Date(to).getTime() : Date.now();

  // Fetch ALL candidates sorted by Created_Time desc, filter in memory.
  // Early-stop when records are older than the `from` date.
  const FIELDS = 'id,Full_Name,First_Name,Last_Name,City,Candidate_Stage,Recruiter,Source,Job_Opening_Name,Created_Time';
  const baseUrl = `https://recruit.zoho.com/recruit/v2/Candidates?fields=${FIELDS}&sort_by=Created_Time&sort_order=desc`;

  while (hasMore) {
    const url = `${baseUrl}&page=${page}&per_page=200`;
    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) { if (response.status === 204) break; break; }
    const data = await response.json();
    let tooOld = false;
    if (data.data) {
      for (const candidate of data.data) {
        const fullName = candidate.Full_Name;
        if (!fullName) continue;
        const createdTime = candidate.Created_Time || '';
        const t = createdTime ? new Date(createdTime).getTime() : 0;
        // Early stop: sorted desc, so once we're past `from` all remaining are older
        if (from && t < fromTime) { tooOld = true; break; }
        // Skip if after the `to` date
        if (to && t > toTime) continue;
        const rec = candidate.Recruiter;
        const recruiterName = rec
          ? (typeof rec === 'string' ? rec : rec?.name || zohoStr(rec, ''))
          : '';
        if (recruiterName) {
          const jo = candidate.Job_Opening_Name;
          results.push({
            recordId: candidate.id || '',
            fullName,
            firstName: candidate.First_Name || '',
            lastName: candidate.Last_Name || '',
            city: candidate.City || '',
            candidateStage: candidate.Candidate_Stage || '',
            recruiter: recruiterName,
            source: candidate.Source || '',
            jobOpening: jo ? (typeof jo === 'string' ? jo : jo?.name || '') : '',
            createdTime,
          });
        }
      }
    }
    if (tooOld) break;
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 50) break;
  }
  return results;
}

// Fetch ALL candidates' recruiter names (no date filter) for accurate recruiter attribution
async function fetchAllCandidateRecruiters(accessToken: string): Promise<Map<string, string>> {
  const recruiterMap = new Map<string, string>();
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Candidates?fields=Full_Name,Recruiter&page=${page}&per_page=200`;
    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) { if (response.status === 204) break; break; }
    const data = await response.json();
    if (data.data) {
      for (const candidate of data.data) {
        const fullName = candidate.Full_Name;
        if (!fullName) continue;
        const rec = candidate.Recruiter;
        if (!rec) continue;
        const recruiterName = typeof rec === 'string' ? rec : rec?.name || zohoStr(rec, '');
        if (recruiterName) recruiterMap.set(fullName, recruiterName);
      }
    }
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 25) break;
  }
  return recruiterMap;
}

async function fetchApplications(accessToken: string, dateFrom?: string, dateTo?: string): Promise<ZohoApplication[]> {
  const allApps: ZohoApplication[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Applications?fields=Full_Name,Job_Opening_Name,Client_Name,Application_Status,Created_Time,Updated_On,Last_Activity_Time,Application_Owner,Account_Manager,Assigned_Recruiter&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;
    const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' } });
    if (!response.ok) { if (response.status === 204) break; throw new Error(`Zoho Recruit API error: ${response.status}`); }
    const data = await response.json();
    if (data.data) allApps.push(...data.data);
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 25) break;
  }
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

// Rich job info returned from Job Openings
interface JobInfo {
  clientName: string;
  priority: string;
  status: string;
  numberOfPositions: number;
  createdTime: string;
  city: string;
  assignedRecruiter: string;
}

// Fetch Job Openings to build a map of job title → job info (client, priority, status, etc.)
async function fetchJobInfoMap(accessToken: string): Promise<Map<string, JobInfo>> {
  const jobMap = new Map<string, JobInfo>();
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Job_Openings?fields=Posting_Title,Client_Name,Account_Name,Contact_Name,Client,Priority1,Required_Skills,Job_Opening_Status,Number_of_Positions,Created_Time,City,Assigned_Recruiter&page=${page}&per_page=200`;
    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) { if (response.status === 204) break; break; }
    const data = await response.json();
    if (data.data) {
      for (const job of data.data) {
        const title = job.Posting_Title;
        const client = zohoStr(job.Client, '') || zohoStr(job.Account_Name, '') || zohoStr(job.Client_Name, '') || zohoStr(job.Contact_Name, '');
        if (title) {
          jobMap.set(title, {
            clientName: client,
            priority: zohoStr(job.Priority1, 'N/A'),
            status: zohoStr(job.Job_Opening_Status, ''),
            numberOfPositions: Number(job.Number_of_Positions) || 1,
            createdTime: zohoStr(job.Created_Time, ''),
            city: zohoStr(job.City, ''),
            assignedRecruiter: zohoStr(job.Assigned_Recruiter, 'Unassigned'),
            requiredSkills: zohoStr(job.Required_Skills, ''),
          });
        }
      }
    }
    hasMore = data.info?.more_records ?? false;
    page++;
    if (page > 25) break;
  }
  return jobMap;
}

function daysBetween(date1: Date, date2: Date): number {
  const t1 = date1.getTime();
  const t2 = date2.getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.floor(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyDashboardToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const accessToken = await getZohoAccessToken();
    const [allApplications, jobInfoMap, candidatesInRange, allCandidateRecruiters] = await Promise.all([
      fetchApplications(accessToken), // Fetch ALL — date filter applied below in memory
      fetchJobInfoMap(accessToken),
      fetchCandidatesInRange(accessToken, from as string | undefined, to as string | undefined),
      fetchAllCandidateRecruiters(accessToken), // ALL candidates → recruiter map (no date filter)
    ]);

    // Apply date filter in memory for regular reports (uses Application Created_Time)
    let applications = allApplications;
    let fromTime = 0;
    let toTime = Date.now();
    if (from || to) {
      fromTime = from ? new Date(from).getTime() : 0;
      toTime = to ? new Date(to).getTime() : Date.now();
      applications = allApplications.filter((app) => {
        const created = new Date(app.Created_Time).getTime();
        return created >= fromTime && created <= toTime;
      });
    }

    const now = new Date();

    // =============================================
    // 1. RAW PIPELINE BY STATUS (show all real statuses)
    // =============================================
    const statusCounts: Record<string, number> = {};
    applications.forEach((app) => {
      const status = app.Application_Status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // =============================================
    // 2. CONVERSION FUNNEL (using real status mapping)
    // For each candidate, determine the highest funnel stage they reached.
    // A candidate at "Interviewed - Rejected" still REACHED the Interview stage.
    // A candidate at "Rejected by hiring manager" still REACHED Submitted stage.
    // =============================================
    const funnelReached = new Array(FUNNEL_STAGES.length).fill(0);

    applications.forEach((app) => {
      const status = app.Application_Status || '';
      const maxStage = getMaxFunnelStage(status);
      // Count this candidate in every stage up to and including their max
      for (let i = 0; i <= maxStage; i++) {
        funnelReached[i]++;
      }
    });

    const funnel = FUNNEL_STAGES.map((stage, index) => {
      const count = funnelReached[index];
      const prevCount = index > 0 ? funnelReached[index - 1] : count;
      return {
        stage,
        count,
        percentOfTotal: funnelReached[0] > 0 ? Math.round((count / funnelReached[0]) * 100) : 0,
        conversionFromPrev: index === 0 ? 100 : (prevCount > 0 ? Math.round((count / prevCount) * 100) : 0),
        dropoff: index === 0 ? 0 : Math.max(0, prevCount - count),
      };
    });

    // =============================================
    // 3. REJECTION BREAKDOWN
    // Where in the process are candidates failing?
    // =============================================
    const rejectionBreakdown: Record<string, number> = {};
    applications.forEach((app) => {
      const cat = getRejectionCategory(app.Application_Status || '');
      if (cat) {
        rejectionBreakdown[cat] = (rejectionBreakdown[cat] || 0) + 1;
      }
    });

    // =============================================
    // 4. STAGE VELOCITY (Bottleneck Detection)
    // How long are ACTIVE candidates sitting in each stage?
    // =============================================
    const stageVelocity: Record<string, { totalDays: number; count: number; staleCount: number }> = {};

    applications.forEach((app) => {
      const status = app.Application_Status || '';
      if (!isActiveStatus(status)) return;

      const modified = new Date(app.Updated_On);
      const daysInStage = daysBetween(modified, now);

      if (!stageVelocity[status]) {
        stageVelocity[status] = { totalDays: 0, count: 0, staleCount: 0 };
      }
      stageVelocity[status].totalDays += daysInStage;
      stageVelocity[status].count++;
      if (daysInStage >= 7) stageVelocity[status].staleCount++;
    });

    const velocity = Object.entries(stageVelocity)
      .map(([stage, data]) => ({
        stage,
        activeCandidates: data.count,
        avgDaysInStage: data.count > 0 ? Math.round((data.totalDays / data.count) * 10) / 10 : 0,
        staleCandidates: data.staleCount,
        isBottleneck: data.count > 0 && (data.totalDays / data.count) > 7,
      }))
      .filter((v) => v.activeCandidates > 0)
      .sort((a, b) => b.activeCandidates - a.activeCandidates);

    // =============================================
    // 5. STALE CANDIDATES (active but no movement 7+ days)
    // =============================================
    const staleCandidates = applications
      .filter((app) => {
        const status = app.Application_Status || '';
        if (!isActiveStatus(status)) return false;
        return daysBetween(new Date(app.Updated_On), now) >= 7;
      })
      .map((app) => ({
        candidateName: app.Full_Name || 'Unknown',
        status: app.Application_Status,
        clientName: zohoStr(app.Client_Name),
        jobTitle: app.Job_Opening_Name || 'Unknown',
        recruiter: getRecruiter(app),
        daysSinceUpdate: daysBetween(new Date(app.Updated_On), now),
      }))
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

    // =============================================
    // 6. RECRUITER PERFORMANCE (sourced from Candidates module)
    // candidatesInRange: candidates filtered by Created_Time from Candidates module
    // Application data looked up by name for stage/status context
    // =============================================

    // Build a lookup: most recent application per candidate name (allApplications sorted desc)
    const latestAppByName = new Map<string, ZohoApplication>();
    allApplications.forEach((app) => {
      const name = app.Full_Name || '';
      if (!latestAppByName.has(name)) latestAppByName.set(name, app);
    });

    const recruiterStats: Record<string, {
      totalCandidates: number;
      reachedSubmission: number;
      reachedInterview: number;
      reachedOffer: number;
      hires: number;
      rejected: number;
      active: number;
    }> = {};

    candidatesInRange.forEach(({ fullName, recruiter }) => {
      if (!recruiterStats[recruiter]) {
        recruiterStats[recruiter] = { totalCandidates: 0, reachedSubmission: 0, reachedInterview: 0, reachedOffer: 0, hires: 0, rejected: 0, active: 0 };
      }
      const stats = recruiterStats[recruiter];
      const app = latestAppByName.get(fullName);
      const status = app?.Application_Status || '';
      const maxStage = getMaxFunnelStage(status);

      stats.totalCandidates++;
      if (maxStage >= 1) stats.reachedSubmission++;
      if (maxStage >= 2) stats.reachedInterview++;
      if (maxStage >= 4) stats.reachedOffer++;
      if (maxStage >= 5) stats.hires++;
      if (getRejectionCategory(status)) stats.rejected++;
      if (isActiveStatus(status)) stats.active++;
    });

    const recruiterPerformance = Object.entries(recruiterStats)
      .map(([name, s]) => ({
        recruiterName: name,
        totalCandidates: s.totalCandidates,
        submittedToClient: s.reachedSubmission,
        interviews: s.reachedInterview,
        offers: s.reachedOffer,
        hires: s.hires,
        rejected: s.rejected,
        activePipeline: s.active,
        submitToInterviewRate: s.reachedSubmission > 0 ? Math.round((s.reachedInterview / s.reachedSubmission) * 100) : 0,
        interviewToHireRate: s.reachedInterview > 0 ? Math.round((s.hires / s.reachedInterview) * 100) : 0,
        overallPlacementRate: s.totalCandidates > 0 ? Math.round((s.hires / s.totalCandidates) * 100) : 0,
      }))
      .sort((a, b) => b.totalCandidates - a.totalCandidates);

    // =============================================
    // 6b. CONSOLIDATED RECRUITER DETAIL REPORT
    // =============================================
    const recruiterCandidatesMap: Record<string, Array<{
      candidateName: string; jobTitle: string; clientName: string;
      currentStatus: string; funnelStage: number; daysInStage: number; createdDate: string;
    }>> = {};

    candidatesInRange.forEach(({ fullName, recruiter, createdTime }) => {
      if (!recruiterCandidatesMap[recruiter]) recruiterCandidatesMap[recruiter] = [];
      const app = latestAppByName.get(fullName);
      const jobTitle = app?.Job_Opening_Name || 'Unknown';
      const clientName = (jobTitle && jobInfoMap.get(jobTitle)?.clientName) || (app ? zohoStr(app.Client_Name) : 'Unknown');
      recruiterCandidatesMap[recruiter].push({
        candidateName: fullName || 'Unknown',
        jobTitle,
        clientName,
        currentStatus: app?.Application_Status || 'Unknown',
        funnelStage: getMaxFunnelStage(app?.Application_Status || ''),
        daysInStage: app ? daysBetween(new Date(app.Updated_On), now) : 0,
        createdDate: createdTime.split('T')[0] || '',
      });
    });

    // Merge KPIs from recruiterPerformance with candidate lists
    const recruiterDetailReport = recruiterPerformance.map((perf) => ({
      ...perf,
      candidates: (recruiterCandidatesMap[perf.recruiterName] || [])
        .sort((a, b) => b.funnelStage - a.funnelStage || b.daysInStage - a.daysInStage),
    }));

    // =============================================
    // 6c. CANDIDATE SUBMISSIONS REPORT (Candidates module, date-filtered)
    // Mirrors the Zoho Recruit Candidates export: Record Id, Job Opening,
    // First Name, Last Name, City, Candidate Stage, Source, Created Time
    // =============================================
    const submissionsGrouped: Record<string, Array<{
      recordId: string; jobOpening: string; firstName: string; lastName: string;
      city: string; candidateStage: string; source: string; createdTime: string;
    }>> = {};

    candidatesInRange.forEach(({ recordId, firstName, lastName, city, candidateStage, recruiter, source, jobOpening, createdTime, fullName }) => {
      if (!submissionsGrouped[recruiter]) submissionsGrouped[recruiter] = [];
      // Fall back to Applications module for job opening if Candidates module field is empty
      const resolvedJobOpening = jobOpening || latestAppByName.get(fullName)?.Job_Opening_Name || '';
      submissionsGrouped[recruiter].push({ recordId, jobOpening: resolvedJobOpening, firstName, lastName, city, candidateStage, source, createdTime });
    });

    const candidateSubmissionsReport = Object.entries(submissionsGrouped)
      .map(([recruiterName, candidates]) => ({
        recruiterName,
        count: candidates.length,
        candidates: candidates.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()),
      }))
      .sort((a, b) => b.count - a.count);

    // =============================================
    // 7. CLIENT HEALTH (using flexible matching)
    // =============================================
    const clientStats: Record<string, {
      total: number; reachedSubmission: number; reachedInterview: number;
      hires: number; rejected: number; active: number;
    }> = {};

    applications.forEach((app) => {
      const client = zohoStr(app.Client_Name);
      if (!clientStats[client]) {
        clientStats[client] = { total: 0, reachedSubmission: 0, reachedInterview: 0, hires: 0, rejected: 0, active: 0 };
      }
      const s = clientStats[client];
      const status = app.Application_Status || '';
      const maxStage = getMaxFunnelStage(status);

      s.total++;
      if (maxStage >= 1) s.reachedSubmission++;
      if (maxStage >= 2) s.reachedInterview++;
      if (maxStage >= 5) s.hires++;
      if (getRejectionCategory(status)) s.rejected++;
      if (isActiveStatus(status)) s.active++;
    });

    const clientHealth = Object.entries(clientStats)
      .map(([clientName, s]) => ({
        clientName,
        totalCandidates: s.total,
        submittedToClient: s.reachedSubmission,
        interviews: s.reachedInterview,
        hires: s.hires,
        rejected: s.rejected,
        activePipeline: s.active,
        rejectionRate: s.total > 0 ? Math.round((s.rejected / s.total) * 100) : 0,
        interviewRate: s.reachedSubmission > 0 ? Math.round((s.reachedInterview / s.reachedSubmission) * 100) : 0,
        placementRate: s.total > 0 ? Math.round((s.hires / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalCandidates - a.totalCandidates);

    // =============================================
    // 8. OVERVIEW STATS (accurate using funnel mapping)
    // =============================================
    const totalApplications = applications.length;
    const totalActive = applications.filter((a) => isActiveStatus(a.Application_Status || '')).length;
    const totalSubmittedToClient = funnelReached[1] || 0; // Stage 1: Submitted
    const totalInterviews = funnelReached[2] || 0;        // Stage 2: Interviewed
    const totalOffers = funnelReached[4] || 0;             // Stage 4: Offer
    const totalHires = funnelReached[5] || 0;              // Stage 5: Hired
    const totalRejected = applications.filter((a) => getRejectionCategory(a.Application_Status || '') !== null).length;
    const totalStale = staleCandidates.length;
    const totalWithdrawn = applications.filter((a) => (a.Application_Status || '').toLowerCase() === 'withdrawn').length;

    const activeDaysSum = applications
      .filter((a) => isActiveStatus(a.Application_Status || ''))
      .reduce((sum, a) => sum + daysBetween(new Date(a.Created_Time), now), 0);
    const avgDaysInPipeline = totalActive > 0 ? Math.round((activeDaysSum / totalActive) * 10) / 10 : 0;

    // =============================================
    // 9. SUBMISSIONS BY RECRUITER
    // Candidates whose current status indicates they were submitted to a client
    // (i.e., reached funnel stage 1+), grouped by recruiter
    // =============================================
    const submissionsByRecruiter: Record<string, { submitted: number; newInPeriod: number }> = {};
    applications.forEach((app) => {
      const recruiter = getRecruiter(app);
      const status = app.Application_Status || '';
      const maxStage = getMaxFunnelStage(status);
      if (!submissionsByRecruiter[recruiter]) {
        submissionsByRecruiter[recruiter] = { submitted: 0, newInPeriod: 0 };
      }
      submissionsByRecruiter[recruiter].newInPeriod++;
      if (maxStage >= 1) {
        submissionsByRecruiter[recruiter].submitted++;
      }
    });

    // =============================================
    // 10. INTERVIEW PIPELINE
    // Active candidates currently in any interview stage
    // =============================================
    const INTERVIEW_STAGE_ORDER: Record<string, number> = {
      'interview-scheduled': 1,
      '2nd interview-scheduled': 2,
      '3rd interview-scheduled': 3,
    };

    function getInterviewStageLabel(status: string): string | null {
      const s = status.toLowerCase().trim();
      if (s === 'interview-scheduled') return 'Interview Scheduled';
      if (s === '2nd interview-scheduled') return '2nd Interview';
      if (s === '3rd interview-scheduled') return '3rd Interview';
      return null;
    }

    // Filter to interview-stage applications first
    const interviewApps = applications.filter((app) => {
      const label = getInterviewStageLabel(app.Application_Status || '');
      return label !== null;
    });

    // Use the bulk candidateRecruiterMap fetched at startup (shared with scorecard)
    const interviewPipeline = interviewApps
      .map((app) => {
        const fullName = app.Full_Name || 'Unknown';
        return {
          candidateName: fullName,
          jobTitle: app.Job_Opening_Name || 'Unknown',
          clientName: (app.Job_Opening_Name && jobInfoMap.get(app.Job_Opening_Name)?.clientName) || zohoStr(app.Client_Name),
          recruiter: getRecruiter(app),
          candidateRecruiter: getRecruiter(app),
          interviewStage: getInterviewStageLabel(app.Application_Status || '') || 'Unknown',
          stageOrder: INTERVIEW_STAGE_ORDER[app.Application_Status.toLowerCase().trim()] || 0,
          daysInStage: daysBetween(new Date(app.Updated_On), now),
          createdDate: app.Created_Time.split('T')[0],
          lastUpdated: app.Updated_On.split('T')[0],
        };
      })
      .sort((a, b) => b.stageOrder - a.stageOrder || a.daysInStage - b.daysInStage);

    const interviewStageCounts: Record<string, number> = {};
    interviewPipeline.forEach((item) => {
      interviewStageCounts[item.interviewStage] = (interviewStageCounts[item.interviewStage] || 0) + 1;
    });

    // Build interview count per job from the interviewPipeline
    const interviewCountByJob = new Map<string, number>();
    interviewPipeline.forEach((item) => {
      const jt = item.jobTitle;
      interviewCountByJob.set(jt, (interviewCountByJob.get(jt) || 0) + 1);
    });

    // =============================================
    // 11. OPEN JOBS REPORT
    // =============================================
    // Group all applications by job title for fast lookup
    const appsByJob = new Map<string, typeof applications>();
    for (const app of applications) {
      const jobTitle = app.Job_Opening_Name || '';
      if (!jobTitle) continue;
      if (!appsByJob.has(jobTitle)) appsByJob.set(jobTitle, []);
      appsByJob.get(jobTitle)!.push(app);
    }

    const openJobsReport = [...jobInfoMap.entries()]
      .filter(([, info]) => info.status.toLowerCase() === 'in-progress')
      .map(([jobTitle, info]) => {
        const jobApps = appsByJob.get(jobTitle) || [];
        const submittedCandidates = jobApps
          .filter((app) => getMaxFunnelStage(app.Application_Status || '') >= 1)
          .map((app) => ({
            candidateName: app.Full_Name || 'Unknown',
            currentStatus: app.Application_Status || 'Unknown',
            recruiter: getRecruiter(app),
            submittedDate: app.Created_Time?.split('T')[0] || '',
            lastUpdated: app.Updated_On?.split('T')[0] || '',
            daysInCurrentStage: daysBetween(new Date(app.Updated_On), now),
            funnelStage: getMaxFunnelStage(app.Application_Status || ''),
          }))
          .sort((a, b) => b.funnelStage - a.funnelStage || a.candidateName.localeCompare(b.candidateName));

        return {
          jobTitle,
          clientName: info.clientName || 'Unknown',
          priorityTier: info.priority || 'N/A',
          numberOfPositions: info.numberOfPositions,
          city: info.city,
          assignedRecruiter: info.assignedRecruiter,
          requiredSkills: info.requiredSkills || '',
          daysOpen: info.createdTime ? daysBetween(new Date(info.createdTime), now) : 0,
          totalApplications: jobApps.length,
          totalSubmissions: submittedCandidates.length,
          interviewCount: interviewCountByJob.get(jobTitle) || 0,
          submittedCandidates,
        };
      })
      .sort((a, b) => {
        // Sort by tier first (Tier 1 > Tier 2 > Tier 3), then by submissions desc
        const tierOrder = (t: string) => t === 'Tier 1' ? 1 : t === 'Tier 2' ? 2 : t === 'Tier 3' ? 3 : 4;
        const tierDiff = tierOrder(a.priorityTier) - tierOrder(b.priorityTier);
        if (tierDiff !== 0) return tierDiff;
        return b.totalSubmissions - a.totalSubmissions;
      });

    // =============================================
    // 12. RECRUITER FORM SUBMISSIONS REPORT
    // Uses candidatesInRange (Candidate module Created_Time) for date filtering
    // Application data (status, job, client) looked up from latestAppByName
    // =============================================
    const formSubmissionStats: Record<string, {
      totalFormSubmissions: number; submittedToClient: number; inInterview: number;
      offers: number; hires: number; rejected: number; active: number;
      candidates: Array<{ candidateName: string; jobTitle: string; clientName: string; currentStatus: string; funnelStage: number; daysInStage: number; createdDate: string }>;
    }> = {};

    candidatesInRange.forEach(({ fullName, recruiter, createdTime }) => {
      const app = latestAppByName.get(fullName);
      const status = app?.Application_Status || '';
      const maxStage = getMaxFunnelStage(status);
      const jobTitle = app?.Job_Opening_Name || 'Unknown';
      const clientName = (jobTitle !== 'Unknown' && jobInfoMap.get(jobTitle)?.clientName) || (app ? zohoStr(app.Client_Name) : '') || '';

      if (!formSubmissionStats[recruiter]) {
        formSubmissionStats[recruiter] = { totalFormSubmissions: 0, submittedToClient: 0, inInterview: 0, offers: 0, hires: 0, rejected: 0, active: 0, candidates: [] };
      }
      const s = formSubmissionStats[recruiter];
      s.totalFormSubmissions++;
      if (maxStage >= 1) s.submittedToClient++;
      if (maxStage >= 2) s.inInterview++;
      if (maxStage >= 4) s.offers++;
      if (maxStage >= 5) s.hires++;
      if (getRejectionCategory(status)) s.rejected++;
      if (isActiveStatus(status)) s.active++;
      s.candidates.push({
        candidateName: fullName || 'Unknown',
        jobTitle,
        clientName,
        currentStatus: status || 'Unknown',
        funnelStage: maxStage,
        daysInStage: app ? daysBetween(new Date(app.Updated_On), now) : 0,
        createdDate: createdTime?.split('T')[0] || '',
      });
    });

    const recruiterFormSubmissions = Object.entries(formSubmissionStats)
      .map(([recruiterName, s]) => ({
        recruiterName,
        totalFormSubmissions: s.totalFormSubmissions,
        submittedToClient: s.submittedToClient,
        inInterview: s.inInterview,
        offers: s.offers,
        hires: s.hires,
        rejected: s.rejected,
        active: s.active,
        clientSubmissionRate: s.totalFormSubmissions > 0 ? Math.round((s.submittedToClient / s.totalFormSubmissions) * 100) : 0,
        candidates: s.candidates.sort((a, b) => b.funnelStage - a.funnelStage || b.daysInStage - a.daysInStage),
      }))
      .sort((a, b) => b.totalFormSubmissions - a.totalFormSubmissions);

    // =============================================
    // 13. DAILY VOLUME
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
          totalOffers,
          totalHires,
          totalRejected,
          totalWithdrawn,
          totalStale,
          avgDaysInPipeline,
        },
        funnel,
        rejectionBreakdown: Object.entries(rejectionBreakdown)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
        velocity,
        staleCandidates: staleCandidates.slice(0, 25),
        pipelineByStatus: Object.entries(statusCounts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
        recruiterPerformance,
        recruiterDetailReport,
        clientHealth: clientHealth.slice(0, 15),
        submissionsByRecruiter: Object.entries(submissionsByRecruiter)
          .map(([recruiterName, data]) => ({ recruiterName, ...data }))
          .sort((a, b) => b.submitted - a.submitted),
        dailyVolume: Object.entries(dailyVolume)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        interviewPipeline,
        openJobsReport,
        recruiterFormSubmissions,
        candidateSubmissionsReport,
        interviewStageCounts: Object.entries(interviewStageCounts)
          .map(([stage, count]) => ({ stage, count }))
          .sort((a, b) => {
            const order: Record<string, number> = { 'Interview Scheduled': 1, '2nd Interview': 2, '3rd Interview': 3 };
            return (order[a.stage] || 0) - (order[b.stage] || 0);
          }),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Recruit applications error:', error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}
