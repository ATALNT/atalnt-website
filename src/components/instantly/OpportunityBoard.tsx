// ============================================
// The opportunity board: every interested lead across every campaign, reply
// text visible, one click to the thread and the classify buttons. This sits
// ABOVE the tiles because it is the reason the dashboard exists.
// ============================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ThumbsUp, ChevronRight, Sparkles } from 'lucide-react';
import { fetchInstantlyReplies } from '@/lib/dashboard-api';
import type { InstantlyReply } from '@/types/dashboard';
import { fmt, Panel, ClassPill } from './primitives';

export function OpportunityBoard({ token, onOpen }: { token: string; onOpen: (reply: InstantlyReply) => void }) {
  const [showAll, setShowAll] = useState(false);
  const q = useQuery({
    queryKey: ['instantly', 'replies', 'all'],
    queryFn: () => fetchInstantlyReplies(token),
    refetchInterval: 90 * 1000,
  });
  const all = q.data?.items || [];
  // one card per PERSON: keep their strongest reply (demo > positive), newest wins ties
  const rank = (r: InstantlyReply) => (r.class === 'demo' ? 2 : r.class === 'positive' || r.interest === 1 ? 1 : 0);
  const best = new Map<string, InstantlyReply>();
  for (const r of all) {
    if (rank(r) === 0) continue;
    const k = r.from_email.toLowerCase();
    const cur = best.get(k);
    if (!cur || rank(r) > rank(cur) || (rank(r) === rank(cur) && (r.timestamp || '') > (cur.timestamp || ''))) best.set(k, r);
  }
  const opps = [...best.values()].sort((a, b) => rank(b) - rank(a) || (b.timestamp || '').localeCompare(a.timestamp || ''));
  const demos = opps.filter((r) => r.class === 'demo').length;
  const today = new Date().toISOString().slice(0, 10);
  const fresh = opps.filter((r) => (r.timestamp || '').slice(0, 10) === today).length;
  const shown = showAll ? opps : opps.slice(0, 8);

  // group by campaign for the per-campaign strip
  const byCampaign = new Map<string, number>();
  for (const r of opps) byCampaign.set(r.campaign, (byCampaign.get(r.campaign) || 0) + 1);

  return (
    <section>
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <span className="inline-block h-3 w-1 rounded-full bg-[#2DD4BF]" />
            Interested leads
            <Sparkles className="h-4 w-4 text-[#D4A853]" />
          </h2>
          <div className="text-[11px] text-white/40 mt-1">
            {q.isLoading ? 'loading replies…' : `${opps.length} people said yes or asked to hear more · ${demos} want the overview · ${fresh} today`}
          </div>
        </div>
        {byCampaign.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...byCampaign.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <span key={c} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-white/60">
                {c.replace(/^GMAIL:\s*/, '')} <span className="text-[#2DD4BF] font-bold">{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {!q.isLoading && opps.length === 0 && (
        <Panel className="p-6 text-sm text-white/50">No interested replies yet. They will show here the moment one lands, reply text included.</Panel>
      )}

      {opps.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <Panel key={r.id} onClick={() => onOpen(r)} className="p-4 border-l-2 border-l-[#2DD4BF]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {r.class === 'demo' ? <CalendarCheck className="h-4 w-4 text-[#D4A853] shrink-0" /> : <ThumbsUp className="h-4 w-4 text-[#2DD4BF] shrink-0" />}
                    <span className="text-sm font-semibold text-white truncate">{r.from_name || r.from_email.split('@')[0]}</span>
                    <span className="text-[11px] text-white/35 truncate">{r.from_email.split('@')[1]}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">{r.campaign.replace(/^GMAIL:\s*/, '')} · {fmt.ago(r.timestamp)}</div>
                </div>
                <ClassPill cls={r.class} />
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-white/80 line-clamp-3">“{r.preview}”</p>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-white/30">landed in {r.to_mailbox}</span>
                <span className="flex items-center gap-1 text-[#2DD4BF] font-semibold">Open thread <ChevronRight className="h-3.5 w-3.5" /></span>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {opps.length > 8 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs text-[#2DD4BF] hover:underline">
          {showAll ? 'Show fewer' : `Show all ${opps.length}`}
        </button>
      )}
    </section>
  );
}
