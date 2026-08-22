// ============================================
// /instantly — Instantly Command Center
// One page, three layers: meeting view, campaign drawer, reply inbox.
// Built around one question: are we getting demos, and what do we change.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, LogOut, Inbox, ChevronDown, ChevronRight, Send, MessageSquare, ThumbsUp, AlertTriangle, CalendarCheck, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardLogin } from '@/components/dashboard/DashboardLogin';
import { fetchInstantlyOverview } from '@/lib/dashboard-api';
import type { InstantlyCampaignRow, ReplyClass } from '@/types/dashboard';
import { fmt, Panel, SectionTitle, StatusLight, Sparkline, Tile } from '@/components/instantly/primitives';
import { CampaignDrawer } from '@/components/instantly/CampaignDrawer';
import { ReplyInbox } from '@/components/instantly/ReplyInbox';

export default function InstantlyDashboard() {
  const { token, isAuthenticated, login, logout } = useAuth();

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '#zsiq_float, .zsiq_floatmain { display: none !important; }';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!isAuthenticated || !token) return <DashboardLogin onLogin={login} />;
  return <CommandCenter token={token} onLogout={logout} />;
}

function CommandCenter({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [drawer, setDrawer] = useState<InstantlyCampaignRow | null>(null);
  const [inbox, setInbox] = useState<ReplyClass | 'all' | 'actionable' | null>(null);
  const [showPast, setShowPast] = useState(false);

  const q = useQuery({
    queryKey: ['instantly', 'overview'],
    queryFn: () => fetchInstantlyOverview(token),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
  const d = q.data;
  const t = d?.tiles;

  const runway = useMemo(() => {
    if (!d) return 0;
    const remaining = d.active.reduce((s, r) => s + r.remaining, 0);
    return d.tiles.ceiling ? remaining / d.tiles.ceiling : 0;
  }, [d]);

  const worst = d?.active.find((r) => r.health.light === 'red') || d?.active.find((r) => r.health.light === 'yellow');

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#D4A853 1px, transparent 1px), linear-gradient(90deg, #D4A853 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(1200px 500px at 15% -10%, rgba(45,212,191,0.10), transparent 60%), radial-gradient(900px 400px at 95% 110%, rgba(212,168,83,0.10), transparent 60%)' }} />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0b0f]/90 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-[#D4A853]/30 rounded-full" />
              <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="relative h-8 w-auto" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display leading-none tracking-wide">Instantly Command Center</h1>
              <div className="text-[10px] text-white/40 mt-0.5">{d ? `updated ${fmt.ago(d.generated_at)}` : 'loading…'}</div>
            </div>
            <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2DD4BF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF] animate-pulse" />LIVE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setInbox('actionable')} className="relative flex items-center gap-2 rounded-lg border border-[#D4A853]/30 bg-[#D4A853]/10 px-3 py-1.5 text-xs font-semibold text-[#D4A853] hover:bg-[#D4A853]/20">
              <Inbox className="h-4 w-4" />Inbox
              {t && (t.positive_replies > 0) && <span className="ml-1 rounded-full bg-[#D4A853] px-1.5 text-[10px] font-bold text-black">{t.positive_replies}</span>}
            </button>
            <button onClick={() => q.refetch()} className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white" title="Refresh"><RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} /></button>
            <button onClick={onLogout} className="rounded-lg p-2 text-white/40 hover:text-white" title="Logout"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-8">
        {q.isError && <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">Could not load: {(q.error as Error).message}</div>}

        {/* Layer 1: tiles */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Tile label="Sends today" value={t ? fmt.int(t.sends_today) : '—'} sub={t ? `of ${fmt.int(t.ceiling)} ceiling · ${fmt.pct(t.sends_pct, 0)}` : undefined}
            tone={t && t.sends_pct < 0.3 && new Date().getUTCHours() > 18 ? 'warn' : 'neutral'} icon={<Send className="h-4 w-4" />} />
          <Tile label="Reply rate" value={t ? fmt.pct(t.reply_rate) : '—'} sub={t ? `vs ${fmt.pct(t.historical_reply_rate)} historical · ${t.replies_today} today` : undefined}
            tone={t && t.reply_rate >= t.historical_reply_rate * 3 ? 'good' : 'neutral'} icon={<MessageSquare className="h-4 w-4" />} onClick={() => setInbox('all')} />
          <Tile label="Positive replies" value={t ? fmt.int(t.positive_replies) : '—'} sub={t ? `${t.positive_today} today · click to work them` : undefined}
            tone="good" icon={<ThumbsUp className="h-4 w-4" />} onClick={() => setInbox('positive')} />
          <Tile label="Bounce" value={t ? fmt.pct(t.bounce_rate, 1) : '—'} sub={t ? `guard pauses a campaign at ${fmt.pct(t.bounce_trip, 0)}` : undefined}
            tone={t ? (t.bounce_rate > 0.035 ? 'bad' : t.bounce_rate > 0.02 ? 'warn' : 'neutral') : 'neutral'} icon={<AlertTriangle className="h-4 w-4" />} />
          <Tile label="Demos requested" value={t ? fmt.int(t.demos_requested) : '—'} sub="said yes to the overview · click to follow up"
            tone="gold" icon={<CalendarCheck className="h-4 w-4" />} onClick={() => setInbox('demo')} />
        </section>

        {/* Layer 1: active campaigns */}
        <section>
          <SectionTitle right={d && <span className="text-[11px] text-white/40">{fmt.int(d.active.reduce((s, r) => s + r.remaining, 0))} leads left · {runway.toFixed(1)} days of runway</span>}>
            Active campaigns
          </SectionTitle>
          {worst && (
            <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${worst.health.light === 'red' ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'}`}>
              <span className="font-semibold">{worst.name.replace(/^GMAIL:\s*/, '')}:</span> {worst.health.reason}
            </div>
          )}
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-[#8a8a9a] border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 font-medium"></th>
                  <th className="text-left px-2 py-3 font-medium">Campaign</th>
                  <th className="text-right px-2 py-3 font-medium">Leads left</th>
                  <th className="text-right px-2 py-3 font-medium">Sent</th>
                  <th className="text-right px-2 py-3 font-medium">Reply</th>
                  <th className="text-right px-2 py-3 font-medium">Bounce</th>
                  <th className="text-left px-4 py-3 font-medium">14 days</th>
                  <th className="text-right px-4 py-3 font-medium">Runway</th>
                </tr>
              </thead>
              <tbody>
                {q.isLoading && [0, 1, 2].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-5 rounded bg-white/[0.04] animate-pulse" /></td></tr>)}
                {d?.active.map((r) => {
                  const perDay = (d.daily[r.id] || []).slice(-7).reduce((s, x) => s + x.sent, 0) / 7;
                  const days = perDay > 0 ? r.remaining / perDay : 0;
                  return (
                    <tr key={r.id} onClick={() => setDrawer(r)} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] cursor-pointer">
                      <td className="px-4 py-3"><StatusLight light={r.health.light} title={r.health.reason} /></td>
                      <td className="px-2 py-3">
                        <div className="font-semibold text-white">{r.name.replace(/^GMAIL:\s*/, '')}</div>
                        <div className="text-[11px] text-white/35">{fmt.int(r.leads)} leads · {r.senders} senders</div>
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-white/80">{fmt.int(r.remaining)}</td>
                      <td className="px-2 py-3 text-right font-mono text-white/80">{fmt.int(r.sent)}</td>
                      <td className={`px-2 py-3 text-right font-mono font-semibold ${r.reply_rate >= 0.01 ? 'text-teal-400' : r.reply_rate >= 0.005 ? 'text-white/80' : 'text-white/50'}`}>{fmt.pct(r.reply_rate)}</td>
                      <td className={`px-2 py-3 text-right font-mono ${r.bounce_rate > 0.035 ? 'text-yellow-400' : 'text-white/60'}`}>{fmt.pct(r.bounce_rate, 1)}</td>
                      <td className="px-4 py-2"><Sparkline data={d.daily[r.id] || []} /></td>
                      <td className="px-4 py-3 text-right text-white/60">{days > 0 ? `${days.toFixed(1)}d` : '—'}</td>
                    </tr>
                  );
                })}
                {d && d.active.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">No active campaigns.</td></tr>}
              </tbody>
            </table>
          </Panel>
          <div className="mt-2 text-[11px] text-white/30">Click any row for performance, messaging, audience and replies. The 8 ISOLATED recruiter dialers are excluded on purpose.</div>
        </section>

        {/* Past campaigns, collapsed */}
        <section>
          <button onClick={() => setShowPast((v) => !v)} className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/70 hover:text-white">
            {showPast ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Past campaigns <span className="text-white/30 font-normal normal-case tracking-normal">{d ? `${d.past.length}, ranked by reply rate` : ''}</span>
          </button>
          {showPast && d && (
            <Panel className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-[#8a8a9a] border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 font-medium">Campaign</th>
                    <th className="text-right px-2 py-3 font-medium">Sent</th>
                    <th className="text-right px-2 py-3 font-medium">Replies</th>
                    <th className="text-right px-2 py-3 font-medium">Reply</th>
                    <th className="text-right px-4 py-3 font-medium">Bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {d.past.map((r) => (
                    <tr key={r.id} onClick={() => setDrawer(r)} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] cursor-pointer">
                      <td className="px-4 py-2.5 text-white/80">{r.name}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-white/60">{fmt.int(r.sent)}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-white/60">{fmt.int(r.replies)}</td>
                      <td className={`px-2 py-2.5 text-right font-mono font-semibold ${r.reply_rate >= 0.004 ? 'text-teal-400' : 'text-white/60'}`}>{fmt.pct(r.reply_rate)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${r.bounce_rate > 0.05 ? 'text-red-400' : 'text-white/50'}`}>{fmt.pct(r.bounce_rate, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </section>

        {/* Guard status line */}
        {d && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/40 border-t border-white/[0.06] pt-4">
            <span className="flex items-center gap-1.5">
              <StatusLight light={d.fleet.error_state > 10 ? 'yellow' : 'green'} />
              Fleet: {d.fleet.gmail_eligible} of {d.fleet.gmail_total} gmails sending · {d.fleet.error_state} in error state
            </span>
            <span>·</span>
            <span>Guard: {d.guard.ran_at ? `${d.guard.verdict} ${fmt.ago(d.guard.ran_at)}` : 'runs every 4h on GitHub Actions; failures email you'}</span>
            {d.guard.problems?.length > 0 && <span className="text-yellow-300">{d.guard.problems.join(' · ')}</span>}
          </div>
        )}
      </main>

      {drawer && <CampaignDrawer token={token} campaign={drawer} onClose={() => setDrawer(null)} />}

      {inbox && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setInbox(null)} />
          <aside className="w-full max-w-3xl h-full overflow-y-auto bg-[#0d0e13] border-l border-white/[0.08]">
            <div className="sticky top-0 z-10 bg-[#0d0e13]/95 backdrop-blur border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-display">Reply inbox</h2>
                <div className="text-xs text-white/40">Every reply across active campaigns. Classify here, answer in the Unibox.</div>
              </div>
              <button onClick={() => setInbox(null)} className="text-white/40 hover:text-white p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5"><ReplyInbox token={token} initialFilter={inbox} /></div>
          </aside>
        </div>
      )}
    </div>
  );
}
