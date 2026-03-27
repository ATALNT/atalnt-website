// ============================================
// GET /api/recruit/mpc-candidates — Public Active Candidates (MPC) Feed
// Returns candidates where Post_to_MPC checkbox is checked in Zoho Recruit
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { detectServicesFromText, extractSalesProfile } from '../lib/freight-signals.js';

// --- Zoho OAuth (inlined for serverless, same pattern as candidates.ts) ---

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
  if (!response.ok) throw new Error(`Zoho OAuth failed: ${response.status}`);
  const data: TokenResponse = await response.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// --- Types ---

interface MPCCandidate {
  mpcId: string;
  initials: string;
  currentTitle: string;
  location: string;
  compensationRange: string;
  yearsExperience: string;
  skillHighlights: string[];
  serviceCategories: string[];
  repType: string;
  targetSize: string;
  salesModel: string;
  salesStyle: string;
  recruiterNotes: string;
}

// --- Helpers ---

function buildInitials(firstName: string, lastName: string): string {
  const f = (firstName || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  return `${f}${l}` || '??';
}

function buildLocation(city: string | null, state: string | null): string {
  const parts = [city, state].filter(Boolean);
  return parts.join(', ') || 'Location Undisclosed';
}

function buildCompensation(current: number | null, expected: number | null): string {
  if (expected && expected > 0) {
    const low = Math.round(expected * 0.9 / 1000) * 1000;
    const high = Math.round(expected * 1.1 / 1000) * 1000;
    return `$${(low / 1000).toFixed(0)}K–$${(high / 1000).toFixed(0)}K`;
  }
  if (current && current > 0) {
    return `$${(current / 1000).toFixed(0)}K+ target`;
  }
  return 'Competitive';
}

function extractSkillHighlights(skillSet: string | null): string[] {
  if (!skillSet) return [];
  // Parse Zoho's comma-separated skill set, take top relevant ones
  const skills = skillSet
    .split(',')
    .map(s => s.replace(/>/g, ':').trim())
    .filter(s => s.length > 2 && s.length < 50);
  return skills.slice(0, 8);
}

function buildMpcId(index: number): string {
  const year = new Date().getFullYear().toString().slice(-2);
  return `MPC-${year}-${String(index + 1).padStart(3, '0')}`;
}

// --- Resume text extraction ---

async function fetchResumeText(candidateId: string, accessToken: string): Promise<string> {
  try {
    // List attachments
    const listResp = await fetch(
      `https://recruit.zoho.com/recruit/v2/Candidates/${candidateId}/Attachments`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    if (!listResp.ok || listResp.status === 204) return '';

    const listData = await listResp.json();
    const attachments = listData.data || [];

    // Find first PDF/Word resume
    const resumeExts = ['.pdf', '.doc', '.docx'];
    const resumeAtt = attachments.find((a: any) => {
      const name = (a.File_Name || a.file_name || '').toLowerCase();
      return resumeExts.some(ext => name.endsWith(ext));
    });
    if (!resumeAtt) return '';

    // Download attachment
    const dlResp = await fetch(
      `https://recruit.zoho.com/recruit/v2/Candidates/${candidateId}/Attachments/${resumeAtt.id}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    if (!dlResp.ok) return '';

    const buffer = Buffer.from(await dlResp.arrayBuffer());
    const fileName = (resumeAtt.File_Name || resumeAtt.file_name || '').toLowerCase();

    // Extract text based on file type
    if (fileName.endsWith('.pdf')) {
      try {
        const pdfModule = await import('pdf-parse');
        const pdfParse = (pdfModule as any).default || pdfModule;
        const result = await pdfParse(buffer);
        return result.text || '';
      } catch {
        return '';
      }
    }

    // For .docx, try basic XML extraction
    if (fileName.endsWith('.docx')) {
      try {
        const text = buffer.toString('utf-8');
        // Simple XML text extraction for docx (zip-based XML)
        const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (matches) {
          return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
        }
      } catch {
        return '';
      }
    }

    return '';
  } catch {
    return '';
  }
}

// --- Main handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — this is a PUBLIC endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Cache for 5 minutes on Vercel edge
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const accessToken = await getZohoAccessToken();

    // Fetch candidates where Post_to_MPC = true
    // Use Zoho Recruit v2 search endpoint with criteria
    const criteria = '(Post_to_MPC:equals:true)';
    const searchUrl = `https://recruit.zoho.com/recruit/v2/Candidates/search?criteria=${encodeURIComponent(criteria)}&per_page=20`;
    let resp = await fetch(searchUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    // Fallback: if search fails, fetch all candidates and filter client-side
    if (!resp.ok && resp.status !== 204) {
      const fallbackUrl = `https://recruit.zoho.com/recruit/v2/Candidates?per_page=200`;
      resp = await fetch(fallbackUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
    }

    if (!resp.ok && resp.status !== 204) {
      const errText = await resp.text();
      throw new Error(`Zoho API error: ${resp.status} - ${errText}`);
    }

    if (resp.status === 204) {
      return res.status(200).json({ candidates: [], count: 0 });
    }

    const data = await resp.json();
    // Filter for Post_to_MPC in case we used the fallback (non-search) endpoint
    const allRecords = data.data || [];
    const records = allRecords.filter((r: any) => r.Post_to_MPC === true || r.Post_to_MPC === 'true');

    // Process each candidate
    const candidates: MPCCandidate[] = [];

    // Process in parallel (batches of 4)
    const batchSize = 4;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (record: any, batchIdx: number) => {
          const idx = i + batchIdx;
          const candidateId = record.id;

          // Fetch resume text for keyword analysis
          let resumeText = '';
          if (record.Is_Attachment_Present) {
            resumeText = await fetchResumeText(candidateId, accessToken);
          }

          // Combine recruiter notes + resume + skills for analysis
          const recruiterNotes = record.Notes_from_recruiter || record.Notes_from_Recruiter || record.Recruiter_Notes || '';
          const skillSet = record.Skill_Set || '';
          const combinedText = [recruiterNotes, resumeText, skillSet].join('\n');

          // Run freight-match keyword detection
          const serviceCategories = detectServicesFromText(combinedText);
          const salesProfile = extractSalesProfile(combinedText);

          const candidate: MPCCandidate = {
            mpcId: buildMpcId(idx),
            initials: buildInitials(record.First_Name, record.Last_Name),
            currentTitle: record.Current_Job_Title || 'Freight Sales Professional',
            location: buildLocation(record.City, record.State),
            compensationRange: buildCompensation(record.Current_Salary, record.Expected_Salary),
            yearsExperience: record.Experience_in_Years
              ? `${record.Experience_in_Years}+ years`
              : '',
            skillHighlights: extractSkillHighlights(skillSet),
            serviceCategories,
            repType: salesProfile.repType,
            targetSize: salesProfile.targetSize,
            salesModel: salesProfile.salesModel,
            salesStyle: salesProfile.salesStyle,
            recruiterNotes: recruiterNotes ? 'Available' : '',
          };

          return candidate;
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          candidates.push(result.value);
        }
      }
    }

    return res.status(200).json({
      candidates,
      count: candidates.length,
    });
  } catch (error: any) {
    console.error('MPC Candidates API error:', error?.message, error?.stack);
    return res.status(500).json({ error: 'Failed to fetch active candidates', details: error?.message });
  }
}
