import { useState, useCallback, useEffect } from 'react';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock, AlertCircle, Shield, Users, Briefcase, ChevronDown, ChevronUp,
  LogOut, Download, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle
} from 'lucide-react';
import { exportToExcel } from '@/lib/export-excel';

// ─── Auth ────────────────────────────────────
function useClientAuth(clientSlug: string) {
  const STORAGE_KEY = `atalnt_client_${clientSlug}`;
  const [auth, setAuth] = useState<{ token: string | null; expiresAt: number | null }>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) return parsed;
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    return { token: null, expiresAt: null };
  });

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, client: clientSlug }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const newAuth = { token: data.token, expiresAt: data.expiresAt };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
      setAuth(newAuth);
      return true;
    } catch { return false; }
  }, [clientSlug, STORAGE_KEY]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuth({ token: null, expiresAt: null });
  }, [STORAGE_KEY]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (auth.expiresAt && Date.now() >= auth.expiresAt) logout();
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.expiresAt, logout]);

  return { token: auth.token, isAuthenticated: !!auth.token, login, logout };
}

// ─── API ─────────────────────────────────────
async function fetchClientData(token: string) {
  const res = await fetch('/api/client/candidates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Status Colors ───────────────────────────
const STATUS_COLORS: Record<string, string> = {
  'Submitted': '#3b82f6',
  'Under Review': '#8b5cf6',
  'Submitted to You': '#D4A853',
  'Interview Scheduled': '#f59e0b',
  'Interview in Progress': '#f97316',
  'Offer Pending': '#10b981',
  'Offer Accepted': '#059669',
  'Hired': '#047857',
  'Not Selected': '#6b7280',
  'On Hold': '#9ca3af',
  'Withdrawn': '#ef4444',
};

// ─── Helpers ─────────────────────────────────
function SearchInput({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 bg-white/[0.03] border border-white/[0.06] rounded-md focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.04] transition-colors"
      />
    </div>
  );
}

// ─── Login Component ─────────────────────────
function ClientLogin({ clientName, onLogin }: { clientName: string; onLogin: (pw: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await onLogin(password);
    if (!success) { setError('Invalid password'); setPassword(''); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(212,168,83,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.4) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4A853]/[0.04] rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-14 mx-auto relative z-10" />
            <div className="absolute inset-0 blur-2xl bg-[#D4A853]/20 rounded-full scale-150" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white tracking-wide">{clientName} Portal</h1>
            <p className="text-sm text-white/30 mt-1 tracking-wide">Track your recruiting pipeline with ATALNT</p>
          </div>
        </div>

        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/40 to-transparent" />
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                <Input type="password" placeholder="Enter access code" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#D4A853]/40 focus:ring-[#D4A853]/10"
                  autoFocus disabled={loading} />
              </div>
              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" />{error}</div>}
              <Button type="submit" className="w-full bg-gradient-to-r from-[#D4A853] to-[#b8912e] text-black font-semibold hover:from-[#e0b960] hover:to-[#c9a03a] shadow-lg shadow-[#D4A853]/20" disabled={loading || !password}>
                {loading ? <span className="flex items-center gap-2"><div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Authenticating...</span>
                  : <span className="flex items-center gap-2"><Shield className="h-4 w-4" />Access Portal</span>}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-[11px] text-white/15 tracking-widest uppercase">Powered by ATALNT Solutions</p>
      </div>
    </div>
  );
}

// ─── Dashboard Component ─────────────────────
function ClientDashboardContent({ token, clientName, onLogout }: { token: string; clientName: string; onLogout: () => void }) {
  const [candidatesExpanded, setCandidatesExpanded] = useState(true);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateSort, setCandidateSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'submittedDate', dir: 'desc' });
  const [statusFilter, setStatusFilter] = useState('all');

  const query = useQuery({
    queryKey: ['client-portal', clientName],
    queryFn: () => fetchClientData(token),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  if (query.isLoading) return <PortalSkeleton clientName={clientName} />;

  if (query.isError) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400/60 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">Failed to load data</h3>
          <p className="text-sm text-white/30 mt-2">{(query.error as Error)?.message || 'Please try again later'}</p>
        </div>
      </div>
    );
  }

  const d = query.data?.data;
  if (!d) return null;

  const { candidates = [], jobs = [], statusCounts = {}, totalCandidates = 0, totalJobs = 0 } = d;

  const filteredCandidates = candidates
    .filter((c: any) => (statusFilter === 'all' || c.status === statusFilter))
    .filter((c: any) => {
      if (!candidateSearch) return true;
      const q = candidateSearch.toLowerCase();
      return [c.candidateName, c.jobTitle, c.status, c.city, c.state].some(v => (v || '').toLowerCase().includes(q));
    })
    .sort((a: any, b: any) => {
      const k = candidateSort.key;
      const dir = candidateSort.dir === 'asc' ? 1 : -1;
      if (k === 'submittedDate' || k === 'lastUpdated') return (new Date(a[k]).getTime() - new Date(b[k]).getTime()) * dir;
      return String(a[k] || '').localeCompare(String(b[k] || '')) * dir;
    });

  function SortHead({ col }: { col: { key: string; label: string; align?: string } }) {
    return (
      <TableHead
        className={`text-white/25 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50 select-none transition-colors ${col.align || ''}`}
        onClick={() => setCandidateSort(prev => ({ key: col.key, dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc' }))}
      >
        <span className="inline-flex items-center gap-1">
          {col.label}
          {candidateSort.key === col.key
            ? candidateSort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-[#D4A853]" /> : <ArrowDown className="h-3 w-3 text-[#D4A853]" />
            : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </span>
      </TableHead>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] relative">
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(212,168,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-8" />
            <div>
              <h1 className="text-lg font-bold text-white font-display">{clientName} <span className="text-white/40 font-normal">Recruiting Portal</span></h1>
              <p className="text-[11px] text-white/25">Powered by ATALNT Solutions</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-white/40 hover:text-white/60 hover:bg-white/[0.05]">
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Total Candidates</p>
              <p className="text-2xl font-bold text-white mt-1">{totalCandidates}</p>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Open Positions</p>
              <p className="text-2xl font-bold text-[#D4A853] mt-1">{totalJobs}</p>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">In Interview</p>
              <p className="text-2xl font-bold text-purple-400 mt-1">{(statusCounts['Interview Scheduled'] || 0) + (statusCounts['Interview in Progress'] || 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Hired</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{statusCounts['Hired'] || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Status breakdown */}
        {Object.keys(statusCounts).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            <button
              onClick={() => setStatusFilter('all')}
              className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${statusFilter === 'all' ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/30' : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04]'}`}
            >All <span className="font-semibold ml-0.5">{totalCandidates}</span></button>
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${statusFilter === status ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/30' : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04]'}`}
              >{status} <span className="font-semibold ml-0.5">{count}</span></button>
            ))}
          </div>
        )}

        {/* Candidates Table */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setCandidatesExpanded(v => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                {candidatesExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
                <Users className="h-3.5 w-3.5 text-[#D4A853]/60" />
                Candidates Submitted
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">
                  {filteredCandidates.length} {statusFilter !== 'all' ? statusFilter : 'Total'}
                </Badge>
                <button onClick={(e) => {
                  e.stopPropagation();
                  exportToExcel(
                    filteredCandidates.map((c: any) => ({ ...c, submittedDate: c.submittedDate ? new Date(c.submittedDate).toLocaleDateString('en-US') : '', lastUpdated: c.lastUpdated ? new Date(c.lastUpdated).toLocaleDateString('en-US') : '' })),
                    [{ key: 'candidateName', label: 'Candidate' }, { key: 'jobTitle', label: 'Position' }, { key: 'status', label: 'Status' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'submittedDate', label: 'Submitted' }, { key: 'lastUpdated', label: 'Last Updated' }],
                    `${clientName}_Candidates`, 'Candidates'
                  );
                }} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded px-2 py-1 transition-colors" title="Export to Excel">
                  <Download className="h-3 w-3" />Excel
                </button>
              </div>
            </div>
          </CardHeader>
          {candidatesExpanded && (
            <CardContent>
              {candidates.length > 0 ? (
                <>
                  <SearchInput value={candidateSearch} onChange={setCandidateSearch} placeholder="Search candidates, positions, locations..." />
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.04] hover:bg-transparent">
                          <SortHead col={{ key: 'candidateName', label: 'Candidate' }} />
                          <SortHead col={{ key: 'jobTitle', label: 'Position' }} />
                          <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Status</TableHead>
                          <SortHead col={{ key: 'city', label: 'Location' }} />
                          <SortHead col={{ key: 'submittedDate', label: 'Submitted' }} />
                          <SortHead col={{ key: 'lastUpdated', label: 'Last Updated' }} />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCandidates.map((c: any, i: number) => {
                          const color = STATUS_COLORS[c.status] || '#6b7280';
                          const submitted = c.submittedDate ? new Date(c.submittedDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
                          const updated = c.lastUpdated ? new Date(c.lastUpdated).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
                          const location = [c.city, c.state].filter(Boolean).join(', ') || '—';
                          return (
                            <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                              <TableCell className="font-medium text-white/80">{c.candidateName}</TableCell>
                              <TableCell className="text-white/50 text-sm max-w-[250px] truncate">{c.jobTitle}</TableCell>
                              <TableCell>
                                <span className="text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap"
                                  style={{ backgroundColor: `${color}20`, color }}>
                                  {c.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-white/40 text-xs whitespace-nowrap">{location}</TableCell>
                              <TableCell className="text-white/40 text-xs whitespace-nowrap">{submitted}</TableCell>
                              <TableCell className="text-white/40 text-xs whitespace-nowrap">{updated}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30 text-sm">No candidates have been submitted yet</p>
                  <p className="text-white/15 text-xs mt-1">Check back soon — our team is actively sourcing for your positions</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function PortalSkeleton({ clientName }: { clientName: string }) {
  return (
    <div className="min-h-screen bg-[#0a0b0f] relative">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-8" />
          <h1 className="text-lg font-bold text-white font-display">{clientName} <span className="text-white/40 font-normal">Recruiting Portal</span></h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
        </div>
        <Skeleton className="h-64 rounded-xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────
const queryClient = new QueryClient();

export default function ClientPortal({ clientSlug, clientDisplayName }: { clientSlug: string; clientDisplayName: string }) {
  const { token, isAuthenticated, login, logout } = useClientAuth(clientSlug);

  if (!isAuthenticated) {
    return <ClientLogin clientName={clientDisplayName} onLogin={login} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ClientDashboardContent token={token!} clientName={clientDisplayName} onLogout={logout} />
    </QueryClientProvider>
  );
}
