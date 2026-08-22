// ============================================
// /api/instantly/cron?task=aggregate — Daily campaign audience aggregates
//
// The command center's Audience tab needs per-campaign breakdowns (title
// groups, company concentration, status funnel, subject-line A/B, lead source).
// Those come from lead records, and the biggest campaign holds 43k leads =
// 436 API pages against a 20 req/min workspace limit. That cannot run on click.
// So this walks every non-ISOLATED campaign with leads once a day and stores
// the whole set as one ~12KB JSON document (see api/_lib/aggregate-store.ts).
// The UI reads it and labels every number "as of <time>".
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { instantlyList, instantlyLeads, isIsolated, titleGroup, classifyReply, type InstantlyLead, type Json } from '../instantly-client.js';
import { loadAggregates, saveAggregates, type AggregateDoc } from '../aggregate-store.js';

export const maxDuration = 300;

const SOURCE_OF = (campaignName: string): string => {
  // lead-source heuristics from how each campaign was built
  if (/Recruiter Req/i.test(campaignName)) return 'Apollo: hiring a recruiter';
  if (/OOO/i.test(campaignName)) return 'OOO referral mining';
  if (/INTERESTED/i.test(campaignName)) return 'Prior repliers: interested';
  if (/Repliers/i.test(campaignName)) return 'Prior repliers';
  if (/Reactivation/i.test(campaignName)) return 'Prior campaigns: never replied';
  return 'Upload';
};

function verticalOf(payload: Json): string {
  const blob = `${String(payload.opener ?? '')} ${String(payload.bridge ?? '')} ${String(payload.research ?? '')}`.toLowerCase();
  const map: [RegExp, string][] = [
    [/logistics|freight|broker|dispatch|cdl/, 'Logistics'],
    [/manufactur|cnc|machinist|plant/, 'Manufacturing'],
    [/construction|superintendent|estimator|contractor|concrete/, 'Construction'],
    [/civil engineering|licensed pe|survey/, 'Civil Engineering'],
    [/professional services|cpa|accountant|engagement manager/, 'Professional Services'],
    [/technology|software|devops|cybersecurity|it services/, 'Technology'],
    [/industrial|transportation|diesel|terminal/, 'Industrial & Transportation'],
    [/health|hospital|clinical|medical/, 'Healthcare'],
    [/law|legal|attorney/, 'Legal'],
    [/insurance/, 'Insurance'],
  ];
  for (const [re, v] of map) if (re.test(blob)) return v;
  return 'General';
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  const results: { campaign: string; leads: number; ms: number }[] = [];
  // start from the previous doc so a run that times out partway keeps old snapshots for the rest
  const doc: AggregateDoc = (await loadAggregates()) || { computed_at: new Date().toISOString(), campaigns: {} };
  try {
    const campaigns = await instantlyList<{ id: string; name: string; status: number }>('campaigns');
    // active + paused with leads; skip drafts, deleted, and the 8 ISOLATED dialers
    const targets = campaigns.filter((c) => (c.status === 1 || c.status === 2) && !isIsolated(c.name));
    for (const c of targets) {
      if (Date.now() - started > 270_000) break; // stay inside maxDuration
      const t0 = Date.now();
      const leads = await instantlyLeads<InstantlyLead>(c.id);
      if (!leads.length) continue;
      const titles: Record<string, number> = {};
      const companies: Record<string, number> = {};
      const status: Record<string, number> = { never_contacted: 0, in_sequence: 0, completed: 0, bounced: 0, replied: 0 };
      const subjects: Record<string, { leads: number; replies: number }> = {};
      const verticals: Record<string, number> = {};
      const sources: Record<string, number> = {};
      const replyClasses: Record<string, number> = {};
      let withCompany = 0;
      for (const l of leads) {
        const p: Json = l.payload || {};
        const tg = titleGroup(l.title || String(p.title ?? p.Title ?? ''));
        titles[tg] = (titles[tg] || 0) + 1;
        const co = (l.company_name || '').trim();
        if (co) { withCompany++; companies[co] = (companies[co] || 0) + 1; }
        const replied = (l.email_reply_count || 0) > 0;
        if (replied) status.replied++;
        else if (l.status === -1) status.bounced++;
        else if (l.status === 3) status.completed++;
        else if (l.timestamp_last_contact) status.in_sequence++;
        else status.never_contacted++;
        const s = String(p.subject1 || '').trim();
        if (s) {
          subjects[s] = subjects[s] || { leads: 0, replies: 0 };
          subjects[s].leads++;
          if (replied) subjects[s].replies++;
        }
        const v = verticalOf(p);
        verticals[v] = (verticals[v] || 0) + 1;
        const src = SOURCE_OF(c.name);
        sources[src] = (sources[src] || 0) + 1;
        if (replied) {
          const cls = classifyReply('', l.lt_interest_status);
          replyClasses[cls] = (replyClasses[cls] || 0) + 1;
        }
      }
      const topCompanies = Object.entries(companies).sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([name, count]) => ({ name, count }));
      const data = {
        total: leads.length,
        with_company: withCompany,
        unique_companies: Object.keys(companies).length,
        title_groups: titles,
        top_companies: topCompanies,
        status_funnel: status,
        subject_split: Object.entries(subjects).map(([subject, v]) => ({ subject, ...v, reply_rate: v.leads ? v.replies / v.leads : 0 }))
          .sort((a, b) => b.leads - a.leads),
        verticals,
        sources,
        reply_classes: replyClasses,
      };
      doc.campaigns[c.id] = { name: c.name, data: { ...data, as_of: new Date().toISOString() } };
      results.push({ campaign: c.name, leads: leads.length, ms: Date.now() - t0 });
    }
    doc.computed_at = new Date().toISOString();
    await saveAggregates(doc);
    return res.status(200).json({ ok: true, aggregated: results, elapsed_ms: Date.now() - started });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed';
    console.error('aggregate error', msg);
    return res.status(500).json({ error: msg, aggregated: results });
  }
}
