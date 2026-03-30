import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Signal, ChevronUp, ChevronDown, Lock } from 'lucide-react';

// ============================================
// Self-contained Instantly Health Monitor
// No shared state with the Executive Dashboard
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

interface ApiResponse {
  summary: Summary;
  accounts: Account[];
  timestamp: string;
}

type SortField = 'email' | 'health_score' | 'daily_limit';
type SortDir = 'asc' | 'desc';

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
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('health_score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Hide Zoho SalesIQ
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'hide-salesiq-instantly';
    style.textContent = `.zsiq_floatmain, .zsiq_theme1, .zls-sptwndw, [data-id="zsalesiq"], .zsiq-newtheme { display: none !important; visibility: hidden !important; }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const fetchData = async (t?: string) => {
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
      const json: ApiResponse = await resp.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  if (!token) {
    return <LoginForm onLogin={(t) => { setToken(t); fetchData(t); }} />;
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedAccounts = data?.accounts ? [...data.accounts].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'email') return dir * a.email.localeCompare(b.email);
    const aVal = a[sortField] ?? -1;
    const bVal = b[sortField] ?? -1;
    return dir * (aVal - bVal);
  }) : [];

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-white/30';
    if (score >= 97) return 'text-emerald-400';
    if (score >= 90) return 'text-yellow-400';
    return 'text-red-400';
  };

  const limitBadge = (limit: number | null) => {
    if (limit === 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">THROTTLED</span>;
    if (limit == null) return <span className="text-white/30">—</span>;
    return <span className="text-white/70">{limit}</span>;
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
                  Instantly Health Monitor
                </h1>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <Signal className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
              </div>
              <p className="text-[11px] text-[#8a8a9a] mt-0.5 tracking-wide">Email account health scores & send limits</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading}
              className="border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-[#D4A853] hover:border-[#D4A853]/30 hover:bg-[#D4A853]/5 transition-all">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem('dashboard_token'); setToken(null); }}
              className="text-white/40 hover:text-white/80 text-xs">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 text-[#D4A853]/40 animate-spin" />
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Total Accounts', value: data.summary.total, color: 'text-white' },
                { label: 'Healthy (97+)', value: data.summary.healthy, color: 'text-emerald-400' },
                { label: 'Unhealthy (<97)', value: data.summary.unhealthy, color: 'text-red-400' },
                { label: 'No Score', value: data.summary.no_score, color: 'text-white/40' },
                { label: 'Throttled (0)', value: data.summary.throttled, color: 'text-yellow-400' },
              ].map(card => (
                <div key={card.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="text-[11px] text-[#8a8a9a] uppercase tracking-widest mb-1">{card.label}</div>
                  <div className={`text-2xl font-bold font-display ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-white/20 mb-4">
              Last fetched: {new Date(data.timestamp).toLocaleString()}
            </div>

            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium cursor-pointer hover:text-white/60 select-none"
                          onClick={() => handleSort('email')}>
                        Email <SortIcon field="email" />
                      </th>
                      <th className="text-center px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium cursor-pointer hover:text-white/60 select-none"
                          onClick={() => handleSort('health_score')}>
                        Health Score <SortIcon field="health_score" />
                      </th>
                      <th className="text-center px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium cursor-pointer hover:text-white/60 select-none"
                          onClick={() => handleSort('daily_limit')}>
                        Daily Limit <SortIcon field="daily_limit" />
                      </th>
                      <th className="text-center px-4 py-3 text-[11px] text-[#8a8a9a] uppercase tracking-widest font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAccounts.map(account => (
                      <tr key={account.email} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-white/80 font-mono text-xs">{account.email}</td>
                        <td className={`px-4 py-2.5 text-center font-bold ${scoreColor(account.health_score)}`}>
                          {account.health_score != null ? account.health_score : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">{limitBadge(account.daily_limit)}</td>
                        <td className="px-4 py-2.5 text-center">
                          {account.health_score != null && account.health_score >= 97
                            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">OK</span>
                            : account.health_score != null
                            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">LOW</span>
                            : <span className="text-white/20">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/[0.04] py-4 mt-8 relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between text-[11px] text-white/20 tracking-wide">
          <span>ATALNT LLC - Instantly Health Monitor</span>
          <span>Auto-managed daily at 7:00 AM UTC</span>
        </div>
      </footer>
    </div>
  );
}
