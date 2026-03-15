// ============================================
// GET /api/recruit/applications - Pipeline & Application Data
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getZohoAccessToken, createAuthHeaders } from '../lib/zoho-auth';
import { verifyDashboardToken, corsHeaders } from '../lib/auth-middleware';

interface ZohoApplication {
  id: string;
  Candidate_Name: { name: string; id: string } | null;
  Job_Opening: { name: string; id: string } | null;
  Client_Name: string;
  Application_Status: string;
  Created_Time: string;
  Modified_Time: string;
  Assigned_Recruiter: { name: string; id: string } | null;
}

async function fetchApplications(accessToken: string, dateFrom?: string, dateTo?: string): Promise<ZohoApplication[]> {
  const allApps: ZohoApplication[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://recruit.zoho.com/recruit/v2/Applications?fields=Candidate_Name,Job_Opening,Client_Name,Application_Status,Created_Time,Modified_Time,Assigned_Recruiter&page=${page}&per_page=200&sort_by=Created_Time&sort_order=desc`;

    const response = await fetch(url, {
      headers: createAuthHeaders(accessToken),
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

    // Safety limit
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
  if (req.method === 'OPTIONS') return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (!verifyDashboardToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const accessToken = await getZohoAccessToken('recruit');
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
      const recruiter = app.Assigned_Recruiter?.name || 'Unassigned';
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
      const client = app.Client_Name || 'Unknown';
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

    // Calc this week and this month submissions
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
