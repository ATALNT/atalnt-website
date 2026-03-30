// ============================================
// GET /api/instantly/cron-lead-responder — Auto-Respond to Interested Leads
// Runs 3x daily (10 AM, 2 PM, 4 PM CST).
//
// Two-part flow:
//   Part 1: Instantly persona replies "Looping in Nik Jain..."
//   Part 2 (10+ min later): Nik's customized email via Zoho Mail + CRM lead
//
// Uses Supabase to track state and prevent double-responding.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 300;

// ── Inlined: Gemini Prompts & Industry Framework ────────────────────

const SYSTEM_PROMPT = `You are writing a follow-up email on behalf of Nik Jain, Executive Partner at ATALNT (Talent + Technology Solutions). A sales persona has already been emailing this lead and just told them "I'm looping in Nik Jain, our Managing Partner." Now Nik is following up.

TONE & STYLE RULES:
- Direct, no fluff, short paragraphs
- Open with "[Persona first name] looped me in here."
- Mirror the prospect's sophistication level
- Use "friction" and "workflows" language naturally
- Don't oversell AI — focus on operational outcomes
- No buzzwords like "synergy", "leverage", "cutting-edge"
- Sound like a real person, not a template

STRUCTURE (keep it short — 100-150 words max):
1. Opening: "[Persona first name] looped me in here."
2. One sentence acknowledging their reply or interest specifically
3. One credibility anchor if relevant (e.g., "We recently helped a financial advisory firm in Irving TX cut their Salesforce implementation from 6 months to 3 weeks")
4. 2-3 bullet points of industry-specific pain points (from the industry context provided)
5. Soft CTA: "If helpful, happy to walk through this together. You can grab a time here: {bookings_url}"

DO NOT include:
- Subject line (we handle that separately)
- Email signature (we append that separately)
- Greeting like "Hi [Name]" (we prepend that separately)
- Any mention of pricing or costs
- Generic AI/ML language unless the prospect is technical

OUTPUT: Return ONLY the email body text (no greeting, no signature, no subject). Start directly with "[Persona first name] looped me in here."`;

const INDUSTRY_FRAMEWORKS: Record<string, string> = {
  consulting: `INDUSTRY: Consulting / Professional Services
PAIN POINTS:
- Proposal automation — hours spent on repetitive RFP responses
- Resource utilization tracking across multiple engagements
- Knowledge management — tribal knowledge locked in email threads
- Client deliverable templates that still require manual customization`,

  tax_accounting: `INDUSTRY: Tax / Accounting / CPA
PAIN POINTS:
- Client intake and document collection still manual (email back-and-forth)
- Past returns and engagement history scattered across systems
- Engagement prep takes hours of pulling data from multiple sources
- Seasonal scaling — need to onboard temp staff fast without losing quality`,

  crypto_tech: `INDUSTRY: Crypto / Tech / Fintech
PAIN POINTS:
- Data pipeline reliability and monitoring across chains
- Developer workflow friction — context switching between tools
- System architecture documentation that stays current
- Compliance reporting automation (don't use generic AI language — be specific)`,

  investment_banking: `INDUSTRY: Investment Banking / Private Equity / VC
PAIN POINTS:
- Deal pricing and execution effort estimation still spreadsheet-driven
- Pipeline intelligence — knowing which deals are actually moving
- Due diligence document assembly takes weeks
- Portfolio company reporting consolidation`,

  wealth_advisory: `INDUSTRY: Wealth Advisory / Financial Planning
PAIN POINTS:
- Pipeline predictability — which prospects will actually close
- Client acquisition cost tracking across channels
- CRM data quality — advisors don't update records consistently
- Compliance documentation for new client onboarding`,

  franchise: `INDUSTRY: Franchise / Multi-Location Business
PAIN POINTS:
- Documentation and SOPs that actually get followed
- Proposal generation for new franchise locations
- Knowledge management across locations
- Sales pipeline visibility across franchisees`,

  staffing_recruiting: `INDUSTRY: Staffing / Recruiting
PAIN POINTS:
- Candidate sourcing across multiple job boards
- Resume screening and ranking at scale
- Client submission tracking and follow-up automation
- Placement analytics and margin optimization`,

  generic: `INDUSTRY: Professional Services (General)
PAIN POINTS:
- Manual workflows creating bottleneck and friction
- Data scattered across multiple systems with no single source of truth
- Repetitive processes that could be systematized
- Scaling operations without proportionally scaling headcount`,
};

