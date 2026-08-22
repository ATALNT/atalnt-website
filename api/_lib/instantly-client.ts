// ============================================
// Instantly v2 client shared by the command center and the aggregate cron.
//
// Instantly rate-limits ~20 req/min per WORKSPACE. The health guard, the
// dialer portals and this dashboard all share that budget, so every call here
// is sequential with exponential backoff that honors Retry-After. Never fan
// out in parallel from this module.
// ============================================

const BASE = 'https://api.instantly.ai/api/v2';

function headers(): Record<string, string> {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) throw new Error('INSTANTLY_API_KEY not configured');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'User-Agent': 'atalnt-command-center',
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function instantly<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  tries = 6
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}/${path.replace(/^\//, '')}`;
  for (let i = 0; i < tries; i++) {
    let r: Response;
    try {
      r = await fetch(url, {
        method: init.method || 'GET',
        headers: headers(),
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      await sleep(Math.min(1500 * 2 ** i, 20_000));
      continue;
    }
    if (r.status === 429 || r.status >= 500) {
      const ra = Number(r.headers.get('retry-after'));
      const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60_000) : Math.min(1500 * 2 ** i, 20_000);
      await sleep(wait + Math.floor(Math.random() * 400));
      continue;
    }
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`Instantly ${r.status} on ${path}: ${text.slice(0, 200)}`);
    }
    const text = await r.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
  throw new Error(`Instantly unreachable after ${tries} tries: ${path}`);
}

/** Walk a paginated list endpoint to the end. GET with ?starting_after. */
export async function instantlyList<T = unknown>(path: string, limit = 100): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await instantly<{ items?: T[]; next_starting_after?: string }>(
      `${path}${sep}limit=${limit}${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`
    );
    out.push(...(page.items || []));
    if (!page.next_starting_after) break;
    after = page.next_starting_after;
  }
  return out;
}

/** Walk POST /leads/list for one campaign. Optional cap stops early for samples. */
export async function instantlyLeads<T = unknown>(campaignId: string, cap = Infinity): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  while (out.length < cap) {
    const body: Record<string, unknown> = { campaign: campaignId, limit: 100 };
    if (after) body.starting_after = after;
    const page = await instantly<{ items?: T[]; next_starting_after?: string }>('leads/list', { method: 'POST', body });
    const items = page.items || [];
    if (!items.length) break;
    out.push(...items);
    if (!page.next_starting_after) break;
    after = page.next_starting_after;
  }
  return out.slice(0, cap);
}

// ---- shapes we actually read off Instantly responses ----
export type Json = Record<string, unknown>;
export interface InstantlyLead {
  id: string; email: string; first_name?: string; last_name?: string; company_name?: string;
  title?: string; status?: number; email_reply_count?: number; lt_interest_status?: number | null;
  timestamp_last_contact?: string | null; payload?: Json;
}
export interface InstantlyEmail {
  id: string; thread_id: string; campaign_id?: string; eaccount?: string; ue_type?: number;
  from_address_email?: string; from_address_json?: { name?: string } | { name?: string }[];
  to_address_email_list?: string[] | string; subject?: string; content_preview?: string;
  body?: string | { text?: string; html?: string }; timestamp_email?: string; timestamp_created?: string;
  is_unread?: boolean | number; i_status?: number | null;
}
export interface InstantlyCampaign {
  id: string; name: string; status: number; email_list?: string[]; timestamp_created?: string;
  campaign_schedule?: { schedules?: { timing?: { from: string; to: string }; days?: Record<string, boolean>; timezone?: string }[] };
  sequences?: { steps?: { delay?: number; variants?: { subject?: string; body?: string }[] }[] }[];
}
export interface DailyRow { date: string; sent?: number; unique_replies?: number; unique_replies_automatic?: number; opportunities?: number }
export interface StepRow { step?: string; variant?: string | null; sent?: number; unique_replies?: number }
export const toList = (v: string[] | string | undefined): string[] =>
  Array.isArray(v) ? v : (v || '').split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);

export const emailText = (e: Pick<InstantlyEmail, 'body' | 'content_preview'>): string =>
  typeof e.body === 'object' && e.body ? (e.body.text || e.body.html || '') : (typeof e.body === 'string' ? e.body : '') || e.content_preview || '';

