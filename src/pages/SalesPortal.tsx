import { useState, useCallback, useEffect } from 'react';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock, AlertCircle, Shield, LogOut, Download, Search,
  ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, TrendingUp,
  Users, Building2, FileSignature, Phone, DollarSign, Briefcase,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { exportToExcel } from '@/lib/export-excel';

// ─── Auth ────────────────────────────────────
const STORAGE_KEY = 'atalnt_sales_portal';

function useSalesAuth() {
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
      const response = await fetch('/api/client/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, client: 'sales' }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const newAuth = { token: data.token, expiresAt: data.expiresAt };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
      setAuth(newAuth);
      return true;
    } catch { return false; }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuth({ token: null, expiresAt: null });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (auth.expiresAt && Date.now() >= auth.expiresAt) logout();
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.expiresAt, logout]);

  return { token: auth.token, isAuthenticated: !!auth.token, login, logout };
}

// ─── Helpers ─────────────────────────────────
function SearchInput({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 bg-white/[0.03] border border-white/[0.06] rounded-md focus:outline-none focus:border-white/[0.15] transition-colors" />
    </div>
  );
}

function fmt(n: number) { return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`; }
function fmtDate(s: string) { return s ? new Date(s).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'; }

const STAGE_COLORS: Record<string, string> = {
  'Qualification': '#3b82f6', 'Value Proposition': '#8b5cf6', 'Id. Decision Makers': '#f59e0b',
  'Perception Analysis': '#f97316', 'Proposal/Price Quote': '#D4A853', 'Negotiation/Review': '#10b981',
  'Closed Won': '#047857', 'Closed Lost': '#6b7280',
};

// ─── Login ────────────────────────────────────
function SalesLogin({ onLogin }: { onLogin: (pw: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const ok = await onLogin(password);
    if (!ok) { setError('Invalid password'); setPassword(''); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(212,168,83,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4A853]/[0.04] rounded-full blur-[120px]" />
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-14 mx-auto relative z-10" />
            <div className="absolute inset-0 blur-2xl bg-[#D4A853]/20 rounded-full scale-150" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white tracking-wide">Sales Dashboard</h1>
            <p className="text-sm text-white/30 mt-1 tracking-wide">ATALNT internal sales intelligence</p>
          </div>
        </div>
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/40 to-transparent" />
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                <Input type="password" placeholder="Enter access code" value={password} onChange={e => setPassword(e.target.value)}
                  className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#D4A853]/40" autoFocus disabled={loading} />
              </div>
              {error && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" />{error}</div>}
              <Button type="submit" className="w-full bg-gradient-to-r from-[#D4A853] to-[#b8912e] text-black font-semibold hover:from-[#e0b960] hover:to-[#c9a03a] shadow-lg shadow-[#D4A853]/20" disabled={loading || !password}>
                {loading ? <span className="flex items-center gap-2"><div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Authenticating...</span>
                  : <span className="flex items-center gap-2"><Shield className="h-4 w-4" />Access Sales Portal</span>}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-[11px] text-white/15 tracking-widest uppercase">Powered by ATALNT Solutions</p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────
function SalesDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [dealsExpanded, setDealsExpanded] = useState(true);
  const [dealsSearch, setDealsSearch] = useState('');
  const [dealsSort, setDealsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdTime', dir: 'desc' });
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [clientsSearch, setClientsSearch] = useState('');
  const [clientsSort, setClientsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdTime', dir: 'desc' });
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsOwnerFilter, setLeadsOwnerFilter] = useState('all');
  const [leadsSort, setLeadsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdTime', dir: 'desc' });
  const [signExpanded, setSignExpanded] = useState(true);
  const [signSearch, setSignSearch] = useState('');
  const [signFilter, setSignFilter] = useState('all');

  const query = useQuery({
    queryKey: ['sales-portal'],
    queryFn: async () => {
      const res = await fetch('/api/client/portal', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, staleTime: 2 * 60 * 1000,
  });

  if (query.isLoading) return <SalesSkeleton />;
  if (query.isError) return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
      <div className="text-center"><AlertTriangle className="h-12 w-12 text-red-400/60 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">Failed to load</h3>
        <p className="text-sm text-white/30 mt-2">{(query.error as Error)?.message}</p>
      </div>
    </div>
  );

  const d = query.data?.data;
  if (!d) return null;

  const { overview = {}, leadRecords = [], leadsByOwner = [], leadsByStatus = [], leadsBySource = [], dealsByStage = [], dealsByOwner = [], callsByOwner = [], recentDeals = [], clients = [], signDocuments = [] } = d;

  // All unique owners for the filter tabs
  const leadOwners: string[] = [...new Set(leadRecords.map((l: any) => l.owner))].sort() as string[];

  // Filtered + sorted leads
  const filteredLeads = leadRecords
    .filter((l: any) => leadsOwnerFilter === 'all' || l.owner === leadsOwnerFilter)
    .filter((l: any) => !leadsSearch || [l.fullName, l.company, l.email, l.leadStatus, l.leadSource, l.owner].some((v: string) => (v || '').toLowerCase().includes(leadsSearch.toLowerCase())))
    .sort((a: any, b: any) => {
      const dir = leadsSort.dir === 'asc' ? 1 : -1;
      if (leadsSort.key === 'createdTime') return (new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime()) * dir;
      return String(a[leadsSort.key] || '').localeCompare(String(b[leadsSort.key] || '')) * dir;
    });

  function SortHead({ col, sort, setSort }: { col: { key: string; label: string }; sort: { key: string; dir: string }; setSort: (s: any) => void }) {
    return (
      <TableHead className="text-white/25 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50 select-none transition-colors"
        onClick={() => setSort((p: any) => ({ key: col.key, dir: p.key === col.key && p.dir === 'asc' ? 'desc' : 'asc' }))}>
        <span className="inline-flex items-center gap-1">{col.label}
          {sort.key === col.key ? sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-[#D4A853]" /> : <ArrowDown className="h-3 w-3 text-[#D4A853]" /> : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </span>
      </TableHead>
    );
  }

  function ExportBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    return (
      <button onClick={onClick} className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded px-2 py-1 transition-colors">
        <Download className="h-3 w-3" />Excel
      </button>
    );
  }

  function CardWrap({ title, icon: Icon, badge, expanded, setExpanded, onExport, children }: any) {
    return (
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden mb-4">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded((v: boolean) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
              <Icon className="h-3.5 w-3.5 text-[#D4A853]/60" />{title}
            </CardTitle>
            <div className="flex items-center gap-3">
              {badge && <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">{badge}</Badge>}
              {onExport && <ExportBtn onClick={(e) => { e.stopPropagation(); onExport(); }} />}
            </div>
          </div>
        </CardHeader>
        {expanded && <CardContent>{children}</CardContent>}
      </Card>
    );
  }

  // Filtered & sorted deals
  const filteredDeals = recentDeals
    .filter((d: any) => !dealsSearch || [d.dealName, d.stage, d.accountName, d.owner].some((v: string) => (v || '').toLowerCase().includes(dealsSearch.toLowerCase())))
    .sort((a: any, b: any) => {
      const dir = dealsSort.dir === 'asc' ? 1 : -1;
      if (dealsSort.key === 'amount') return ((a.amount || 0) - (b.amount || 0)) * dir;
      if (dealsSort.key === 'createdTime') return (new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime()) * dir;
      return String(a[dealsSort.key] || '').localeCompare(String(b[dealsSort.key] || '')) * dir;
    });

  // Filtered & sorted clients
  const filteredClients = clients
    .filter((c: any) => !clientsSearch || [c.accountName, c.industry, c.owner, c.city].some((v: string) => (v || '').toLowerCase().includes(clientsSearch.toLowerCase())))
    .sort((a: any, b: any) => {
      const dir = clientsSort.dir === 'asc' ? 1 : -1;
      if (clientsSort.key === 'createdTime') return (new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime()) * dir;
      return String(a[clientsSort.key] || '').localeCompare(String(b[clientsSort.key] || '')) * dir;
    });

  // Filtered sign docs
  const filteredSign = signDocuments
    .filter((d: any) => signFilter === 'all' || d.status === signFilter)
    .filter((d: any) => !signSearch || [d.documentName, d.owner, d.status].some((v: string) => (v || '').toLowerCase().includes(signSearch.toLowerCase())));

  const signStatuses = [...new Set(signDocuments.map((d: any) => d.status))];

  return (
    <div className="min-h-screen bg-[#0a0b0f] relative">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(212,168,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-8" />
            <div>
              <h1 className="text-lg font-bold text-white font-display">Sales <span className="text-white/40 font-normal">Dashboard</span></h1>
              <p className="text-[11px] text-white/25">ATALNT internal</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-white/40 hover:text-white/60 hover:bg-white/[0.05]">
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Leads', value: overview.totalLeads || 0, color: 'text-white', sub: `${overview.newLeads30d || 0} new (30d)` },
            { label: 'Open Deals', value: overview.openDeals || 0, color: 'text-[#D4A853]', sub: `${overview.totalDeals || 0} total` },
            { label: 'Closed Won', value: overview.closedWon || 0, color: 'text-emerald-400', sub: fmt(overview.totalRevenue || 0) },
            { label: 'Clients', value: overview.totalClients || 0, color: 'text-blue-400', sub: `${overview.totalCalls || 0} calls logged` },
          ].map(kpi => (
            <Card key={kpi.label} className="border-white/[0.06] bg-white/[0.02]">
              <CardContent className="p-4">
                <p className="text-[10px] text-white/25 uppercase tracking-widest">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-white/20 mt-0.5">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leads Tracker — full table with owner filter */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden mb-4">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setLeadsExpanded(v => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                {leadsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
                <Users className="h-3.5 w-3.5 text-[#D4A853]/60" />Leads Tracker
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">
                  {filteredLeads.length} leads
                </Badge>
                <button onClick={(e) => { e.stopPropagation(); exportToExcel(filteredLeads.map((l: any) => ({ ...l, createdTime: fmtDate(l.createdTime) })),
                  [{ key: 'fullName', label: 'Name' }, { key: 'company', label: 'Company' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'leadSource', label: 'Source' }, { key: 'leadStatus', label: 'Status' }, { key: 'owner', label: 'Owner' }, { key: 'createdTime', label: 'Created' }],
                  `ATALNT_Leads${leadsOwnerFilter !== 'all' ? '_' + leadsOwnerFilter : ''}`, 'Leads'); }}
                  className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded px-2 py-1 transition-colors">
                  <Download className="h-3 w-3" />Excel
                </button>
              </div>
            </div>
          </CardHeader>
          {leadsExpanded && (
            <CardContent>
              {/* Owner filter tabs */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button onClick={() => setLeadsOwnerFilter('all')}
                  className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${leadsOwnerFilter === 'all' ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/30' : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04]'}`}>
                  All <span className="font-semibold ml-0.5">{leadRecords.length}</span>
                </button>
                {leadsByOwner.map((o: any) => (
                  <button key={o.owner} onClick={() => setLeadsOwnerFilter(o.owner)}
                    className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${leadsOwnerFilter === o.owner ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/30' : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04]'}`}>
                    {o.owner} <span className="font-semibold ml-0.5">{o.count}</span>
                  </button>
                ))}
              </div>
              <SearchInput value={leadsSearch} onChange={setLeadsSearch} placeholder="Search name, company, email, status..." />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.04] hover:bg-transparent">
                      <SortHead col={{ key: 'fullName', label: 'Name' }} sort={leadsSort} setSort={setLeadsSort} />
                      <SortHead col={{ key: 'company', label: 'Company' }} sort={leadsSort} setSort={setLeadsSort} />
                      <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Email</TableHead>
                      <SortHead col={{ key: 'leadSource', label: 'Source' }} sort={leadsSort} setSort={setLeadsSort} />
                      <SortHead col={{ key: 'leadStatus', label: 'Status' }} sort={leadsSort} setSort={setLeadsSort} />
                      <SortHead col={{ key: 'owner', label: 'Owner' }} sort={leadsSort} setSort={setLeadsSort} />
                      <SortHead col={{ key: 'createdTime', label: 'Added' }} sort={leadsSort} setSort={setLeadsSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead: any, i: number) => (
                      <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-white/80">{lead.fullName}</TableCell>
                        <TableCell className="text-white/50 text-sm max-w-[200px] truncate">{lead.company || '—'}</TableCell>
                        <TableCell className="text-white/40 text-xs max-w-[180px] truncate">{lead.email || '—'}</TableCell>
                        <TableCell className="text-white/40 text-xs whitespace-nowrap">{lead.leadSource || '—'}</TableCell>
                        <TableCell>
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-500/10 text-blue-400 whitespace-nowrap">{lead.leadStatus || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-[#D4A853]/10 text-[#D4A853] whitespace-nowrap">{lead.owner}</span>
                        </TableCell>
                        <TableCell className="text-white/40 text-xs whitespace-nowrap">{fmtDate(lead.createdTime)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Pipeline + Leads summary side by side */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Deals by Stage */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-[#D4A853]/60" />Pipeline by Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dealsByStage.map((s: any) => {
                  const color = STAGE_COLORS[s.stage] || '#6b7280';
                  return (
                    <div key={s.stage} className="flex items-center justify-between text-xs">
                      <span className="text-white/50 truncate max-w-[160px]">{s.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: `${color}20`, color }}>{s.count}</span>
                        {s.value > 0 && <span className="text-white/25 text-[10px]">{fmt(s.value)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Leads by Status */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#D4A853]/60" />Leads by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leadsByStatus.slice(0, 10).map((s: any) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <span className="text-white/50 truncate max-w-[180px]">{s.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-500/10 text-blue-400">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Owner breakdown */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-[#D4A853]/60" />Deals by Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dealsByOwner.map((o: any) => (
                  <div key={o.owner} className="flex items-center justify-between text-xs">
                    <span className="text-white/50 truncate max-w-[180px]">{o.owner}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-[#D4A853]/10 text-[#D4A853]">{o.count}</span>
                      {o.value > 0 && <span className="text-white/25 text-[10px]">{fmt(o.value)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-[#D4A853]/60" />Calls by Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {callsByOwner.map((o: any) => (
                  <div key={o.owner} className="flex items-center justify-between text-xs">
                    <span className="text-white/50 truncate max-w-[180px]">{o.owner}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/10 text-purple-400">{o.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Deals table */}
        <CardWrap title="Recent Deals" icon={DollarSign} badge={`${filteredDeals.length} deals`} expanded={dealsExpanded} setExpanded={setDealsExpanded}
          onExport={() => exportToExcel(filteredDeals.map((d: any) => ({ ...d, createdTime: fmtDate(d.createdTime), closeDate: fmtDate(d.closeDate) })),
            [{ key: 'dealName', label: 'Deal' }, { key: 'accountName', label: 'Account' }, { key: 'stage', label: 'Stage' }, { key: 'amount', label: 'Amount' }, { key: 'owner', label: 'Owner' }, { key: 'closeDate', label: 'Close Date' }, { key: 'createdTime', label: 'Created' }],
            'ATALNT_Deals', 'Deals')}>
          <SearchInput value={dealsSearch} onChange={setDealsSearch} placeholder="Search deals, accounts, owners..." />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.04] hover:bg-transparent">
                  <SortHead col={{ key: 'dealName', label: 'Deal' }} sort={dealsSort} setSort={setDealsSort} />
                  <SortHead col={{ key: 'accountName', label: 'Account' }} sort={dealsSort} setSort={setDealsSort} />
                  <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Stage</TableHead>
                  <SortHead col={{ key: 'amount', label: 'Amount' }} sort={dealsSort} setSort={setDealsSort} />
                  <SortHead col={{ key: 'owner', label: 'Owner' }} sort={dealsSort} setSort={setDealsSort} />
                  <SortHead col={{ key: 'closeDate', label: 'Close Date' }} sort={dealsSort} setSort={setDealsSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal: any, i: number) => {
                  const color = STAGE_COLORS[deal.stage] || '#6b7280';
                  return (
                    <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-white/80 max-w-[200px] truncate">{deal.dealName}</TableCell>
                      <TableCell className="text-white/50 text-sm">{deal.accountName || '—'}</TableCell>
                      <TableCell><span className="text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap" style={{ backgroundColor: `${color}20`, color }}>{deal.stage}</span></TableCell>
                      <TableCell className="text-white/60 text-sm font-medium">{deal.amount > 0 ? fmt(deal.amount) : '—'}</TableCell>
                      <TableCell className="text-white/40 text-xs">{deal.owner}</TableCell>
                      <TableCell className="text-white/40 text-xs whitespace-nowrap">{fmtDate(deal.closeDate)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardWrap>

        {/* Clients table */}
        <CardWrap title="Clients" icon={Building2} badge={`${filteredClients.length} accounts`} expanded={clientsExpanded} setExpanded={setClientsExpanded}
          onExport={() => exportToExcel(filteredClients.map((c: any) => ({ ...c, createdTime: fmtDate(c.createdTime) })),
            [{ key: 'accountName', label: 'Account' }, { key: 'industry', label: 'Industry' }, { key: 'phone', label: 'Phone' }, { key: 'website', label: 'Website' }, { key: 'city', label: 'City' }, { key: 'owner', label: 'Owner' }, { key: 'createdTime', label: 'Created' }],
            'ATALNT_Clients', 'Clients')}>
          <SearchInput value={clientsSearch} onChange={setClientsSearch} placeholder="Search accounts, industry, owners..." />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.04] hover:bg-transparent">
                  <SortHead col={{ key: 'accountName', label: 'Account' }} sort={clientsSort} setSort={setClientsSort} />
                  <SortHead col={{ key: 'industry', label: 'Industry' }} sort={clientsSort} setSort={setClientsSort} />
                  <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Phone</TableHead>
                  <SortHead col={{ key: 'owner', label: 'Owner' }} sort={clientsSort} setSort={setClientsSort} />
                  <SortHead col={{ key: 'createdTime', label: 'Created' }} sort={clientsSort} setSort={setClientsSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c: any, i: number) => (
                  <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                    <TableCell className="font-medium text-white/80">{c.accountName}</TableCell>
                    <TableCell className="text-white/50 text-sm">{c.industry || '—'}</TableCell>
                    <TableCell className="text-white/40 text-xs">{c.phone || '—'}</TableCell>
                    <TableCell className="text-white/40 text-xs">{c.owner}</TableCell>
                    <TableCell className="text-white/40 text-xs whitespace-nowrap">{fmtDate(c.createdTime)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardWrap>

        {/* Zoho Sign Documents */}
        {signDocuments.length > 0 && (
          <CardWrap title="Zoho Sign Documents" icon={FileSignature} badge={`${filteredSign.length} docs`} expanded={signExpanded} setExpanded={setSignExpanded}
            onExport={() => exportToExcel(filteredSign.map((d: any) => ({ ...d, createdTime: fmtDate(d.createdTime) })),
              [{ key: 'documentName', label: 'Document' }, { key: 'status', label: 'Status' }, { key: 'owner', label: 'Owner' }, { key: 'createdTime', label: 'Created' }],
              'ATALNT_SignDocs', 'Sign Docs')}>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['all', ...signStatuses].map((s: any) => (
                <button key={s} onClick={() => setSignFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${signFilter === s ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/30' : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04]'}`}>
                  {s === 'all' ? `All ${signDocuments.length}` : `${s} ${signDocuments.filter((d: any) => d.status === s).length}`}
                </button>
              ))}
            </div>
            <SearchInput value={signSearch} onChange={setSignSearch} placeholder="Search documents..." />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Document</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Status</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Owner</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSign.map((doc: any, i: number) => {
                    const statusColor = doc.status === 'completed' ? '#047857' : doc.status === 'inprogress' ? '#f59e0b' : '#6b7280';
                    return (
                      <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-white/80 max-w-[280px] truncate">{doc.documentName}</TableCell>
                        <TableCell><span className="text-[10px] px-2 py-0.5 rounded font-medium capitalize" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>{doc.status}</span></TableCell>
                        <TableCell className="text-white/40 text-xs">{doc.owner}</TableCell>
                        <TableCell className="text-white/40 text-xs whitespace-nowrap">{fmtDate(doc.createdTime)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardWrap>
        )}

      </div>
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4 mb-6"><img src="/atalnt-logo-transparent.png" alt="ATALNT" className="h-8" /><Skeleton className="h-6 w-48 bg-white/[0.04]" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}</div>
        <div className="grid md:grid-cols-2 gap-4 mb-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl bg-white/[0.04]" />)}</div>
        <Skeleton className="h-64 rounded-xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────
const queryClient = new QueryClient();

export default function SalesPortal() {
  const { token, isAuthenticated, login, logout } = useSalesAuth();
  if (!isAuthenticated) return <SalesLogin onLogin={login} />;
  return (
    <QueryClientProvider client={queryClient}>
      <SalesDashboard token={token!} onLogout={logout} />
    </QueryClientProvider>
  );
}