function detectIndustry(websiteText: string): string {
  const text = websiteText.toLowerCase();
  if (text.includes('tax') || text.includes('cpa') || text.includes('accounting') || text.includes('bookkeeping'))
    return 'tax_accounting';
  if (text.includes('crypto') || text.includes('blockchain') || text.includes('web3') || text.includes('defi'))
    return 'crypto_tech';
  if (text.includes('investment bank') || text.includes('private equity') || text.includes('venture capital') || text.includes('m&a'))
    return 'investment_banking';
  if (text.includes('wealth') || text.includes('financial advis') || text.includes('financial plan') || text.includes('ria'))
    return 'wealth_advisory';
  if (text.includes('franchise') || text.includes('multi-location') || text.includes('franchis'))
    return 'franchise';
  if (text.includes('consulting') || text.includes('advisory') || text.includes('professional services'))
    return 'consulting';
  if (text.includes('staffing') || text.includes('recruiting') || text.includes('talent acquisition') || text.includes('placement'))
    return 'staffing_recruiting';
  return 'generic';
}

// ── Inlined: Zoho Mail API ──────────────────────────────────────────

let cachedAccountId: string | null = null;

async function getMailAccountId(accessToken: string): Promise<string> {
  if (cachedAccountId) return cachedAccountId;
  const resp = await fetch('https://mail.zoho.com/api/accounts', {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Zoho Mail accounts API error ${resp.status}: ${errText}`);
  }
  const data = await resp.json();
  const accounts = data.data || [];
  if (accounts.length === 0) throw new Error('No Zoho Mail accounts found');
  cachedAccountId = accounts[0].accountId;
  return cachedAccountId!;
}

async function sendEmailAsNik(
  accessToken: string,
  toAddress: string,
  subject: string,
  htmlContent: string,
  ccAddress?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accountId = await getMailAccountId(accessToken);
    const body: Record<string, any> = {
      fromAddress: 'nik@atalnt.com',
      toAddress,
      subject,
      content: htmlContent,
      mailFormat: 'html',
    };
    if (ccAddress) body.ccAddress = ccAddress;
    const resp = await fetch(
      `https://mail.zoho.com/api/accounts/${accountId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, error: `${resp.status}: ${errText}` };
    }
    const result = await resp.json();
    return { success: true, messageId: result.data?.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Inlined: Zoho CRM API ──────────────────────────────────────────

interface CrmLeadData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  leadSource?: string;
  description?: string;
}

async function createCrmLead(
  accessToken: string,
  lead: CrmLeadData
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  try {
    const body = {
      data: [
        {
          First_Name: lead.firstName,
          Last_Name: lead.lastName || 'Unknown',
          Email: lead.email,
          Company: lead.company || 'Unknown',
          Lead_Source: lead.leadSource || 'Instantly Outbound',
          Description: lead.description || '',
        },
      ],
      trigger: ['workflow'],
    };
    const resp = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, error: `${resp.status}: ${errText}` };
    }
    const result = await resp.json();
    const created = result.data?.[0];
    if (created?.code === 'SUCCESS') {
      return { success: true, leadId: created.details?.id };
    }
    return { success: false, error: created?.message || 'Unknown CRM error' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function checkDuplicateLead(
  accessToken: string,
  email: string
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://www.zohoapis.com/crm/v2/Leads/search?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );
    if (!resp.ok) return false;
    const result = await resp.json();
    return (result.data?.length || 0) > 0;
  } catch {
    return false;
  }
}

// ── Types ────────────────────────────────────────────────────────────

interface InstantlyEmail {
  id: string;
  subject: string;
  from_address_email: string;
  to_address_email_list: string;
  body: { text?: string; html?: string } | null;
  lead: string;
  lead_id: string;
  campaign_id: string | null;
  thread_id: string;
  ai_interest_value: number | null;
  content_preview: string | null;
  timestamp_created: string;
}

interface EmailListResponse {
  items: InstantlyEmail[];
  next_starting_after?: string;
}

interface LeadResponse {
  id: string;
  lead_email: string;
  lead_name: string | null;
  thread_id: string;
  campaign_id: string | null;
  persona_email: string;
  persona_name: string | null;
  company_domain: string | null;
  industry: string | null;
  response_text: string | null;
  zoho_lead_id: string | null;
  instantly_sent: boolean;
  nik_email_sent: boolean;
  sent_at: string;
  status: string;
  reply_to_uuid: string | null;
  original_subject: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractText(email: InstantlyEmail): string {
  if (email.body?.text) return email.body.text;
  if (email.body?.html) {
    return email.body.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return email.content_preview || '';
}

function extractDomain(email: string): string | null {
  const match = email.match(/@([^@\s]+)/);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  // Skip common free email providers
  const free = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
  return free.includes(domain) ? null : domain;
}

function parseLeadName(leadField: string): { firstName: string; lastName: string } {
  // leadField is typically the email or sometimes "First Last <email>"
  const cleaned = leadField.replace(/<[^>]+>/, '').trim();
  if (cleaned.includes('@')) {
    // Extract from email: john.doe@company.com → John Doe
    const local = cleaned.split('@')[0];
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
        lastName: parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1),
      };
    }
    return { firstName: parts[0]?.charAt(0).toUpperCase() + parts[0]?.slice(1) || 'There', lastName: '' };
  }
  const nameParts = cleaned.split(/\s+/);
  return {
    firstName: nameParts[0] || 'There',
    lastName: nameParts.slice(1).join(' ') || '',
  };
}

function extractPersonaName(email: string): string {
  // Extract first name from persona email like "sarahfreeman@atalnt.online"
  const local = email.split('@')[0];
  // Try to split camelCase or combined names
  const match = local.match(/^([a-z]+)/i);
  if (match) {
    const name = match[1];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return local;
}

// ── Instantly API ────────────────────────────────────────────────────

async function fetchInterestedEmails(apiKey: string): Promise<InstantlyEmail[]> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const allEmails: InstantlyEmail[] = [];
  let startAfter: string | undefined;

  // Fetch recent received emails and filter for interested
  while (true) {
    let url = 'https://api.instantly.ai/api/v2/emails?email_type=received&limit=50';
    if (startAfter) url += `&starting_after=${encodeURIComponent(startAfter)}`;

    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) break;

    const data: EmailListResponse = await resp.json();
    const items = data.items || [];

    // Only include emails with positive interest
    for (const email of items) {
      if (email.ai_interest_value != null && email.ai_interest_value >= 1) {
        allEmails.push(email);
      }
    }

    if (data.next_starting_after && allEmails.length < 100) {
      startAfter = data.next_starting_after;
    } else {
      break;
    }
  }

  return allEmails;
}