/**
 * Only what the person actually typed. Everything after the first quoted-thread
 * marker is OUR email echoed back, and it is full of our own pitch words
 * ("send you the product overview"), which is how "Thank you! R/ Tom" got
 * classified as a demo request.
 */
export function replyOnly(raw: string): string {
  let t = (raw || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const cut = t.search(/(-{3,}\s*Original Message\s*-{3,}|^\s*From:\s[^\n]{1,160}\n\s*(Sent|Date|To):|\bOn .{5,80}\bwrote:|^\s*>\s|_{10,}|={10,}|Sent from my (iPhone|iPad|Galaxy|Android)|Get Outlook for)/im);
  if (cut > 0) t = t.slice(0, cut);
  return t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

// ---- shared classification, used by the dashboard AND the aggregate cron ----

export const FREE_MAILBOX_RE = /@(gmail|yahoo|hotmail|outlook|aol|icloud|live|msn)\.com$/i;
export const isIsolated = (name?: string) => (name || '').startsWith('ISOLATED:');

export type ReplyClass = 'demo' | 'positive' | 'neutral' | 'negative' | 'wrong_person' | 'auto';

// Tuned against 387 real replies on 2026-08-22. Order matters: machine mail
// first (it contains positive words like "thank you"), then departures, then
// intent. Every pattern below came from a misclassification seen in the feed.
const MACHINE_SENDER_RE = /^(do-?not-?reply|no-?reply|noreply|mailer-daemon|postmaster|bounce|notification|alerts?|system|admin|security|quarantine|mail(er)?)[@.-]|@(sophosemail|mimecast|proofpoint|barracuda|messagelabs|mailgun|sendgrid|amazonses)\./i;
const AUTO_RE = /message was rejected|delivery (has )?failed|undeliverable|mailbox (is )?full|from a public email service|verify the sender|leave of absence|expect a delay in my response|out[- ]of[- ](the[- ])?office|out on assignment|(attending|at) (the |an? )?(expo|conference|show|event)|traveling with limited|requires that you verify|verification was received|is almost there|your message (has been|was) (received|quarantined)|message to .* is almost|\booo\b|automatic repl|auto-?(matic|mated)? ?(repl|response|message)|this is an automated|away from (my|the) (desk|office)|on (vacation|holiday|leave|pto|sabbatical)|annual leave|currently (out|away|traveling|travelling)|will (be )?(return|back)|returning (to the office )?on|limited (access|availability)|not (checking|monitoring) (email|my inbox)|maternity|paternity|thank you for (your|the) (e-?mail|message)[.,!]? I (am|will be|'m)|if (your|this) (matter|request) is urgent|for (immediate|urgent) (assistance|matters)/i;
const DEPARTED_RE = /no\s+longer\s+(an?\s+)?(employ|with|at|work|here|part\s+of|associated|being\s+monitored|monitored)|(now\s+)?(officially\s+)?retired|retired from|will be retired|(is|am) (now|my) replacement|(now|is) the primary contact|(please )?direct (any|all) (needs|questions|inquiries|future)|(email|e-mail|address) (is being|has been) (discontinued|changed)|my (email )?address has chang|after \d+ years with|transition from|please (re-?send|resend)|no longer (an? )?(employ|with|at|work|here|part of|associated)|(has|have) (left|departed|retired|moved on)|is not (with|at) (the company|us)|\bi (am|'m) retired\b|(account|mailbox|email) (is )?(no longer|not) (be(ing)? )?(monitored|active|in use)|this (email|address) is no longer|escaped from (my|this) .* email/i;
const WRONG_RE = /wrong (person|contact|department)|not the (right|correct|appropriate) (person|contact)|i (don'?t|do not) (handle|manage|oversee|deal with)|not my (area|department|role|responsibility)|(please|kindly) (contact|reach out to|email|forward (this )?to)|(forwarded|passed) (this|your (email|message)) (on )?to|you('ll| will) want to (talk|speak) (to|with)|(best|right) person (to|for|would be)|handled by|(our|the) (hr|talent|recruiting|people) (team|department)/i;
const NEG_RE = /\bno,? thank|\bnot interested|no interest|please (remove|unsubscribe|take me off)|remove me|unsubscribe|stop (emailing|contacting|sending)|do not (contact|email)|not a (good )?fit|we('re| are) (good|all set|covered|fine)|no need|not (looking|hiring|at this time)|don'?t (need|want)|no thanks|pass on this|not for us/i;
const DEMO_RE = /\b(please |can you |could you |go ahead and )?(send|share|shoot|forward)( me| it| that| over| us)?\b[^.]{0,40}\b(overview|demo|deck|info|information|details|pricing|proposal|one[- ]pager|video)|\b(demo|overview|walkthrough|call|meeting)\b[^.]{0,40}\b(yes|sure|please|sounds good|works|interested|would (be|love|work))|\byes[^.]{0,40}\b(demo|overview|hear more|send|call)|\b(book|schedule|set ?up|find) (a |some )?(call|time|meeting|demo|slot)|let'?s (talk|chat|connect|meet|set)|give me a call|happy to (chat|talk|connect|meet|hop on)|what (does|would) (it|this) cost|how much (is|does)|what('s| is) the (price|pricing|cost)|tell me more|hear more|more (info|information|details)|\bcalendar\b|\bcalendly\b/i;
const POS_RE = /\binterested\b|sounds (good|great|interesting|promising)|open to (it|this|that|hearing|learning)|\bcurious\b|worth (a |exploring|discussing)|i('d| would) (like|love) to|let me (know|think)|\byes\b|sure[,.!]|(good|great|perfect) timing|\bintrigu/i;

/**
 * Classify a reply. Instantly's own lt_interest_status wins when set
 * (1 interested, -1 not interested, -2 wrong person). Otherwise rules tuned on
 * the real feed: machine senders and auto-replies are checked FIRST because
 * they are full of positive words ("thank you for your email").
 */
const COURTESY_ONLY_RE = /^\s*(thank(s| you)!?[.,!]?\s*)+(r\/|regards|best|cheers|thx|-)?\s*[a-z .]{0,30}$/i;

export function classifyReply(text: string, interest?: number | null, fromEmail?: string): ReplyClass {
  const t = (text || '').slice(0, 1500);
  if (COURTESY_ONLY_RE.test(t)) return 'neutral';
  if (fromEmail && MACHINE_SENDER_RE.test(fromEmail)) return 'auto';
  if (AUTO_RE.test(t)) return 'auto';
  if (DEPARTED_RE.test(t)) return 'wrong_person';
  if (interest === -2) return 'wrong_person';
  if (interest === -1) return 'negative';
  if (interest === 1 || interest === 2 || interest === 3) return DEMO_RE.test(t) ? 'demo' : 'positive';
  if (WRONG_RE.test(t)) return 'wrong_person';
  if (NEG_RE.test(t)) return 'negative';
  if (DEMO_RE.test(t)) return 'demo';
  if (POS_RE.test(t)) return 'positive';
  return 'neutral';
}

export function titleGroup(title?: string): string {
  const t = (title || '').toLowerCase();
  if (!t) return 'Unknown';
  if (/talent acquisition|recruit|sourcer|head of ta\b/.test(t)) return 'Talent Acquisition';
  if (/chief people|chro|human resource|\bhr\b|people operations|people officer/.test(t)) return 'HR / People';
  if (/\bceo\b|chief executive|founder|owner|president|principal/.test(t)) return 'Founder / CEO';
  if (/\bcoo\b|chief operating|operations|plant manager|general manager/.test(t)) return 'Operations';
  if (/\bcfo\b|chief financial|controller|finance|accounting/.test(t)) return 'Finance';
  if (/\bcto\b|\bcio\b|engineering|technology/.test(t)) return 'Engineering';
  if (/vice president|\bvp\b|director|head of/.test(t)) return 'VP / Director';
  return 'Other';
}

/** Render an Instantly HTML step body to plain text the way a recipient sees it. */
export function renderStep(html: string, vars: Record<string, unknown>, firstName: string, senderName: string): string {
  let b = html || '';
  for (const [k, v] of Object.entries(vars)) b = b.split(`{{${k}}}`).join(String(v ?? ''));
  b = b.split('{{firstName}}').join(firstName || 'there').split('{{sendingAccountName}}').join(senderName);
  b = b.replace(/<\/div>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  b = b.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return b.replace(/\n{3,}/g, '\n\n').trim();
}
