// ============================================
// GET /api/instantly/cron-reply-manager — Auto-Read & Interest Catcher
// Runs twice daily (6 AM & 4 PM CST). Reads all unread Unibox replies,
// marks them as read, and catches missed positive responses that
// Instantly's AI didn't flag as "interested."
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 300;

// ── Classification keywords ──────────────────────────────────────────
// Conservative approach: only mark interested when clear positive signal
// exists AND no negative signal is present.

const POSITIVE_SIGNALS = [
  // Direct interest
  'interested',
  'i am interested',
  "i'm interested",
  'tell me more',
  'more info',
  'more information',
  'send me more',
  'send over',
  'send details',
  'love to learn more',
  "i'd love to",
  'i would love to',
  "i'd like to",
  'i would like to',
  'like to learn more',
  'like to know more',
  'want to learn more',
  'want to know more',

  // Meeting / call intent
  "let's chat",
  'lets chat',
  "let's talk",
  'lets talk',
  "let's connect",
  'lets connect',
  "let's set up",
  'lets set up',
  'schedule a call',
  'set up a time',
  'set up a meeting',
  'book a time',
  'book a call',
  'book a meeting',
  'when are you available',
  'your availability',
  'your calendar',
  'send me a calendar',
  'send a calendar',
  'calendar link',
  'calendly',

  // Positive acknowledgment
  'sounds good',
  'sounds great',
  'sounds interesting',
  'this is great',
  'worth a conversation',
  'open to',
  'open to chatting',
  'open to hearing',
  'open to learning',
  'definitely interested',
  'absolutely interested',
  'yes please',
  'yes, please',
  'count me in',

  // Forwarding / referral (they want someone else to see it)
  'forward this to',
  'pass this along',
  'passing this to',
  'forwarding to',
  'cc my colleague',
  'cc my team',
  "i'll connect you with",
  'connect you with',
  'loop in my',
  'looping in my',
  'the right person to talk to',

  // Asking for proposal / pricing
  'send me a proposal',
  'send a proposal',
  'what are your rates',
  'your pricing',
  'your fees',
  'how much',
  'what does it cost',
  'what would it cost',
  'send me pricing',
];

const NEGATIVE_SIGNALS = [
  // Explicit rejection
  'not interested',
  'no thanks',
  'no thank you',
  'no, thanks',
  'no, thank you',
  'not for us',
  'not a fit',
  'not a good fit',
  'not the right fit',
  'not looking',
  'not hiring',
  'not in the market',
  'pass on this',
  "we'll pass",
  "i'll pass",
  'decline',
  'not at this time',
  'maybe later',
  'not right now',

  // Unsubscribe / removal
  'unsubscribe',
  'remove me',
  'remove my',
  'take me off',
  'opt out',
  'opt-out',
  'stop emailing',
  'stop contacting',
  'stop sending',
  'do not contact',
  'do not email',
  'don\'t contact',
  'don\'t email',
  'cease and desist',
  'spam',
  'reported',
  'block',

  // Auto-replies and OOO
  'out of office',
  'out of the office',
  'on vacation',
  'on holiday',
  'on leave',
  'on pto',
  'away from',
  'auto-reply',
  'auto reply',
  'automatic reply',
  'automated response',
  'auto response',
  'auto-response',
  'this is an automated',
  'do-not-reply',
  'do not reply',
  'noreply',
  'no-reply',
  'mailer-daemon',
  'delivery failed',
  'undeliverable',
  'returned mail',
  'message not delivered',

  // No longer at company
  'no longer with',
  'no longer at',
  'no longer an employee',
  'no longer employed',
  'left the company',
  'last day with',
  'last day at',
  'moved on from',
  'retired',
  'for inquiries after',
  'please direct',

  // Limited availability (OOO variant)
  'limited access to email',
  'limited availability',
  'limited availabiity',
  'limited email access',
  'will return on',
  'i will be out',
  'i am out',
  'will be back',
  'return to the office',
  'returning on',
  'back in the office',
  'out of the country',
  'out of town',
  'traveling until',

  // Legal / compliance
  'gdpr',
  'data protection',
  'privacy request',
  'legal action',
  'lawyer',
  'attorney',
];

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
  is_unread: number;
  is_auto_reply: number;
  ai_interest_value: number | null;
  content_preview: string | null;
  timestamp_created: string;
  i_status: string | null;
}

interface EmailListResponse {
  items: InstantlyEmail[];
  next_starting_after?: string;
}

type Classification = 'interested' | 'not_interested' | 'ooo' | 'auto_reply' | 'neutral';

