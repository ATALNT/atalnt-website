import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Signal, Lock, Power, Activity, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts';

// ============================================
// Self-contained Instantly Health Monitor + Automation Control
// ============================================

interface Account {
  email: string;
  status: number;
  daily_limit: number | null;
  health_score: number | null;
}

interface Summary {
  total: number;
  healthy: number;
  unhealthy: number;
  no_score: number;
  throttled: number;
}

interface AccountsResponse {
  summary: Summary;
  accounts: Account[];
  timestamp: string;
}

interface AutomationStats {
  total: number;
  part1_sent: number;
  part2_sent: number;
  skipped: number;
  errors: number;
  pending: number;
}

interface DailyActivity {
  date: string;
  part1: number;
  part2: number;
  errors: number;
}

interface AutomationResponse {
  stats: AutomationStats;
  dailyActivity: DailyActivity[];
  industries: Record<string, number>;
  settings: Record<string, boolean>;
  timestamp: string;
}

type Tab = 'health' | 'automation';

function LoginForm({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!resp.ok) { setError(true); return; }
      const data = await resp.json();
      if (data.token) {
        localStorage.setItem('dashboard_token', data.token);
        onLogin(data.token);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm mx-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-8 text-center">
          <Lock className="h-8 w-8 text-[#D4A853]/60 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-1">Instantly Monitor</h2>
          <p className="text-[#8a8a9a] text-xs mb-6">Enter dashboard password</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A853]/40 mb-3"
            placeholder="Password"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mb-3">Invalid password</p>}
          <button type="submit" className="w-full bg-gradient-to-r from-[#D4A853] to-[#b8912e] text-black font-semibold rounded-lg py-2.5 text-sm hover:opacity-90 transition-opacity">
            Sign In
          </button>
        </div>
      </form>
    </div>
  );
}

