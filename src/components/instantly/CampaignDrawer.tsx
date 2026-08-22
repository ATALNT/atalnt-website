import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, BarChart3, MessageSquareText, Users, Inbox } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Cell,
} from 'recharts';
import { fetchInstantlyCampaign, fetchInstantlyMessaging } from '@/lib/dashboard-api';
import type { InstantlyCampaignRow, InstantlyCampaignDetail, InstantlyAudience } from '@/types/dashboard';
import { fmt, Label, Panel, StatusLight, TOOLTIP_STYLE } from './primitives';
import { ReplyInbox } from './ReplyInbox';

type Tab = 'performance' | 'messaging' | 'audience' | 'replies';

export function CampaignDrawer({ token, campaign, onClose }: { token: string; campaign: InstantlyCampaignRow; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('performance');
  const detail = useQuery({
    queryKey: ['instantly', 'campaign', campaign.id],
    queryFn: () => fetchInstantlyCampaign(token, campaign.id),
    staleTime: 4 * 60 * 1000,
  });

  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'performance', label: 'Performance', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'messaging', label: 'Messaging', icon: <MessageSquareText className="h-4 w-4" /> },
    { key: 'audience', label: 'Audience', icon: <Users className="h-4 w-4" /> },
    { key: 'replies', label: 'Replies', icon: <Inbox className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-3xl h-full overflow-y-auto bg-[#0d0e13] border-l border-white/[0.08] shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#0d0e13]/95 backdrop-blur border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <StatusLight light={campaign.health.light} />
                <h2 className="text-lg font-bold font-display text-white leading-tight">{campaign.name.replace(/^GMAIL:\s*/, '')}</h2>
              </div>
              <div className="mt-1 text-xs text-white/40">{campaign.health.reason}</div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <Mini label="Sent" value={fmt.int(campaign.sent)} />
            <Mini label="Reply rate" value={fmt.pct(campaign.reply_rate)} tone={campaign.reply_rate >= 0.01 ? 'good' : 'neutral'} />
            <Mini label="Bounce" value={fmt.pct(campaign.bounce_rate, 1)} tone={campaign.bounce_rate > 0.035 ? 'warn' : 'neutral'} />
            <Mini label="Leads left" value={fmt.int(campaign.remaining)} />
          </div>
          <div className="mt-4 flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key ? 'bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/25' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          {tab === 'performance' && <Performance detail={detail.data} loading={detail.isLoading} />}
          {tab === 'messaging' && <Messaging token={token} campaignId={campaign.id} />}
          {tab === 'audience' && <Audience audience={detail.data?.audience ?? null} loading={detail.isLoading} />}
          {tab === 'replies' && <ReplyInbox token={token} campaignId={campaign.id} compact />}
        </div>
      </aside>
    </div>
  );
}

function Mini({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' }) {
  const c = { neutral: 'text-white', good: 'text-teal-400', warn: 'text-yellow-400' }[tone];
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
      <Label>{label}</Label>
      <div className={`text-lg font-bold font-display ${c}`}>{value}</div>
    </div>
  );
}

function Performance({ detail, loading }: { detail?: InstantlyCampaignDetail; loading: boolean }) {
  if (loading || !detail) return <Skeleton />;
  const daily = detail.daily.slice(-30);
  const maxStep = Math.max(0, ...detail.steps.map((s) => s.sent));
  const subj = detail.audience?.subject_split || [];
  return (
    <div className="space-y-6">
      <Panel className="p-4">
        <Label>Daily sends and replies, last 30 days</Label>
        <div className="h-[220px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} barCategoryGap={daily.length < 6 ? '35%' : '15%'}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b6b7b', fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis yAxisId="l" tick={{ fill: '#6b6b7b', fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fill: '#6b6b7b', fontSize: 10 }} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar yAxisId="l" dataKey="sent" name="Sent" fill="#D4A853" opacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false} />
              <Line yAxisId="r" dataKey="replies" name="Replies" stroke="#2DD4BF" strokeWidth={2} dot={{ r: 3, fill: '#2DD4BF' }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="p-4">
        <Label>Step funnel</Label>
        <div className="mt-3 space-y-2">
          {detail.steps.length === 0 && <div className="text-xs text-white/30">No step data yet.</div>}
          {detail.steps.map((s) => (
            <div key={`${s.step}-${s.variant}`} className="flex items-center gap-3 text-xs">
              <div className="w-14 text-white/60">Step {s.step}</div>
              <div className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden">
                <div className="h-full bg-[#D4A853]/50" style={{ width: `${maxStep ? (s.sent / maxStep) * 100 : 0}%` }} />
              </div>
              <div className="w-16 text-right text-white/70">{fmt.int(s.sent)}</div>
              <div className={`w-16 text-right font-semibold ${s.reply_rate >= 0.01 ? 'text-teal-400' : 'text-white/50'}`}>{fmt.pct(s.reply_rate)}</div>
            </div>
          ))}
        </div>
      </Panel>

      {subj.length > 0 && (
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <Label>Subject line split</Label>
            {detail.audience && <span className="text-[10px] text-white/30">as of {fmt.time(detail.audience.as_of)}</span>}
          </div>
          <div className="mt-3 space-y-2">
            {subj.map((s) => (
              <div key={s.subject} className="flex items-center gap-3 text-xs">
                <div className="flex-1 truncate text-white/80 font-mono">{s.subject}</div>
                <div className="w-16 text-right text-white/50">{fmt.int(s.leads)}</div>
                <div className="w-12 text-right text-white/50">{fmt.int(s.replies)}</div>
                <div className={`w-16 text-right font-semibold ${s.reply_rate >= 0.01 ? 'text-teal-400' : 'text-white/60'}`}>{fmt.pct(s.reply_rate)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-white/30">leads · replies · reply rate. Reply rate per variant becomes readable after a few hundred sends each.</div>
        </Panel>
      )}
    </div>
  );
}

function Messaging({ token, campaignId }: { token: string; campaignId: string }) {
  const [lead, setLead] = useState<string | undefined>(undefined);
  const q = useQuery({
    queryKey: ['instantly', 'messaging', campaignId, lead],
    queryFn: () => fetchInstantlyMessaging(token, campaignId, lead),
    staleTime: 10 * 60 * 1000,
  });
  if (q.isLoading || !q.data) return <Skeleton />;
  const m = q.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Rendered for</Label>
        {m.leads.map((l) => (
          <button
            key={l.email}
            onClick={() => setLead(l.email)}
            className={`rounded-full border px-3 py-1 text-xs ${
              (m.lead?.email === l.email) ? 'border-[#2DD4BF]/40 bg-[#2DD4BF]/15 text-[#2DD4BF]' : 'border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {l.group}
          </button>
        ))}
      </div>
      {m.lead && (
        <div className="text-xs text-white/40">
          {m.lead.first_name} at {m.lead.company || m.lead.email.split('@')[1]} · sent from one of {m.senders} gmail personas
        </div>
      )}
      {m.unresolved && <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">Unresolved variables detected in this sequence.</div>}
      {m.steps.map((s) => (
        <Panel key={s.step} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-[#2DD4BF]">Step {s.step}{s.step > 1 ? ` · day +${s.delay_days}` : ''}</div>
            <div className="text-xs text-white/50 truncate max-w-[60%]">{s.subject}</div>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/85">{s.body}</pre>
        </Panel>
      ))}
    </div>
  );
}

function Audience({ audience, loading }: { audience: InstantlyAudience | null; loading: boolean }) {
  if (loading) return <Skeleton />;
  if (!audience) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
        Audience breakdown is computed once a day (lead lists are too large to scan on click). The first snapshot lands after the next 05:00 ET run.
      </div>
    );
  }
  const bar = (obj: Record<string, number>, color = '#D4A853') => {
    const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return (
      <div className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 text-xs">
            <div className="w-40 truncate text-white/70">{k.replace(/_/g, ' ')}</div>
            <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden"><div className="h-full" style={{ width: `${(v / max) * 100}%`, background: color, opacity: 0.6 }} /></div>
            <div className="w-16 text-right text-white/60">{fmt.int(v)}</div>
            <div className="w-12 text-right text-white/30">{fmt.pct(v / audience.total, 0)}</div>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">{fmt.int(audience.total)} leads · {fmt.int(audience.unique_companies)} companies</div>
        <div className="text-[10px] text-white/30">as of {fmt.time(audience.as_of)}</div>
      </div>
      <Panel className="p-4"><Label>Status funnel</Label><div className="mt-3">{bar(audience.status_funnel, '#2DD4BF')}</div></Panel>
      <Panel className="p-4"><Label>Who they are</Label><div className="mt-3">{bar(audience.title_groups)}</div></Panel>
      <Panel className="p-4"><Label>Verticals</Label><div className="mt-3">{bar(audience.verticals, '#60a5fa')}</div></Panel>
      <Panel className="p-4"><Label>Where the leads came from</Label><div className="mt-3">{bar(audience.sources, '#a78bfa')}</div></Panel>
      <Panel className="p-4">
        <Label>Company concentration</Label>
        <div className="mt-3 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={audience.top_companies} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fill: '#6b6b7b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#9a9aaa', fontSize: 10 }} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {audience.top_companies.map((c, i) => <Cell key={i} fill={c.count > 5 ? '#fbbf24' : '#D4A853'} opacity={0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-[10px] text-white/30">More than 5 contacts at one company is the line where a mail admin starts noticing.</div>
      </Panel>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>;
}