async function sendInstantlyReply(
  apiKey: string,
  replyToUuid: string,
  eaccount: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const resp = await fetch('https://api.instantly.ai/api/v2/emails/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eaccount,
      reply_to_uuid: replyToUuid,
      subject,
      body: { html: htmlBody },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Instantly reply failed: ${resp.status} ${errText}`);
  }
  return resp.ok;
}

// ── Supabase ─────────────────────────────────────────────────────────

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function supabaseUrl(path: string): string {
  return `${process.env.VITE_SUPABASE_URL}/rest/v1${path}`;
}

async function getRespondedLeads(): Promise<Set<string>> {
  const resp = await fetch(
    supabaseUrl('/lead_responses?select=lead_email'),
    { headers: supabaseHeaders() }
  );
  if (!resp.ok) return new Set();
  const rows: { lead_email: string }[] = await resp.json();
  return new Set(rows.map(r => r.lead_email.toLowerCase()));
}

async function getPendingPart2(): Promise<LeadResponse[]> {
  // Get leads where Part 1 sent but Part 2 not yet, and at least 10 min old
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const resp = await fetch(
    supabaseUrl(`/lead_responses?instantly_sent=eq.true&nik_email_sent=eq.false&sent_at=lt.${tenMinAgo}&select=*`),
    { headers: supabaseHeaders() }
  );
  if (!resp.ok) return [];
  return resp.json();
}

async function insertLeadResponse(data: Partial<LeadResponse>): Promise<boolean> {
  const resp = await fetch(supabaseUrl('/lead_responses'), {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok;
}

async function updateLeadResponse(id: string, data: Partial<LeadResponse>): Promise<boolean> {
  const resp = await fetch(supabaseUrl(`/lead_responses?id=eq.${id}`), {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify(data),
  });
  return resp.ok;
}

// ── Website Scraping ─────────────────────────────────────────────────

async function fetchWebsiteText(domain: string): Promise<string> {
  try {
    const resp = await fetch(`https://${domain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ATALNT-Bot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return '';
    const html = await resp.text();
    // Strip to text, limit to 2000 chars for Gemini
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000);
  } catch {
    return '';
  }
}

