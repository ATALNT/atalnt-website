// ============================================
// GET /api/instantly/cron-prune-leads — Daily Lead Pruner
// Walks every non-deleted campaign and removes dead-weight leads to keep the
// account under its 50k lead cap and the campaigns clean:
//   status -1 (bounced)                         -> delete
//   status  3 (completed) AND 0 replies         -> delete
// NEVER deletes a lead that has any reply (email_reply_count > 0) — that
// protects every responder and interested lead, even though Instantly stamps
// repliers as "completed" (stop_on_reply). Runs once a day before sends start
// (see vercel.json; 10:00 UTC = ~6 AM Eastern) so overnight bounces have fully
// registered and each campaign starts the day clean.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface InstantlyCampaign {
  id: string;
  name?: string;
  status: number; // 1 active, 2 paused, 3 done, 0 draft, -1 deleted
}

interface InstantlyLead {
  id: string;
  status: number; // 1 active, 3 completed, -1 bounced
  email_reply_count: number | null;
  campaign: string;
}

interface ListResponse<T> {
  items: T[];
  next_starting_after?: string;
}

const STATUS_BOUNCED = -1;
const STATUS_COMPLETED = 3;
const STATUS_DELETED_CAMPAIGN = -1;

async function fetchAllCampaigns(headers: Record<string, string>): Promise<InstantlyCampaign[]> {
  const out: InstantlyCampaign[] = [];
  let startAfter: string | undefined;
  while (true) {
    const url = `https://api.instantly.ai/api/v2/campaigns?limit=100${startAfter ? `&starting_after=${encodeURIComponent(startAfter)}` : ''}`;
    const resp = await fetch(url, { method: 'GET', headers });
    if (!resp.ok) break;
    const data: ListResponse<InstantlyCampaign> = await resp.json();
    out.push(...(data.items || []));
    if (data.next_starting_after) startAfter = data.next_starting_after;
    else break;
  }
  return out;
}

// Scan one campaign's leads and return the ids that are safe to delete.
// A lead is safe to delete only if it has ZERO replies AND is bounced or completed.
async function scanCampaignForDeadLeads(campaignId: string, headers: Record<string, string>): Promise<string[]> {
  const deadIds: string[] = [];
  let startAfter: string | undefined;
  while (true) {
    const body: Record<string, unknown> = { campaign: campaignId, limit: 100 };
    if (startAfter) body.starting_after = startAfter;
    const resp = await fetch('https://api.instantly.ai/api/v2/leads/list', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) break;
    const data: ListResponse<InstantlyLead> = await resp.json();
    for (const lead of data.items || []) {
      if (lead.campaign !== campaignId) continue; // defensive: only this campaign
      const replies = lead.email_reply_count || 0;
      if (replies > 0) continue; // PROTECT every responder, always
      if (lead.status === STATUS_BOUNCED || lead.status === STATUS_COMPLETED) {
        deadIds.push(lead.id);
      }
    }
    if (data.next_starting_after) startAfter = data.next_starting_after;
    else break;
  }
  return deadIds;
}

// Delete a single lead. DELETE must NOT carry a Content-Type/body or Instantly errors.
async function deleteLead(id: string, authHeader: Record<string, string>): Promise<boolean> {
  const resp = await fetch(`https://api.instantly.ai/api/v2/leads/${id}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  return resp.ok;
}

async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

export const maxDuration = 300;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'INSTANTLY_API_KEY not configured' });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const authOnly = { Authorization: `Bearer ${apiKey}` };

  try {
    // ISOLATED: campaigns (dialer companion for daniel@/gabriel@) are exempt.
    // Their completed leads are the dedupe record that stops a re-pasted ZoomInfo
    // list from re-emailing someone — deleting them would erase that memory.
    const campaigns = (await fetchAllCampaigns(headers)).filter(
      (c) => c.status !== STATUS_DELETED_CAMPAIGN && !(c.name || '').startsWith('ISOLATED:')
    );

    // Scan campaigns with limited concurrency so we cover all of them within the timeout.
    const perCampaign: { id: string; name: string; deadIds: string[] }[] = [];
    await runPool(campaigns, 5, async (c) => {
      const deadIds = await scanCampaignForDeadLeads(c.id, headers);
      perCampaign.push({ id: c.id, name: c.name || c.id, deadIds });
    });

    const allDead = perCampaign.flatMap((c) => c.deadIds);
    const deleteResults = await runPool(allDead, 15, (id) => deleteLead(id, authOnly));
    const deleted = deleteResults.filter(Boolean).length;

    const byCampaign = perCampaign
      .filter((c) => c.deadIds.length > 0)
      .map((c) => ({ campaign: c.name, removed: c.deadIds.length }))
      .sort((a, b) => b.removed - a.removed);

    const result = {
      campaigns_scanned: campaigns.length,
      leads_found_dead: allDead.length,
      leads_deleted: deleted,
      by_campaign: byCampaign,
      rule: 'delete bounced (-1) + completed (3) with zero replies; never delete a lead with any reply',
      timestamp: new Date().toISOString(),
    };
    console.log('Lead pruner result:', JSON.stringify(result));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Lead pruner error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
