// ============================================
// GET /api/recruit/jobs - Recruit Job Openings Data
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getZohoAccessToken, createAuthHeaders } from '../lib/zoho-auth';
import { verifyDashboardToken, corsHeaders } from '../lib/auth-middleware';

interface ZohoJobOpening {
  id: string;
  Posting_Title: string;
  Client_Name: string;
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
      headers: createAuthHeaders(accessToken),
    });

    if (!response.ok) {
      if (response.status === 204) break; // No more data
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
  if (req.method === 'OPTIONS') return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (!verifyDashboardToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accessToken = await getZohoAccessToken('recruit');
    const jobs = await fetchAllJobs(accessToken);

    // Aggregate: Jobs by Client (active only)
    const jobsByClient: Record<string, { inProgress: number; filled: number; onHold: number; inactive: number; total: number }> = {};
    jobs.forEach((job) => {
      const client = job.Client_Name || 'Unknown';
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

    // Aggregate: Pipeline status counts
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
        clientName: job.Client_Name || 'Unknown',
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