export default function InstantlyDashboard() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('dashboard_token'));
  const [tab, setTab] = useState<Tab>('health');
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [autoData, setAutoData] = useState<AutomationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Hide Zoho SalesIQ
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'hide-salesiq-instantly';
    style.textContent = `.zsiq_floatmain, .zsiq_theme1, .zls-sptwndw, [data-id="zsalesiq"], .zsiq-newtheme { display: none !important; visibility: hidden !important; }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const fetchAccounts = async (t?: string) => {
    const authToken = t || token;
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/instantly/accounts', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (resp.status === 401) {
        localStorage.removeItem('dashboard_token');
        setToken(null);
        return;
      }
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const json: AccountsResponse = await resp.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutomation = async (t?: string) => {
    const authToken = t || token;
    if (!authToken) return;
    setAutoLoading(true);
    try {
      const resp = await fetch('/api/instantly/automation', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (resp.ok) {
        const json: AutomationResponse = await resp.json();
        setAutoData(json);
      }
    } catch { /* ignore */ } finally {
      setAutoLoading(false);
    }
  };

  const toggleCron = async (key: string, enabled: boolean) => {
    if (!token) return;
    setToggling(key);
    try {
      const resp = await fetch('/api/instantly/automation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, enabled }),
      });
      if (resp.ok) {
        setAutoData(prev => prev ? {
          ...prev,
          settings: { ...prev.settings, [key]: enabled },
        } : prev);
      }
    } catch { /* ignore */ } finally {
      setToggling(null);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAccounts();
      fetchAutomation();
    }
  }, [token]);

  if (!token) {
    return <LoginForm onLogin={(t) => { setToken(t); fetchAccounts(t); fetchAutomation(t); }} />;
  }

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-white/30';
    if (score >= 97) return 'text-emerald-400';
    if (score >= 90) return 'text-yellow-400';
    return 'text-red-400';
  };

  const limitBadge = (limit: number | null) => {
    if (limit === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">THROTTLED</span>;
    if (limit == null) return <span className="text-white/30">&mdash;</span>;
    return <span className="text-white/70">{limit}</span>;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(212,168,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <header className="sticky top-0 z-50 border-b border-[#D4A853]/10 bg-[#0a0b0f]/90 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-8 relative z-10" />
              <div className="absolute inset-0 blur-lg bg-[#D4A853]/20 rounded-full" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-display text-white leading-none tracking-wide">
                  Instantly Command Center
                </h1>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <Signal className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
              </div>
              <p className="text-[11px] text-[#8a8a9a] mt-0.5 tracking-wide">Email health, automation stats & controls</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon"
              onClick={() => { fetchAccounts(); fetchAutomation(); }}
              disabled={loading || autoLoading}
              className="border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-[#D4A853] hover:border-[#D4A853]/30 hover:bg-[#D4A853]/5 transition-all">
              <RefreshCw className={`h-4 w-4 ${loading || autoLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem('dashboard_token'); setToken(null); }}
              className="text-white/40 hover:text-white/80 text-xs">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 relative z-10">
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit border border-white/[0.06]">
          <button
            onClick={() => setTab('health')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'health'
                ? 'bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/20'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <Activity className="h-4 w-4" />
            Health Monitor
          </button>
          <button
            onClick={() => setTab('automation')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'automation'
                ? 'bg-[#D4A853]/15 text-[#D4A853] border border-[#D4A853]/20'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <Shield className="h-4 w-4" />
            Automation Control
          </button>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── HEALTH MONITOR TAB ── */}
        {tab === 'health' && (
          <>
            {loading && !data && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 text-[#D4A853]/40 animate-spin" />
              </div>
            )}

            {data && (() => {
              // Compute score distribution
              const scoreDist: Record<number, number> = {};
              let activeCount = 0;
              let throttledCount = 0;
              const problemAccounts = data.accounts.filter(a => {
                if (a.daily_limit === 0) throttledCount++;
                else activeCount++;
                if (a.health_score != null) {
                  scoreDist[a.health_score] = (scoreDist[a.health_score] || 0) + 1;
                }
                return a.health_score != null && a.health_score < 97;
              }).sort((a, b) => (a.health_score ?? 0) - (b.health_score ?? 0));

              const scoreChartData = Object.entries(scoreDist)
                .map(([score, count]) => ({ score: Number(score), count }))
                .sort((a, b) => a.score - b.score);

              const healthRate = data.summary.total > 0
                ? Math.round((data.summary.healthy / data.summary.total) * 100)
                : 0;

              return (
                <>
                  {/* Big KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                      <div className="text-[11px] text-[#8a8a9a] uppercase tracking-widest mb-1">Health Rate</div>
                      <div className={`text-3xl font-bold font-display ${healthRate >= 95 ? 'text-emerald-400' : healthRate >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {healthRate}%
                      </div>
                      <div className="text-[10px] text-white/30 mt-1">{data.summary.healthy} of {data.summary.total} accounts</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                      <div className="text-[11px] text-[#8a8a9a] uppercase tracking-widest mb-1">Active Sending</div>
                      <div className="text-3xl font-bold font-display text-emerald-400">{activeCount}</div>
                      <div className="text-[10px] text-white/30 mt-1">Daily limit &gt; 0</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                      <div className="text-[11px] text-[#8a8a9a] uppercase tracking-widest mb-1">Turned Off</div>
                      <div className={`text-3xl font-bold font-display ${throttledCount > 0 ? 'text-red-400' : 'text-white/40'}`}>{throttledCount}</div>
                      <div className="text-[10px] text-white/30 mt-1">Throttled to 0 sends</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                      <div className="text-[11px] text-[#8a8a9a] uppercase tracking-widest mb-1">Needs Attention</div>
                      <div className={`text-3xl font-bold font-display ${problemAccounts.length > 0 ? 'text-yellow-400' : 'text-white/40'}`}>{problemAccounts.length}</div>
                      <div className="text-[10px] text-white/30 mt-1">Score below 97</div>
                    </div>
                  </div>

                  {/* Score Distribution Chart */}
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 mb-6">
                    <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Score Distribution</h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="score"
                            tick={{ fill: '#8a8a9a', fontSize: 10 }}
                            stroke="rgba(255,255,255,0.1)"
                          />
                          <YAxis
                            tick={{ fill: '#8a8a9a', fontSize: 10 }}
                            stroke="rgba(255,255,255,0.1)"
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1a1b23',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number) => [value, 'Accounts']}
                            labelFormatter={(label) => `Score: ${label}`}
                            labelStyle={{ color: '#D4A853', fontWeight: 600 }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {scoreChartData.map((entry) => (
                              <Cell
                                key={entry.score}
                                fill={entry.score >= 97 ? '#34d399' : entry.score >= 90 ? '#fbbf24' : '#f87171'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Problem Accounts Table — only unhealthy */}
                  {problemAccounts.length > 0 && (
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden mb-6">
                      <div className="px-4 py-3 border-b border-white/[0.06]">
                        <h3 className="text-white font-bold text-sm uppercase tracking-widest">
                          Problem Accounts ({problemAccounts.length})
                        </h3>
                        <p className="text-[11px] text-[#8a8a9a] mt-0.5">Accounts with health score below 97 — auto-throttled to 0 daily sends</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium">Email</th>
                              <th className="text-center px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium">Score</th>
                              <th className="text-center px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium">Daily Limit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {problemAccounts.map(account => (
                              <tr key={account.email} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-2.5 text-white/80 font-mono text-xs">{account.email}</td>
                                <td className={`px-4 py-2.5 text-center font-bold ${scoreColor(account.health_score)}`}>
                                  {account.health_score}
                                </td>
                                <td className="px-4 py-2.5 text-center">{limitBadge(account.daily_limit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {problemAccounts.length === 0 && (
                    <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-6 mb-6 text-center">
                      <div className="text-emerald-400 font-bold text-sm mb-1">All Accounts Healthy</div>
                      <div className="text-emerald-400/50 text-xs">Every account is scoring 97 or above — no action needed</div>
                    </div>
                  )}

                  <div className="text-[11px] text-white/20">
                    Last fetched: {new Date(data.timestamp).toLocaleString()} · Health cron runs at 6 AM & 6 PM CST
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* ── AUTOMATION CONTROL TAB ── */}
        {tab === 'automation' && (
          <>
            {autoLoading && !autoData && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 text-[#D4A853]/40 animate-spin" />
              </div>
            )}

            {autoData && (
              <>
                {/* Kill Switch Controls */}
                <div className="mb-6">
                  <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Power className="h-4 w-4 text-[#D4A853]" />
                    Automation Controls
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: 'lead_responder', label: 'Lead Auto-Responder', desc: 'Persona reply + Nik email + CRM lead', schedule: '10 AM, 2 PM, 4 PM CST' },
                      { key: 'reply_manager', label: 'Reply Manager', desc: 'Auto-read inbox + catch interested leads', schedule: '6 AM, 4 PM CST' },
                    ].map(cron => {
                      const enabled = autoData.settings[cron.key] ?? false;
                      const isToggling = toggling === cron.key;
                      return (
                        <div key={cron.key} className={`rounded-xl border p-5 transition-all ${
                          enabled
                            ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                            : 'bg-white/[0.02] border-white/[0.06]'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-white font-semibold text-sm">{cron.label}</div>
                              <div className="text-[#8a8a9a] text-xs mt-0.5">{cron.desc}</div>
                              <div className="text-white/20 text-[10px] mt-1 uppercase tracking-wider">{cron.schedule}</div>
                            </div>
                            <button
                              onClick={() => toggleCron(cron.key, !enabled)}
                              disabled={isToggling}
                              className={`relative w-14 h-7 rounded-full transition-all duration-200 ${
                                enabled ? 'bg-emerald-500' : 'bg-white/10'
                              } ${isToggling ? 'opacity-50' : 'cursor-pointer'}`}
                            >
                              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200 ${
                                enabled ? 'left-[30px]' : 'left-0.5'
                              }`} />
                            </button>
                          </div>
                          <div className={`text-[10px] font-semibold uppercase tracking-widest ${
                            enabled ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {enabled ? 'ACTIVE' : 'DISABLED'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                  {[
                    { label: 'Total Leads', value: autoData.stats.total, color: 'text-white' },
                    { label: 'Part 1 Sent', value: autoData.stats.part1_sent, color: 'text-blue-400' },
                    { label: 'Part 2 Sent', value: autoData.stats.part2_sent, color: 'text-emerald-400' },
                    { label: 'Skipped', value: autoData.stats.skipped, color: 'text-white/40' },
                    { label: 'Pending', value: autoData.stats.pending, color: 'text-yellow-400' },
                    { label: 'Errors', value: autoData.stats.errors, color: 'text-red-400' },
                  ].map(card => (
                    <div key={card.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <div className="text-[10px] text-[#8a8a9a] uppercase tracking-widest mb-1">{card.label}</div>
                      <div className={`text-2xl font-bold font-display ${card.color}`}>{card.value}</div>
                    </div>
                  ))}
                </div>

                {/* Line Chart */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 mb-6">
                  <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Daily Activity (Last 30 Days)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={autoData.dailyActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDate}
                          tick={{ fill: '#8a8a9a', fontSize: 10 }}
                          stroke="rgba(255,255,255,0.1)"
                          interval={4}
                        />
                        <YAxis
                          tick={{ fill: '#8a8a9a', fontSize: 10 }}
                          stroke="rgba(255,255,255,0.1)"
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1b23',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          labelFormatter={formatDate}
                          labelStyle={{ color: '#D4A853', fontWeight: 600 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="part1"
                          name="Persona Replies"
                          stroke="#60a5fa"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="part2"
                          name="Nik Emails"
                          stroke="#34d399"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="errors"
                          name="Errors"
                          stroke="#f87171"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Industry Breakdown */}
                {Object.keys(autoData.industries).length > 0 && (
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6">
                    <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Industry Breakdown</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(autoData.industries)
                        .sort((a, b) => b[1] - a[1])
                        .map(([industry, count]) => (
                          <div key={industry} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-4 py-3 border border-white/[0.04]">
                            <span className="text-white/60 text-xs capitalize">{industry.replace(/_/g, ' ')}</span>
                            <span className="text-[#D4A853] font-bold text-sm">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-white/20 mt-4">
                  Last fetched: {new Date(autoData.timestamp).toLocaleString()}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/[0.04] py-4 mt-8 relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between text-[11px] text-white/20 tracking-wide">
          <span>ATALNT LLC - Instantly Command Center</span>
          <span>Crons check kill switch before executing</span>
        </div>
      </footer>
    </div>
  );
}