// ── Gemini API ───────────────────────────────────────────────────────

async function generateResponse(
  personaFirstName: string,
  leadReply: string,
  industry: string,
  companyInfo: string,
  bookingsUrl: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const industryContext = INDUSTRY_FRAMEWORKS[industry] || INDUSTRY_FRAMEWORKS.generic;

  const prompt = `${SYSTEM_PROMPT}

CONTEXT:
- Persona first name: ${personaFirstName}
- Lead's reply: "${leadReply.substring(0, 500)}"
- Company info from website: "${companyInfo.substring(0, 1000)}"
- ${industryContext}
- Bookings URL: ${bookingsUrl}

Write the email body now.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  return text.trim();
}

// ── Zoho OAuth (separate token for Mail+CRM) ────────────────────────

let cachedMailCrmToken: { token: string; expiresAt: number } | null = null;

async function getMailCrmAccessToken(): Promise<string> {
  if (cachedMailCrmToken && Date.now() < cachedMailCrmToken.expiresAt - 60000) {
    return cachedMailCrmToken.token;
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    refresh_token: process.env.ZOHO_MAIL_CRM_REFRESH_TOKEN!,
  });

  const resp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Zoho OAuth refresh failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  cachedMailCrmToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ── Email Formatting ─────────────────────────────────────────────────

const NIK_SIGNATURE = `<br><br>Nik Jain<br>Executive Partner<br>ATALNT | Talent + Technology Solutions<br>(214) 842-1104`;

function buildPersonaLoopInHtml(leadFirstName: string): string {
  return `<p>Hi ${leadFirstName},</p>
<p>Absolutely — I'm looping in Nik Jain, Managing Partner at ATALNT, who leads our consulting practice. He'll follow up shortly.</p>`;
}

function buildNikEmailHtml(leadFirstName: string, responseBody: string, bookingsUrl: string): string {
  // Convert plain text response to HTML paragraphs
  const htmlBody = responseBody
    .split('\n\n')
    .map(p => {
      // Convert bullet points
      if (p.trim().startsWith('- ') || p.trim().startsWith('• ')) {
        const items = p.split('\n').map(line =>
          `<li>${line.replace(/^[-•]\s*/, '')}</li>`
        ).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  // Replace bookings URL placeholder if Gemini included it
  const finalBody = htmlBody
    .replace(/\{bookings_url\}/g, bookingsUrl)
    .replace(/\[bookings_url\]/g, bookingsUrl)
    .replace(/grab a time here:?\s*/gi, `grab a time here: <a href="${bookingsUrl}">${bookingsUrl}</a> `);

  return `<p>Hi ${leadFirstName},</p>${finalBody}${NIK_SIGNATURE}`;
}

// ── Main Handler ─────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const instantlyApiKey = process.env.INSTANTLY_API_KEY;
  if (!instantlyApiKey) return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });

  const bookingsUrl = process.env.ZOHO_BOOKINGS_URL || 'https://admin-atalnt.zohobookings.com/#/4732308000000813002';

  const results = {
    part1_sent: 0,
    part2_sent: 0,
    crm_leads_created: 0,
    skipped_already_responded: 0,
    errors: [] as string[],
  };

  try {
    // ── PART 1: Process new interested leads ──────────────────────
    const interestedEmails = await fetchInterestedEmails(instantlyApiKey);
    const respondedLeads = await getRespondedLeads();

    for (const email of interestedEmails) {
      const leadEmail = email.from_address_email?.toLowerCase();
      if (!leadEmail || respondedLeads.has(leadEmail)) {
        results.skipped_already_responded++;
        continue;
      }

      // Determine persona (the Instantly account that was emailing them)
      const personaEmail = email.to_address_email_list?.split(',')[0]?.trim();
      if (!personaEmail) {
        results.errors.push(`No persona email for ${leadEmail}`);
        continue;
      }

      const personaFirstName = extractPersonaName(personaEmail);
      const { firstName: leadFirstName, lastName: leadLastName } = parseLeadName(email.lead || leadEmail);
      const domain = extractDomain(leadEmail);

      // Send Part 1: Instantly persona "looping in Nik"
      const loopInHtml = buildPersonaLoopInHtml(leadFirstName);
      const subject = email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || 'Your inquiry'}`;

      const sent = await sendInstantlyReply(
        instantlyApiKey,
        email.id,
        personaEmail,
        subject,
        loopInHtml
      );

      if (sent) {
        results.part1_sent++;
        // Log to Supabase
        await insertLeadResponse({
          lead_email: leadEmail,
          lead_name: `${leadFirstName} ${leadLastName}`.trim(),
          thread_id: email.thread_id,
          campaign_id: email.campaign_id,
          persona_email: personaEmail,
          persona_name: personaFirstName,
          company_domain: domain,
          reply_to_uuid: email.id,
          original_subject: subject,
          instantly_sent: true,
          nik_email_sent: false,
          status: 'part1_sent',
        });
        respondedLeads.add(leadEmail); // Prevent processing same lead twice in this run
      } else {
        results.errors.push(`Part 1 failed for ${leadEmail}`);
      }
    }

    // ── PART 2: Send Nik's email for leads ready (10+ min old) ────
    const pendingPart2 = await getPendingPart2();

    for (const lead of pendingPart2) {
      try {
        // Fetch website for company research
        let websiteText = '';
        let industry = 'generic';
        let companyName = lead.company_domain || 'their company';

        if (lead.company_domain) {
          websiteText = await fetchWebsiteText(lead.company_domain);
          if (websiteText) {
            industry = detectIndustry(websiteText);
            // Try to extract company name from website
            const titleMatch = websiteText.match(/^([^|–—\-]{3,50})/);
            if (titleMatch) companyName = titleMatch[1].trim();
          }
        }

        // Get the lead's original reply text (fetch from Instantly)
        let leadReplyText = 'expressed interest in learning more';
        try {
          const emailResp = await fetch(
            `https://api.instantly.ai/api/v2/emails/${lead.reply_to_uuid}`,
            {
              headers: {
                Authorization: `Bearer ${instantlyApiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (emailResp.ok) {
            const emailData = await emailResp.json();
            leadReplyText = extractText(emailData) || leadReplyText;
          }
        } catch {
          // Use fallback text
        }

        // Generate customized response via Gemini
        const responseBody = await generateResponse(
          lead.persona_name || 'Our team',
          leadReplyText,
          industry,
          websiteText,
          bookingsUrl
        );

        // Get Zoho access token for Mail + CRM
        const zohoToken = await getMailCrmAccessToken();

        // Send Nik's email via Zoho Mail
        const { firstName: leadFirstName } = parseLeadName(lead.lead_name || lead.lead_email);
        const nikEmailHtml = buildNikEmailHtml(leadFirstName, responseBody, bookingsUrl);
        const emailSubject = lead.original_subject || 'Re: Following up';

        const mailResult = await sendEmailAsNik(
          zohoToken,
          lead.lead_email,
          emailSubject,
          nikEmailHtml,
          'admin@atalnt.com' // CC
        );

        if (!mailResult.success) {
          results.errors.push(`Nik email failed for ${lead.lead_email}: ${mailResult.error}`);
          continue;
        }

        results.part2_sent++;

        // Create Zoho CRM lead (skip if already exists)
        let zohoLeadId: string | undefined;
        const isDuplicate = await checkDuplicateLead(zohoToken, lead.lead_email);
        if (!isDuplicate) {
          const { firstName, lastName } = parseLeadName(lead.lead_name || lead.lead_email);
          const crmResult = await createCrmLead(zohoToken, {
            firstName,
            lastName: lastName || 'Unknown',
            email: lead.lead_email,
            company: companyName,
            leadSource: 'Instantly Outbound',
            description: `Industry: ${industry}. Campaign: ${lead.campaign_id || 'N/A'}`,
          });
          if (crmResult.success) {
            zohoLeadId = crmResult.leadId;
            results.crm_leads_created++;
          } else {
            results.errors.push(`CRM lead failed for ${lead.lead_email}: ${crmResult.error}`);
          }
        }

        // Update Supabase
        await updateLeadResponse(lead.id, {
          nik_email_sent: true,
          industry,
          response_text: responseBody,
          zoho_lead_id: zohoLeadId || null,
          status: 'completed',
        });
      } catch (err: any) {
        results.errors.push(`Part 2 error for ${lead.lead_email}: ${err.message}`);
        await updateLeadResponse(lead.id, { status: 'error' });
      }
    }

    console.log('Lead responder result:', JSON.stringify(results));
    return res.status(200).json({
      ...results,
      interested_found: interestedEmails.length,
      pending_part2: pendingPart2.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Lead responder error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
