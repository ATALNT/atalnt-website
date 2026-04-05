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
  AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Briefcase
} from 'lucide-react';

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
  const [pipelineSort, setPipelineSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'amount', dir: 'desc' });
  const [ownerSort, setOwnerSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalDeals', dir: 'desc' });

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

  const { overview, leadsBySource, leadsByStatus, dealsByStage, dealsByOwner, recentDeals, callsByOwner } = d;
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
                  {[...recentDeals].sort((a: any, b: any) => {
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
          </div>
        </CardHeader>
        {ownerExpanded && <CardContent>
          {dealsByOwner.length > 0 ? (
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
                  {[...dealsByOwner].sort((a: any, b: any) => {
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