function extractText(email: InstantlyEmail): string {
  if (email.body?.text) return email.body.text;
  if (email.body?.html) {
    // Strip HTML tags for analysis
    return email.body.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return email.content_preview || '';
}

function classifyReply(email: InstantlyEmail): Classification {
  // Auto-reply flag from Instantly
  if (email.is_auto_reply === 1) return 'auto_reply';

  const text = extractText(email).toLowerCase();
  if (!text || text.length < 3) return 'neutral';

  // Check negative signals first (takes priority)
  const hasNegative = NEGATIVE_SIGNALS.some(signal => text.includes(signal));

  // Subcategorize negatives
  if (hasNegative) {
    const isOOO = [
      'out of office', 'out of the office', 'on vacation', 'on holiday',
      'on leave', 'on pto', 'away from', 'auto-reply', 'auto reply',
      'automatic reply', 'automated response', 'auto response', 'auto-response',
      'this is an automated', 'do-not-reply', 'do not reply', 'noreply',
      'no-reply', 'mailer-daemon', 'delivery failed', 'undeliverable',
      'returned mail', 'message not delivered', 'limited access to email',
      'limited availability', 'limited availabiity', 'limited email access',
      'will return on', 'i will be out', 'i am out', 'will be back',
      'return to the office', 'returning on', 'back in the office',
      'out of the country', 'out of town', 'traveling until',
      'no longer an employee', 'no longer employed', 'no longer with',
      'no longer at', 'last day with', 'last day at', 'left the company',
    ].some(signal => text.includes(signal));

    if (isOOO) return 'ooo';
    return 'not_interested';
  }

  // Check positive signals
  const hasPositive = POSITIVE_SIGNALS.some(signal => text.includes(signal));
  if (hasPositive) return 'interested';

  // Short replies that are just greetings or one-word answers — neutral
  return 'neutral';
}

async function fetchAllUnreadReplies(apiKey: string): Promise<InstantlyEmail[]> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const allEmails: InstantlyEmail[] = [];
  let startAfter: string | undefined;

  while (true) {
    let url = 'https://api.instantly.ai/api/v2/emails?is_unread=true&email_type=received&limit=50';
    if (startAfter) {
      url += `&starting_after=${encodeURIComponent(startAfter)}`;
    }

    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Instantly emails API error ${resp.status}: ${errText}`);
    }

    const data: EmailListResponse = await resp.json();
    const items = data.items || [];
    allEmails.push(...items);

    if (data.next_starting_after) {
      startAfter = data.next_starting_after;
    } else {
      break;
    }
  }

  return allEmails;
}

async function markThreadRead(threadId: string, headers: Record<string, string>): Promise<boolean> {
  // Try thread-level mark-as-read first
  const resp = await fetch(
    `https://api.instantly.ai/api/v2/emails/threads/${encodeURIComponent(threadId)}/mark-as-read`,
    { method: 'POST', headers }
  );
  if (resp.ok) return true;

  // If thread endpoint fails, try PATCH on individual email
  console.warn(`Thread mark-read failed for ${threadId}: ${resp.status}`);
  return false;
}

async function markEmailRead(emailId: string, headers: Record<string, string>): Promise<boolean> {
  const resp = await fetch(
    `https://api.instantly.ai/api/v2/emails/${encodeURIComponent(emailId)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_unread: 0 }),
    }
  );
  if (!resp.ok) {
    console.warn(`Email mark-read failed for ${emailId}: ${resp.status}`);
  }
  return resp.ok;
}

async function updateInterestStatus(
  leadEmail: string,
  interestValue: number,
  headers: Record<string, string>,
  campaignId?: string | null
): Promise<boolean> {
  const body: Record<string, any> = {
    lead_email: leadEmail,
    interest_value: interestValue,
  };
  if (campaignId) body.campaign = campaignId;

  const resp = await fetch('https://api.instantly.ai/api/v2/leads/update-interest-status', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return resp.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check kill switch
  try {
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sbUrl = process.env.VITE_SUPABASE_URL!;
    const settingResp = await fetch(
      `${sbUrl}/rest/v1/automation_settings?key=eq.reply_manager&select=enabled`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    );
    if (settingResp.ok) {
      const rows = await settingResp.json();
      if (rows.length > 0 && !rows[0].enabled) {
        return res.status(200).json({ skipped: true, reason: 'Reply manager is disabled via kill switch' });
      }
    }
  } catch { /* If Supabase is down, proceed anyway */ }

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // Step 1: Fetch all unread received emails
    const unreadEmails = await fetchAllUnreadReplies(apiKey);

    // Step 2: Classify each reply and take action
    const results = {
      total_unread: unreadEmails.length,
      marked_read: 0,
      new_interested: 0,
      not_interested: 0,
      ooo: 0,
      auto_reply: 0,
      neutral: 0,
      errors: 0,
      interested_leads: [] as string[],
    };

    // Dedupe threads so we only mark-read once per thread
    const processedThreads = new Set<string>();

    for (const email of unreadEmails) {
      const classification = classifyReply(email);

      // Count by classification
      switch (classification) {
        case 'interested':
          results.new_interested++;
          results.interested_leads.push(
            `${email.lead} — "${extractText(email).substring(0, 100)}"`
          );
          break;
        case 'not_interested': results.not_interested++; break;
        case 'ooo': results.ooo++; break;
        case 'auto_reply': results.auto_reply++; break;
        case 'neutral': results.neutral++; break;
      }

      // If classified as interested, update lead status in Instantly
      if (classification === 'interested') {
        const ok = await updateInterestStatus(email.lead, 1, headers, email.campaign_id);
        if (!ok) results.errors++;
      }

      // Mark as read — try thread-level first, fall back to email-level
      let markedRead = false;
      if (!processedThreads.has(email.thread_id)) {
        processedThreads.add(email.thread_id);
        markedRead = await markThreadRead(email.thread_id, headers);
      }
      if (!markedRead) {
        markedRead = await markEmailRead(email.id, headers);
      }
      if (markedRead) {
        results.marked_read++;
      } else {
        results.errors++;
      }
    }

    console.log('Reply manager result:', JSON.stringify(results));
    return res.status(200).json({
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Reply manager error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
