// ============================================
// /api/instantly/cron?task=health — Health Score Auto-Manager
//
// THE MECHANISM THAT ACTUALLY WORKS (settled 2026-07-09 after hard evidence):
// campaigns can only send from mailboxes in their sender list (email_list).
// So the health rhythm is enforced by SENDER-LIST MEMBERSHIP:
//   health >= 97  -> present in every active campaign's email_list, daily_limit 20
//   health <= 96  -> REMOVED from every active campaign's email_list, daily_limit 0
// Accounts are NEVER paused (pausing stops warmup — user-verified: paused
// accounts show 0 warmup emails). Removed accounts stay active so warmup
// keeps healing them; once they hit 97 they are auto-added back.
//
// Why not daily_limit:0 alone? PROVEN INSUFFICIENT: accounts at limit 0
// (active, verified clean 2026-07-08 evening) still sent 22-30 campaign emails
// on 2026-07-09. Instantly does not reliably honor 0 as "off". Limits are kept
// only as a belt (20 cap for healthy, 0 for sub-97), never as the off switch.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MIN_SCORE = 97;
const DEFAULT_DAILY_LIMIT = 20;

interface InstantlyAccount {
  email: string;
  status: number; // 1=active, 2=paused, -1=error
  daily_limit: number | null;
  stat_warmup_score: number | null;
}

interface InstantlyCampaign {
  id: string;
  name?: string;
  status: number; // 1=active
  email_list?: string[];
}

interface ListResponse<T> {
  items: T[];
  next_starting_after?: string;
}

async function fetchAll<T>(base: string, headers: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let startAfter: string | undefined;
  while (true) {
    const url = `${base}${base.includes('?') ? '&' : '?'}limit=100${startAfter ? `&starting_after=${encodeURIComponent(startAfter)}` : ''}`;
    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) break;
    const data: ListResponse<T> = await resp.json();
    out.push(...(data.items || []));
    if (data.next_starting_after) startAfter = data.next_starting_after;
    else break;
  }
  return out;
}

async function resumeAccount(email: string, headers: Record<string, string>): Promise<boolean> {
  const resp = await fetch(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(email)}/resume`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  return resp.ok;
}

async function setDailyLimit(email: string, limit: number, headers: Record<string, string>): Promise<void> {
  await fetch(`https://api.instantly.ai/api/v2/accounts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ daily_limit: limit }),
  });
}

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });
  const dailyLimit = Number(process.env.INSTANTLY_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    const accounts = await fetchAll<InstantlyAccount>('https://api.instantly.ai/api/v2/accounts', headers);
    const healthy = new Set(
      accounts.filter((a) => (a.stat_warmup_score ?? 0) >= MIN_SCORE && a.status !== -1).map((a) => a.email.toLowerCase())
    );

    // 1) Belt: limits (never the off switch, but keeps intent visible + caps healthy at 20)
    const desired = (a: InstantlyAccount) => (healthy.has(a.email.toLowerCase()) ? dailyLimit : 0);
    const toFix = accounts.filter((a) => (a.daily_limit ?? -1) !== desired(a));
    const BATCH = 15;
    for (let i = 0; i < toFix.length; i += BATCH) {
      await Promise.all(toFix.slice(i, i + BATCH).map((a) => setDailyLimit(a.email, desired(a), headers)));
    }

    // 2) Never leave anything paused (pausing stops warmup)
    const paused = accounts.filter((a) => a.status === 2);
    const resumedEmails: string[] = [];
    for (let i = 0; i < paused.length; i += BATCH) {
      await Promise.all(
        paused.slice(i, i + BATCH).map(async (a) => {
          await setDailyLimit(a.email, desired(a), headers); // limit correct BEFORE it goes active
          if (await resumeAccount(a.email, headers)) resumedEmails.push(a.email);
        })
      );
    }

    // 3) THE OFF SWITCH: sync every active campaign's sender list to healthy-only.
    //    Removes sub-97 mailboxes (they cannot send at all), adds back healed ones.
    const campaigns = await fetchAll<InstantlyCampaign>('https://api.instantly.ai/api/v2/campaigns', headers);
    const active = campaigns.filter((c) => c.status === 1);
    const healthyList = accounts
      .filter((a) => healthy.has(a.email.toLowerCase()))
      .map((a) => a.email);

    const campaignChanges: { campaign: string; removed: number; added: number; senders: number; verified: boolean }[] = [];
    for (const c of active) {
      const resp = await fetch(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, { method: 'GET', headers });
      if (!resp.ok) continue;
      const full: InstantlyCampaign = await resp.json();
      const current = (full.email_list || []).map((e) => e.toLowerCase());
      const currentSet = new Set(current);
      const removed = current.filter((e) => !healthy.has(e)).length;
      const added = healthyList.filter((e) => !currentSet.has(e.toLowerCase())).length;
      if (removed === 0 && added === 0) {
        campaignChanges.push({ campaign: full.name || c.id, removed: 0, added: 0, senders: current.length, verified: true });
        continue;
      }
      const patch = await fetch(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ email_list: healthyList }),
      });
      // Verify with a fresh GET — never trust the write.
      let verified = false;
      let senders = 0;
      if (patch.ok) {
        const check = await fetch(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, { method: 'GET', headers });
        if (check.ok) {
          const after: InstantlyCampaign = await check.json();
          const el = (after.email_list || []).map((e) => e.toLowerCase());
          senders = el.length;
          verified = el.every((e) => healthy.has(e));
        }
      }
      // QUEUE FLUSH (proven 2026-07-09): removing a mailbox from email_list does
      // NOT cancel its already-queued sends — the queue keeps draining. A
      // pause -> activate cycle rebuilds the queue from the current sender list.
      // Campaign-level pause does not affect account warmup.
      if (verified && removed > 0) {
        await fetch(`https://api.instantly.ai/api/v2/campaigns/${c.id}/pause`, { method: 'POST', headers, body: '{}' });
        await new Promise((r) => setTimeout(r, 1000));
        await fetch(`https://api.instantly.ai/api/v2/campaigns/${c.id}/activate`, { method: 'POST', headers, body: '{}' });
        const chk2 = await fetch(`https://api.instantly.ai/api/v2/campaigns/${c.id}`, { method: 'GET', headers });
        if (chk2.ok && ((await chk2.json()) as InstantlyCampaign).status !== 1) {
          verified = false; // campaign not active after flush — surface it
        }
      }
      campaignChanges.push({ campaign: full.name || c.id, removed, added, senders, verified });
    }

    const result = {
      total_accounts: accounts.length,
      healthy_97_plus: healthy.size,
      unhealthy_delisted: accounts.length - healthy.size,
      limits_fixed: toFix.length,
      resumed: resumedEmails.length,
      active_campaigns_synced: campaignChanges.length,
      campaigns: campaignChanges,
      policy:
        'off switch = sender-list membership: sub-97 removed from all active campaigns (cannot send), 97+ present + capped 20/day; never pause (pausing stops warmup); daily_limit 0 kept as belt only',
      timestamp: new Date().toISOString(),
    };
    console.log('Health manager result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Health manager error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
