import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardCard } from './DashboardCard';
import { fetchSalesDashboard } from '@/lib/dashboard-api';
import {
  TrendingUp, Users, DollarSign, Phone, Target, ChevronDown, ChevronUp,
  AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, Building2, FileSignature, Download, Search
} from 'lucide-react';
import { exportToExcel } from '@/lib/export-excel';

function SearchInput({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 bg-white/[0.03] border border-white/[0.06] rounded-md focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.04] transition-colors"
      />
    </div>
  );
}

function matchesSearch(row: Record<string, any>, query: string, keys: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return keys.some((k) => String(row[k] || '').toLowerCase().includes(q));
}

interface SalesDashboardProps {
  token: string;
  datePreset: string;
  dateRange: { from: string; to: string };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function WinRateCell({ value }: { value: number }) {
  const color = value >= 50 ? 'text-emerald-400' : value >= 25 ? 'text-amber-400' : value > 0 ? 'text-red-400' : 'text-white/15';
  return <span className={`text-sm font-semibold ${color}`}>{value > 0 ? `${value}%` : '—'}</span>;
}

const STAGE_COLORS: Record<string, string> = {
  'Qualification': '#3b82f6',
  'Value Proposition': '#8b5cf6',
  'Identify Decision Makers': '#6366f1',
  'Perception Analysis': '#a855f7',
  'Proposal/Price Quote': '#D4A853',
  'Negotiation/Review': '#f59e0b',
  'Closed Won': '#10b981',
  'Closed Lost': '#ef4444',
};

const STATUS_COLORS: Record<string, string> = {
  'Not Contacted': '#6b7280',
  'Contacted': '#3b82f6',
  'Junk Lead': '#ef4444',
  'Lost Lead': '#dc2626',
  'Not Qualified': '#9f1239',
  'Pre-Qualified': '#D4A853',
  'Qualified': '#10b981',
};

export function SalesDashboard({ token, datePreset, dateRange }: SalesDashboardProps) {
  const [pipelineExpanded, setPipelineExpanded] = useState(true);
  const [ownerExpanded, setOwnerExpanded] = useState(true);
  const [callsExpanded, setCallsExpanded] = useState(true);
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [clientsSort, setClientsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdTime', dir: 'desc' });
  const [signExpanded, setSignExpanded] = useState(true);
  const [signSort, setSignSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdTime', dir: 'desc' });
  const [signFilter, setSignFilter] = useState<string>('all');
  const [pipelineSort, setPipelineSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'amount', dir: 'desc' });
  const [ownerSort, setOwnerSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalDeals', dir: 'desc' });
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [clientsSearch, setClientsSearch] = useState('');
  const [signSearch, setSignSearch] = useState('');

  const salesQuery = useQuery({
    queryKey: ['sales', 'deals', datePreset],
    queryFn: () => fetchSalesDashboard(token, dateRange.from, dateRange.to),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  if (salesQuery.isLoading) return <SalesSkeleton />;

  if (salesQuery.isError) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400/60 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">Failed to load CRM data</h3>
        <p className="text-sm text-white/30 mt-2">{salesQuery.error?.message || 'Check CRM API connection'}</p>
      </div>
    );
  }

  const d = salesQuery.data?.data;
  if (!d) return null;

  const { overview, leadsBySource, leadsByStatus, dealsByStage, dealsByOwner, recentDeals, callsByOwner, clients = [], signDocuments = [] } = d;
  const periodLabel = datePreset.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  function SortHead({ col, currentSort, setSort }: { col: { key: string; label: string; align?: string }; currentSort: { key: string; dir: 'asc' | 'desc' }; setSort: (s: { key: string; dir: 'asc' | 'desc' }) => void }) {
    return (
      <TableHead
        className={`text-white/25 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50 select-none transition-colors ${col.align || 'text-right'}`}
        onClick={() => setSort({ key: col.key, dir: currentSort.key === col.key && currentSort.dir === 'asc' ? 'desc' : 'asc' })}
      >
        <span className="inline-flex items-center gap-1 justify-end">
          {col.label}
          {currentSort.key === col.key
            ? currentSort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-[#D4A853]" /> : <ArrowDown className="h-3 w-3 text-[#D4A853]" />
            : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </span>
      </TableHead>
    );
  }

  function ExportBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded px-2 py-1 transition-colors"
        title="Export to Excel"
      >
        <Download className="h-3 w-3" />
        Excel
      </button>
    );
  }

  return (
    <div className="space-y-6">

      {/* ============================================ */}
      {/* KPI OVERVIEW                                 */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <DashboardCard
          title="New Leads"
          value={overview.newLeadsThisPeriod}
          subtitle={periodLabel}
          icon={<Users className="h-4 w-4" />}
          color="blue"
        />
        <DashboardCard
          title="Pipeline Value"
          value={fmt(overview.totalPipelineValue)}
          subtitle={`${overview.openDeals} open deals`}
          icon={<Target className="h-4 w-4" />}
          color="gold"
        />
        <DashboardCard
          title="Closed Won"
          value={overview.closedWonDeals}
          subtitle={periodLabel}
          icon={<Briefcase className="h-4 w-4" />}
          color="green"
        />
        <DashboardCard
          title="Revenue"
          value={fmt(overview.totalRevenue)}
          subtitle="Closed Won value"
          icon={<DollarSign className="h-4 w-4" />}
          color="green"
        />
        <DashboardCard
          title="Calls Logged"
          value={overview.totalCalls}
          subtitle={periodLabel}
          icon={<Phone className="h-4 w-4" />}
          color="purple"
        />
      </div>

      {/* ============================================ */}
      {/* DEALS PIPELINE                               */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setPipelineExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {pipelineExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
              <Target className="h-3.5 w-3.5 text-[#D4A853]/60" />
              Deals Pipeline
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/40">
                Pipeline: <span className="text-[#D4A853] font-semibold">{fmt(overview.totalPipelineValue)}</span>
              </span>
              <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">
                {overview.openDeals} Open Deals
              </Badge>
              <ExportBtn onClick={(e) => { e.stopPropagation(); exportToExcel(recentDeals.map((d: any) => ({ ...d, amount: d.amount > 0 ? d.amount : '' })), [{ key: 'dealName', label: 'Deal' }, { key: 'accountName', label: 'Account' }, { key: 'stage', label: 'Stage' }, { key: 'amount', label: 'Value' }, { key: 'ownerName', label: 'Owner' }, { key: 'closingDate', label: 'Closing Date' }, { key: 'daysUntilClose', label: 'Days Until Close' }], 'Deals_Pipeline', 'Deals'); }} />
            </div>
          </div>
        </CardHeader>
        {pipelineExpanded && <CardContent>
          {/* Stage breakdown */}
          <div className="mb-4 flex flex-wrap gap-2">
            {dealsByStage.filter((s: any) => s.stage !== 'Closed Won' && s.stage !== 'Closed Lost').map((s: any) => (
              <div key={s.stage} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded px-2.5 py-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage] || '#6b7280' }} />
                <span className="text-[10px] text-white/50">{s.stage}</span>
                <span className="text-[10px] text-white/70 font-semibold">{s.count}</span>
                {s.totalValue > 0 && <span className="text-[10px] text-white/30">{fmt(s.totalValue)}</span>}
              </div>
            ))}
          </div>
          {recentDeals.length > 0 ? (
            <>
            <SearchInput value={pipelineSearch} onChange={setPipelineSearch} placeholder="Search deals, accounts, owners..." />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Deal</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Account</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Stage</TableHead>
                    <SortHead col={{ key: 'amount', label: 'Value' }} currentSort={pipelineSort} setSort={setPipelineSort} />
                    <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Owner</TableHead>
                    <SortHead col={{ key: 'daysUntilClose', label: 'Closes In' }} currentSort={pipelineSort} setSort={setPipelineSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...recentDeals].filter((d: any) => matchesSearch(d, pipelineSearch, ['dealName', 'accountName', 'stage', 'ownerName'])).sort((a: any, b: any) => {
                    const k = pipelineSort.key;
                    const dir = pipelineSort.dir === 'asc' ? 1 : -1;
                    return ((a[k] ?? 0) - (b[k] ?? 0)) * dir;
                  }).map((deal: any, i: number) => (
                    <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-white/80 max-w-[200px] truncate">{deal.dealName}</TableCell>
                      <TableCell className="text-white/40 text-xs">{deal.accountName}</TableCell>
                      <TableCell>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${STAGE_COLORS[deal.stage] || '#6b7280'}20`, color: STAGE_COLORS[deal.stage] || '#6b7280' }}>
                          {deal.stage}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[#D4A853] font-semibold">{deal.amount > 0 ? fmt(deal.amount) : '—'}</TableCell>
                      <TableCell className="text-right text-white/40 text-xs">{deal.ownerName}</TableCell>
                      <TableCell className="text-right">
                        {deal.daysUntilClose === null ? <span className="text-white/20">—</span>
                          : deal.isOverdue ? <span className="text-red-400 text-xs font-semibold">{Math.abs(deal.daysUntilClose)}d overdue</span>
                          : <span className="text-white/40 text-xs">{deal.daysUntilClose}d</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <p className="text-center text-white/30 py-8">No open deals</p>
          )}
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* DEAL PERFORMANCE BY OWNER                    */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setOwnerExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {ownerExpanded ? <ChevronUp className="h-3.5 w-3.5 text-emerald-400/60" /> : <ChevronDown className="h-3.5 w-3.5 text-emerald-400/60" />}
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400/60" />
              Deal Performance by Sales Rep
            </CardTitle>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
              {dealsByOwner.length} Reps
            </Badge>
            <ExportBtn onClick={(e) => { e.stopPropagation(); exportToExcel(dealsByOwner, [{ key: 'ownerName', label: 'Sales Rep' }, { key: 'totalDeals', label: 'Total Deals' }, { key: 'openDeals', label: 'Open' }, { key: 'closedWon', label: 'Won' }, { key: 'totalValue', label: 'Pipeline Value' }, { key: 'wonValue', label: 'Won Revenue' }, { key: 'winRate', label: 'Win Rate %' }], 'Deal_Performance', 'Performance'); }} />
          </div>
        </CardHeader>
        {ownerExpanded && <CardContent>
          {dealsByOwner.length > 0 ? (
            <>
            <SearchInput value={ownerSearch} onChange={setOwnerSearch} placeholder="Search sales reps..." />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Sales Rep</TableHead>
                    <SortHead col={{ key: 'totalDeals', label: 'Total Deals' }} currentSort={ownerSort} setSort={setOwnerSort} />
                    <SortHead col={{ key: 'openDeals', label: 'Open' }} currentSort={ownerSort} setSort={setOwnerSort} />
                    <SortHead col={{ key: 'closedWon', label: 'Won' }} currentSort={ownerSort} setSort={setOwnerSort} />
                    <SortHead col={{ key: 'totalValue', label: 'Pipeline Value' }} currentSort={ownerSort} setSort={setOwnerSort} />
                    <SortHead col={{ key: 'wonValue', label: 'Won Revenue' }} currentSort={ownerSort} setSort={setOwnerSort} />
                    <SortHead col={{ key: 'winRate', label: 'Win Rate' }} currentSort={ownerSort} setSort={setOwnerSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...dealsByOwner].filter((o: any) => matchesSearch(o, ownerSearch, ['ownerName'])).sort((a: any, b: any) => {
                    const k = ownerSort.key;
                    const dir = ownerSort.dir === 'asc' ? 1 : -1;
                    return ((a[k] || 0) - (b[k] || 0)) * dir;
                  }).map((o: any, i: number) => (
                    <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-white/80">{o.ownerName}</TableCell>
                      <TableCell className="text-right text-white/50">{o.totalDeals}</TableCell>
                      <TableCell className="text-right text-[#D4A853] font-semibold">{o.openDeals}</TableCell>
                      <TableCell className="text-right">
                        {o.closedWon > 0 ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{o.closedWon}</Badge> : <span className="text-white/20">0</span>}
                      </TableCell>
                      <TableCell className="text-right text-white/50">{o.totalValue > 0 ? fmt(o.totalValue) : '—'}</TableCell>
                      <TableCell className="text-right text-emerald-400 font-semibold">{o.wonValue > 0 ? fmt(o.wonValue) : '—'}</TableCell>
                      <TableCell className="text-right"><WinRateCell value={o.winRate} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <p className="text-center text-white/30 py-8">No deal data available</p>
          )}
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* LEADS BREAKDOWN                              */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setLeadsExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {leadsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-blue-400/60" /> : <ChevronDown className="h-3.5 w-3.5 text-blue-400/60" />}
              <Users className="h-3.5 w-3.5 text-blue-400/60" />
              Leads Breakdown
            </CardTitle>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
              {overview.newLeadsThisPeriod} New Leads
            </Badge>
            <ExportBtn onClick={(e) => { e.stopPropagation(); const rows = [...leadsBySource.map((s: any) => ({ type: 'Source', name: s.source, count: s.count })), ...leadsByStatus.map((s: any) => ({ type: 'Status', name: s.status, count: s.count }))]; exportToExcel(rows, [{ key: 'type', label: 'Category' }, { key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }], 'Leads_Breakdown', 'Leads'); }} />
          </div>
        </CardHeader>
        {leadsExpanded && <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* By Source */}
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">By Source</p>
              {leadsBySource.length > 0 ? (
                <div className="space-y-2">
                  {leadsBySource.map((s: any) => (
                    <div key={s.source} className="flex items-center gap-2">
                      <span className="text-xs text-white/60 w-36 truncate">{s.source}</span>
                      <div className="flex-1 bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${Math.round((s.count / (leadsBySource[0]?.count || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-blue-400 font-semibold w-6 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-white/20 text-xs">No data</p>}
            </div>
            {/* By Status */}
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">By Status</p>
              {leadsByStatus.length > 0 ? (
                <div className="space-y-1.5">
                  {leadsByStatus.map((s: any) => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: `${STATUS_COLORS[s.status] || '#6b7280'}20`, color: STATUS_COLORS[s.status] || '#6b7280' }}>
                        {s.status}
                      </span>
                      <span className="text-xs text-white/50 font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-white/20 text-xs">No data</p>}
            </div>
          </div>
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* CALLS BY OWNER                               */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setCallsExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {callsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-purple-400/60" /> : <ChevronDown className="h-3.5 w-3.5 text-purple-400/60" />}
              <Phone className="h-3.5 w-3.5 text-purple-400/60" />
              Calls Logged
            </CardTitle>
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs">
              {overview.totalCalls} Calls
            </Badge>
            <ExportBtn onClick={(e) => { e.stopPropagation(); exportToExcel(callsByOwner, [{ key: 'ownerName', label: 'Sales Rep' }, { key: 'totalCalls', label: 'Total Calls' }, { key: 'inbound', label: 'Inbound' }, { key: 'outbound', label: 'Outbound' }], 'Calls_Logged', 'Calls'); }} />
          </div>
        </CardHeader>
        {callsExpanded && <CardContent>
          {callsByOwner.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Sales Rep</TableHead>
                    <TableHead className="text-right text-white/25 text-[10px] uppercase tracking-widest">Total Calls</TableHead>
                    <TableHead className="text-right text-white/25 text-[10px] uppercase tracking-widest">Inbound</TableHead>
                    <TableHead className="text-right text-white/25 text-[10px] uppercase tracking-widest">Outbound</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callsByOwner.map((c: any, i: number) => (
                    <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-white/80">{c.ownerName}</TableCell>
                      <TableCell className="text-right text-purple-400 font-semibold">{c.totalCalls}</TableCell>
                      <TableCell className="text-right text-blue-400">{c.inbound}</TableCell>
                      <TableCell className="text-right text-[#D4A853]">{c.outbound}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-white/30 py-8">No calls logged in this period</p>
          )}
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* CLIENTS (ACCOUNTS)                           */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setClientsExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {clientsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
              <Building2 className="h-3.5 w-3.5 text-[#D4A853]/60" />
              Clients
            </CardTitle>
            <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">
              {clients.length} Total
            </Badge>
            <ExportBtn onClick={(e) => { e.stopPropagation(); exportToExcel(clients.map((c: any) => ({ ...c, createdTime: c.createdTime ? new Date(c.createdTime).toLocaleDateString('en-US') : '' })), [{ key: 'accountName', label: 'Client Name' }, { key: 'industry', label: 'Industry' }, { key: 'phone', label: 'Phone' }, { key: 'website', label: 'Website' }, { key: 'owner', label: 'Owner' }, { key: 'createdTime', label: 'Created Date' }], 'Clients', 'Clients'); }} />
          </div>
        </CardHeader>
        {clientsExpanded && <CardContent>
          {clients.length > 0 ? (
            <>
            <SearchInput value={clientsSearch} onChange={setClientsSearch} placeholder="Search clients, industry, owner..." />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <SortHead col={{ key: 'accountName', label: 'Client Name', align: 'text-left' }} currentSort={clientsSort} setSort={setClientsSort} />
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Industry</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Phone</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Website</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Owner</TableHead>
                    <SortHead col={{ key: 'createdTime', label: 'Created Date' }} currentSort={clientsSort} setSort={setClientsSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...clients].filter((c: any) => matchesSearch(c, clientsSearch, ['accountName', 'industry', 'phone', 'website', 'owner'])).sort((a: any, b: any) => {
                    const k = clientsSort.key;
                    const dir = clientsSort.dir === 'asc' ? 1 : -1;
                    if (k === 'createdTime') return (new Date(a[k]).getTime() - new Date(b[k]).getTime()) * dir;
                    return String(a[k] || '').localeCompare(String(b[k] || '')) * dir;
                  }).map((c: any, i: number) => {
                    const dt = c.createdTime ? new Date(c.createdTime) : null;
                    const formatted = dt
                      ? dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                      : '—';
                    return (
                      <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-white/80">{c.accountName}</TableCell>
                        <TableCell className="text-white/50 text-xs">{c.industry || '—'}</TableCell>
                        <TableCell className="text-white/50 text-xs">{c.phone || '—'}</TableCell>
                        <TableCell className="text-white/50 text-xs">
                          {c.website ? (
                            <span className="text-blue-400/70 hover:text-blue-400 cursor-pointer">{c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-white/40 text-xs">{c.owner}</TableCell>
                        <TableCell className="text-right text-white/40 text-xs">{formatted}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <p className="text-center text-white/30 py-8">No client accounts found</p>
          )}
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* ZOHO SIGN DOCUMENTS                          */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setSignExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {signExpanded ? <ChevronUp className="h-3.5 w-3.5 text-indigo-400/60" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-400/60" />}
              <FileSignature className="h-3.5 w-3.5 text-indigo-400/60" />
              Zoho Sign Documents
            </CardTitle>
            <div className="flex items-center gap-3">
              {(() => {
                const counts: Record<string, number> = {};
                signDocuments.forEach((d: any) => { counts[d.status] = (counts[d.status] || 0) + 1; });
                return (
                  <span className="text-[10px] text-white/40 flex items-center gap-2">
                    {counts['completed'] && <span><span className="text-emerald-400 font-semibold">{counts['completed']}</span> completed</span>}
                    {counts['inprogress'] && <span><span className="text-blue-400 font-semibold">{counts['inprogress']}</span> pending</span>}
                    {counts['expired'] && <span><span className="text-amber-400 font-semibold">{counts['expired']}</span> expired</span>}
                  </span>
                );
              })()}
              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs">
                {signDocuments.length} Documents
              </Badge>
              <ExportBtn onClick={(e) => { e.stopPropagation(); const filtered = signFilter === 'all' ? signDocuments : signDocuments.filter((d: any) => d.status === signFilter); exportToExcel(filtered.map((d: any) => ({ ...d, recipients: d.recipients?.map((r: any) => `${r.name} (${r.status?.toLowerCase() || 'pending'})`).join(', ') || '', createdTime: d.createdTime ? new Date(d.createdTime).toLocaleDateString('en-US') : '' })), [{ key: 'documentName', label: 'Document' }, { key: 'status', label: 'Status' }, { key: 'recipients', label: 'Recipients' }, { key: 'owner', label: 'Owner' }, { key: 'createdTime', label: 'Created Date' }], 'Zoho_Sign_Documents', 'Documents'); }} />
            </div>
          </div>
        </CardHeader>
        {signExpanded && <CardContent>
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {['all', 'completed', 'inprogress', 'expired', 'recalled', 'declined'].map((f) => {
              const count = f === 'all' ? signDocuments.length : signDocuments.filter((d: any) => d.status === f).length;
              if (f !== 'all' && count === 0) return null;
              const label = f === 'all' ? 'All' : f === 'inprogress' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1);
              return (
                <button
                  key={f}
                  onClick={(e) => { e.stopPropagation(); setSignFilter(f); }}
                  className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${signFilter === f ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/[0.02] text-white/40 border-white/[0.06] hover:bg-white/[0.04]'}`}
                >
                  {label} <span className="font-semibold ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
          {signDocuments.length > 0 ? (
            <>
            <SearchInput value={signSearch} onChange={setSignSearch} placeholder="Search documents, recipients, owners..." />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <SortHead col={{ key: 'documentName', label: 'Document', align: 'text-left' }} currentSort={signSort} setSort={setSignSort} />
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Status</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Recipients</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Owner</TableHead>
                    <SortHead col={{ key: 'createdTime', label: 'Created' }} currentSort={signSort} setSort={setSignSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...signDocuments]
                    .filter((d: any) => (signFilter === 'all' || d.status === signFilter) && matchesSearch({ ...d, recipientNames: d.recipients?.map((r: any) => r.name).join(' ') || '' }, signSearch, ['documentName', 'owner', 'recipientNames']))
                    .sort((a: any, b: any) => {
                      const k = signSort.key;
                      const dir = signSort.dir === 'asc' ? 1 : -1;
                      if (k === 'createdTime') return (new Date(a[k]).getTime() - new Date(b[k]).getTime()) * dir;
                      return String(a[k] || '').localeCompare(String(b[k] || '')) * dir;
                    })
                    .map((doc: any, i: number) => {
                      const statusConfig: Record<string, { color: string; label: string }> = {
                        'completed': { color: '#10b981', label: 'Completed' },
                        'inprogress': { color: '#3b82f6', label: 'Pending' },
                        'expired': { color: '#f59e0b', label: 'Expired' },
                        'recalled': { color: '#6b7280', label: 'Recalled' },
                        'declined': { color: '#ef4444', label: 'Declined' },
                      };
                      const sc = statusConfig[doc.status] || { color: '#6b7280', label: doc.status };
                      const dt = doc.createdTime ? new Date(doc.createdTime) : null;
                      const formatted = dt
                        ? dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                        : '—';
                      return (
                        <TableRow key={i} className="border-white/[0.03] hover:bg-white/[0.02]">
                          <TableCell className="font-medium text-white/80 max-w-[300px] truncate">{doc.documentName}</TableCell>
                          <TableCell>
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap"
                              style={{ backgroundColor: `${sc.color}20`, color: sc.color }}>
                              {sc.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-white/50 text-xs max-w-[200px]">
                            {doc.recipients?.length > 0
                              ? doc.recipients.map((r: any, ri: number) => (
                                <span key={ri} className="block leading-relaxed">
                                  <span className="text-white/60">{r.name}</span>
                                  {r.status && (
                                    <span className={`ml-1 text-[9px] ${r.status === 'SIGNED' ? 'text-emerald-400' : r.status === 'VIEWED' ? 'text-blue-400' : 'text-white/30'}`}>
                                      ({r.status.toLowerCase()})
                                    </span>
                                  )}
                                </span>
                              ))
                              : '—'}
                          </TableCell>
                          <TableCell className="text-white/40 text-xs whitespace-nowrap">{doc.owner}</TableCell>
                          <TableCell className="text-right text-white/40 text-xs whitespace-nowrap">{formatted}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <p className="text-center text-white/30 py-8">No Zoho Sign documents found</p>
          )}
        </CardContent>}
      </Card>

    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/[0.04]" />)}
      </div>
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl bg-white/[0.04]" />)}
    </div>
  );
}
