import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ThumbsUp, ThumbsDown, UserX, CalendarCheck, Loader2 } from 'lucide-react';
import { fetchInstantlyReplies, fetchInstantlyThread, classifyInstantlyReply } from '@/lib/dashboard-api';
import type { InstantlyReply, ReplyClass } from '@/types/dashboard';
import { fmt, ClassPill, CLASS_META, Panel } from './primitives';

const FILTERS: { key: ReplyClass | 'all' | 'actionable'; label: string }[] = [
  { key: 'actionable', label: 'Needs action' },
  { key: 'demo', label: 'Demo requested' },
  { key: 'positive', label: 'Positive' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'negative', label: 'Not interested' },
  { key: 'wrong_person', label: 'Wrong person' },
  { key: 'auto', label: 'Auto-replies' },
  { key: 'all', label: 'All' },
];

export function ReplyInbox({
  token, campaignId, initialFilter = 'actionable', compact = false, initialOpen = null,
}: { token: string; campaignId?: string; initialFilter?: ReplyClass | 'all' | 'actionable'; compact?: boolean; initialOpen?: InstantlyReply | null }) {
  const [filter, setFilter] = useState<ReplyClass | 'all' | 'actionable'>(initialFilter);
  const [open, setOpen] = useState<InstantlyReply | null>(initialOpen);
  const q = useQuery({
    queryKey: ['instantly', 'replies', campaignId || 'all'],
    queryFn: () => fetchInstantlyReplies(token, { campaign: campaignId }),
    refetchInterval: 90 * 1000,
  });
  const items = (q.data?.items || []).filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'actionable') return r.class === 'demo' || r.class === 'positive' || r.class === 'neutral';
    return r.class === filter;
  });
  const counts = q.data?.counts || {};
  const actionable = (counts.demo || 0) + (counts.positive || 0) + (counts.neutral || 0);

  if (open) return <Thread token={token} reply={open} onBack={() => setOpen(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = f.key === 'all' ? (q.data?.items.length || 0) : f.key === 'actionable' ? actionable : (counts[f.key] || 0);
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                filter === f.key ? 'border-[#2DD4BF]/40 bg-[#2DD4BF]/15 text-[#2DD4BF]' : 'border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              {f.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      {q.isLoading && <div className="text-xs text-white/40 py-6">Loading replies…</div>}
      {!q.isLoading && items.length === 0 && <div className="text-xs text-white/30 py-6">Nothing here.</div>}
      <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] overflow-hidden">
        {items.map((r) => (
          <button key={r.id} onClick={() => setOpen(r)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <ClassPill cls={r.class} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-white truncate">{r.from_name || r.from_email}</span>
                  <span className="text-[11px] text-white/30 truncate">{r.from_email.split('@')[1]}</span>
                  {r.unread && <span className="h-1.5 w-1.5 rounded-full bg-[#D4A853]" />}
                </div>
                <div className="text-xs text-white/55 truncate">{r.preview}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-white/40">{fmt.ago(r.timestamp)}</div>
                {!compact && <div className="text-[10px] text-white/25 truncate max-w-[160px]">{r.campaign.replace(/^GMAIL:\s*/, '')}</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Thread({ token, reply, onBack }: { token: string; reply: InstantlyReply; onBack: () => void }) {
  const qc = useQueryClient();
  const t = useQuery({ queryKey: ['instantly', 'thread', reply.from_email], queryFn: () => fetchInstantlyThread(token, reply.from_email) });
  const mut = useMutation({
    mutationFn: (status: 'interested' | 'demo' | 'negative' | 'wrong_person') => classifyInstantlyReply(token, reply.from_email, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['instantly', 'replies'] }); qc.invalidateQueries({ queryKey: ['instantly', 'overview'] }); },
  });
  const Btn = ({ status, icon, label, tone }: { status: 'interested' | 'demo' | 'negative' | 'wrong_person'; icon: JSX.Element; label: string; tone: string }) => (
    <button
      disabled={mut.isPending}
      onClick={() => mut.mutate(status)}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${tone}`}
    >
      {mut.isPending && mut.variables === status ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}{label}
    </button>
  );
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" />Back</button>
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{reply.from_name || reply.from_email}</div>
            <div className="text-xs text-white/40">{reply.from_email} · {reply.campaign.replace(/^GMAIL:\s*/, '')} · landed in {reply.to_mailbox}</div>
          </div>
          <ClassPill cls={reply.class} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn status="demo" icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Demo requested" tone="border-[#2DD4BF]/40 bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25" />
          <Btn status="interested" icon={<ThumbsUp className="h-3.5 w-3.5" />} label="Interested" tone="border-teal-400/30 bg-teal-400/10 text-teal-300 hover:bg-teal-400/20" />
          <Btn status="negative" icon={<ThumbsDown className="h-3.5 w-3.5" />} label="Not interested" tone="border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20" />
          <Btn status="wrong_person" icon={<UserX className="h-3.5 w-3.5" />} label="Wrong person" tone="border-yellow-400/30 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20" />
        </div>
        {mut.isSuccess && <div className="mt-2 text-[11px] text-teal-400">Marked in Instantly. Reply from the Unibox when you are ready.</div>}
        {mut.isError && <div className="mt-2 text-[11px] text-red-400">Could not update: {(mut.error as Error).message}</div>}
      </Panel>
      {t.isLoading && <div className="text-xs text-white/40">Loading thread…</div>}
      {t.data?.messages.map((m) => (
        <div key={m.id} className={`rounded-xl border p-4 ${m.direction === 'received' ? 'border-[#2DD4BF]/25 bg-[#2DD4BF]/[0.05]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-2">
            <span>{m.direction === 'received' ? 'They wrote' : 'We sent'} · {m.from}</span>
            <span>{fmt.time(m.timestamp)}</span>
          </div>
          {m.subject && <div className="text-xs text-white/60 mb-2">{m.subject}</div>}
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/85">{m.text}</pre>
        </div>
      ))}
      <div className="text-[11px] text-white/30">{CLASS_META[reply.class]?.label} was auto-classified from the reply text. The buttons above correct it and write the status to Instantly.</div>
    </div>
  );
}
