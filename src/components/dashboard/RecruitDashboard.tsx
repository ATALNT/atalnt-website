import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardCard } from './DashboardCard';
import { fetchRecruitJobs, fetchRecruitApplications } from '@/lib/dashboard-api';
import {
  Briefcase, Users, Send, Trophy, AlertTriangle, Clock, TrendingDown,
  ChevronDown, ChevronUp, ArrowRight, HelpCircle, Building2, UserCheck,
  Zap, AlertCircle, Info
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  'Associated': '#64748b',
  'Applied': '#3b82f6',
  'Submitted-to-hiring-manager': '#D4A853',
  'Interview-Scheduled': '#8b5cf6',
  'Qualified': '#22c55e',
  'Hired': '#10b981',
  'Rejected': '#ef4444',
  'Rejected-by-ops': '#dc2626',
  'Archived': '#6b7280',
};

const STAGE_LABELS: Record<string, string> = {
  'Associated': 'Associated',
  'Applied': 'Applied',
  'Submitted-to-hiring-manager': 'Submitted to Client',
  'Interview-Scheduled': 'Interview',
  'Qualified': 'Qualified',
  'Hired': 'Hired',
};

interface RecruitDashboardProps {
  token: string;
  datePreset: string;
  dateRange: { from: string; to: string };
}

export function RecruitDashboard({ token, datePreset, dateRange }: RecruitDashboardProps) {
  const [showHelp, setShowHelp] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ['recruit', 'jobs'],
    queryFn: () => fetchRecruitJobs(token),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const appsQuery = useQuery({
    queryKey: ['recruit', 'applications', datePreset],
    queryFn: () => fetchRecruitApplications(token, dateRange.from, dateRange.to),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const jobsData = jobsQuery.data?.data;
  const appsData = appsQuery.data?.data;

  if (jobsQuery.isLoading || appsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (jobsQuery.isError || appsQuery.isError) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400/60 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">Failed to load Recruit data</h3>
        <p className="text-sm text-white/30 mt-2">
          {jobsQuery.error?.message || appsQuery.error?.message || 'Check API connection'}
        </p>
      </div>
    );
  }

  const activeJobsByClient = (jobsData?.jobsByClient || []).filter((c: any) => c.inProgress > 0);
  const periodLabel = datePreset.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const overview = appsData?.overview || {};
  const funnel = appsData?.funnel || [];
  const velocity = appsData?.velocity || [];
  const staleCandidates = appsData?.staleCandidates || [];
  const recruiterPerf = appsData?.recruiterPerformance || [];
  const clientHealth = appsData?.clientHealth || [];
  const pipeline = appsData?.pipelineByStatus || [];

  return (
    <div className="space-y-6">
      {/* Help Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-[#D4A853]/80 transition-colors uppercase tracking-widest"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {showHelp ? 'Hide' : 'Data'} Sources & Definitions
          {showHelp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Help Section */}
      {showHelp && <HelpSection />}

      {/* ============================================ */}
      {/* KPI OVERVIEW ROW                             */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <DashboardCard
          title="Open Jobs"
          value={jobsData?.overview?.totalOpenJobs ?? 0}
          subtitle="In-Progress"
          icon={<Briefcase className="h-4 w-4" />}
          accent
        />
        <DashboardCard
          title="Candidates"
          value={overview.totalApplications ?? 0}
          subtitle={periodLabel}
          icon={<Users className="h-4 w-4" />}
        />
        <DashboardCard
          title="Submitted"
          value={overview.totalSubmittedToClient ?? 0}
          subtitle="To Clients"
          icon={<Send className="h-4 w-4" />}
        />
        <DashboardCard
          title="Interviews"
          value={overview.totalInterviews ?? 0}
          subtitle={periodLabel}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <DashboardCard
          title="Hires"
          value={overview.totalHires ?? 0}
          subtitle={periodLabel}
          icon={<Trophy className="h-4 w-4" />}
        />
        <DashboardCard
          title="Rejected"
          value={overview.totalRejected ?? 0}
          subtitle={periodLabel}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <DashboardCard
          title="Avg Days"
          value={overview.avgDaysInPipeline ?? 0}
          subtitle="In Pipeline"
          icon={<Clock className="h-4 w-4" />}
        />
        <DashboardCard
          title="Stale"
          value={overview.totalStale ?? 0}
          subtitle="7+ Days No Move"
          icon={<AlertCircle className="h-4 w-4" />}
          accent={overview.totalStale > 0}
        />
      </div>

      {/* ============================================ */}
      {/* CONVERSION FUNNEL                            */}
      {/* Shows the candidate journey and where they   */}
      {/* drop off — the #1 view for an agency owner   */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Candidate Journey — Conversion Funnel
            </CardTitle>
            <span className="text-[10px] text-white/20">{periodLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          {funnel.length > 0 ? (
            <div className="space-y-1">
              {funnel.map((stage: any, index: number) => {
                const maxCount = Math.max(...funnel.map((s: any) => s.count));
                const barWidth = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 3) : 3;
                const color = STATUS_COLORS[stage.stage] || '#D4A853';
                const label = STAGE_LABELS[stage.stage] || stage.stage;
                const isDropoff = index > 0 && stage.conversionFromPrev < 50;

                return (
                  <div key={stage.stage}>
                    {/* Conversion arrow between stages */}
                    {index > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-4">
                        <ArrowRight className="h-3 w-3 text-white/10" />
                        <span className={`text-[10px] font-semibold ${isDropoff ? 'text-red-400' : stage.conversionFromPrev >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {stage.conversionFromPrev}% conversion
                        </span>
                        {stage.dropoff > 0 && (
                          <span className="text-[10px] text-red-400/60">
                            ({stage.dropoff} lost)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors font-medium">
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/25">
                            {stage.percentOfTotal}% of total
                          </span>
                          <span className="text-sm font-bold text-white/90 min-w-[32px] text-right">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden ml-[18px]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${barWidth}%`, backgroundColor: color, opacity: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-white/20 py-8">No funnel data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* BOTTLENECK DETECTION & PIPELINE STATUS       */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Velocity — Where candidates get stuck */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-400/60" />
              Bottleneck Detection — Stage Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {velocity.length > 0 ? (
              <div className="space-y-4">
                {velocity.map((stage: any) => {
                  const label = STAGE_LABELS[stage.stage] || stage.stage;
                  const isBottleneck = stage.isBottleneck;
                  const urgencyColor = stage.avgDaysInStage > 14 ? 'text-red-400' : stage.avgDaysInStage > 7 ? 'text-amber-400' : 'text-emerald-400';
                  const bgColor = stage.avgDaysInStage > 14 ? 'bg-red-500/5 border-red-500/10' : stage.avgDaysInStage > 7 ? 'bg-amber-500/5 border-amber-500/10' : 'bg-white/[0.02] border-white/[0.04]';

                  return (
                    <div key={stage.stage} className={`rounded-lg border p-3 ${bgColor} transition-all`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/80">{label}</span>
                          {isBottleneck && (
                            <Badge variant="secondary" className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] px-1.5 py-0">
                              BOTTLENECK
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-white/40">{stage.activeCandidates} active</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className={`text-2xl font-bold ${urgencyColor}`}>{stage.avgDaysInStage}</span>
                          <span className="text-[10px] text-white/30 ml-1">avg days</span>
                        </div>
                        {stage.staleCandidates > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-400/60" />
                            <span className="text-xs text-amber-400">{stage.staleCandidates} stale (7+ days)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-emerald-400/60 py-8">No active candidates in pipeline</p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Status Distribution */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Application Pipeline — All Statuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.length > 0 ? (
              <div className="space-y-3">
                {pipeline.slice(0, 10).map((entry: any) => {
                  const maxCount = Math.max(...pipeline.map((e: any) => e.count));
                  const barWidth = Math.max((entry.count / maxCount) * 100, 4);
                  const color = STATUS_COLORS[entry.status] || '#D4A853';
                  const label = STAGE_LABELS[entry.status] || entry.status.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                  return (
                    <div key={entry.status} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                            {label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-white/90 min-w-[32px] text-right">
                          {entry.count}
                        </span>
                      </div>
                      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden ml-[18px]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-white/20 py-8">No application data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* RECRUITER SCORECARD                          */}
      {/* The most important view for managing your team */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Recruiter Scorecard
            </CardTitle>
            <span className="text-[10px] text-white/20">{periodLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.04] hover:bg-transparent">
                  <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Recruiter</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Total</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Submitted</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Interviews</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Hires</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Active</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Sub→Int %</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Int→Hire %</TableHead>
                  <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Overall %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recruiterPerf.slice(0, 15).map((r: any) => (
                  <TableRow key={r.recruiterName} className="border-white/[0.03] hover:bg-white/[0.02]">
                    <TableCell className="font-medium text-white/80">{r.recruiterName}</TableCell>
                    <TableCell className="text-right text-white/50">{r.submissions}</TableCell>
                    <TableCell className="text-right text-[#D4A853] font-semibold">{r.submittedToClient}</TableCell>
                    <TableCell className="text-right text-purple-400">{r.interviews}</TableCell>
                    <TableCell className="text-right">
                      {r.hires > 0 ? (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{r.hires}</Badge>
                      ) : (
                        <span className="text-white/20">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-white/40">{r.activePipeline}</TableCell>
                    <TableCell className="text-right">
                      <RateCell value={r.submitToInterviewRate} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell value={r.interviewToHireRate} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell value={r.overallPlacementRate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* CLIENT HEALTH & ACTIVE JOBS                  */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Health */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-blue-400/60" />
              Client Health — Candidate Acceptance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientHealth.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.04] hover:bg-transparent">
                      <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Client</TableHead>
                      <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Cands</TableHead>
                      <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Int</TableHead>
                      <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Hires</TableHead>
                      <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Rej %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientHealth.slice(0, 10).map((c: any) => (
                      <TableRow key={c.clientName} className="border-white/[0.03] hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-white/80 text-sm">{c.clientName}</TableCell>
                        <TableCell className="text-right text-white/50">{c.totalCandidates}</TableCell>
                        <TableCell className="text-right text-purple-400">{c.interviews}</TableCell>
                        <TableCell className="text-right">
                          {c.hires > 0 ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{c.hires}</Badge>
                          ) : (
                            <span className="text-white/20">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold ${c.rejectionRate > 50 ? 'text-red-400' : c.rejectionRate > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {c.rejectionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-white/20 py-8">No client data</p>
            )}
          </CardContent>
        </Card>

        {/* Active Jobs by Client */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Active Jobs by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeJobsByClient.length > 0 ? (
              <div className="space-y-3">
                {activeJobsByClient.slice(0, 12).map((client: any) => {
                  const maxJobs = Math.max(...activeJobsByClient.map((c: any) => c.inProgress));
                  const barWidth = Math.max((client.inProgress / maxJobs) * 100, 8);
                  return (
                    <div key={client.clientName} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white/70 truncate max-w-[200px] group-hover:text-white/90 transition-colors">
                          {client.clientName}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/30">
                            {client.total} total
                          </span>
                          <span className="text-sm font-bold text-[#D4A853] min-w-[24px] text-right">
                            {client.inProgress}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#D4A853] to-[#b8912e] rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-white/20 py-8">No active jobs</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* STALE CANDIDATES & ZERO-CANDIDATE JOBS       */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stale Candidates — needs immediate attention */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400/60" />
              Stale Candidates — No Movement 7+ Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleCandidates.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.04] hover:bg-transparent">
                      <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Candidate</TableHead>
                      <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Status</TableHead>
                      <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Recruiter</TableHead>
                      <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staleCandidates.slice(0, 15).map((c: any, i: number) => {
                      const statusLabel = STAGE_LABELS[c.status] || c.status;
                      return (
                        <TableRow key={`${c.candidateName}-${i}`} className="border-white/[0.03] hover:bg-white/[0.02]">
                          <TableCell className="font-medium text-white/80 text-sm">{c.candidateName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]" style={{
                              backgroundColor: `${STATUS_COLORS[c.status] || '#D4A853'}15`,
                              color: STATUS_COLORS[c.status] || '#D4A853',
                              borderColor: `${STATUS_COLORS[c.status] || '#D4A853'}30`,
                              borderWidth: 1,
                            }}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white/50 text-sm">{c.recruiter}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="secondary"
                              className={
                                c.daysSinceUpdate > 14
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }
                            >
                              {c.daysSinceUpdate}d
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-emerald-400/60 py-8">No stale candidates — pipeline is healthy</p>
            )}
          </CardContent>
        </Card>

        {/* Zero Submission Jobs */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60" />
              Jobs With Zero Candidates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(jobsData?.zeroSubmissionJobs || []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Client</TableHead>
                    <TableHead className="text-white/25 text-[10px] uppercase tracking-widest">Job Title</TableHead>
                    <TableHead className="text-white/25 text-right text-[10px] uppercase tracking-widest">Days Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsData.zeroSubmissionJobs.slice(0, 10).map((job: any) => (
                    <TableRow key={job.jobId} className="border-white/[0.03] hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-white/80 text-sm">{job.clientName}</TableCell>
                      <TableCell className="text-white/50 text-sm">{job.postingTitle}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={
                            job.daysOpen > 14
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : job.daysOpen > 7
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }
                        >
                          {job.daysOpen}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-emerald-400/60 py-8">All active jobs have candidates</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function RateCell({ value }: { value: number }) {
  const color = value >= 50 ? 'text-emerald-400' : value >= 25 ? 'text-amber-400' : value > 0 ? 'text-red-400' : 'text-white/15';
  return <span className={`text-sm font-semibold ${color}`}>{value > 0 ? `${value}%` : '—'}</span>;
}

function HelpSection() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-blue-400/60" />
          Data Sources & Definitions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-4">
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Where does this data come from?</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                All recruiting data is pulled live from <span className="text-[#D4A853]">Zoho Recruit</span> via their REST API.
                Job openings come from the <span className="text-white/50">Job_Openings</span> module,
                and candidate/application data comes from the <span className="text-white/50">Applications</span> module.
                Data refreshes automatically every 5 minutes.
              </p>
            </div>
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Candidate Journey (Funnel)</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                <span className="text-white/50">Associated</span> — Candidate linked to a job opening<br />
                <span className="text-white/50">Applied</span> — Candidate formally applied or was sourced<br />
                <span className="text-white/50">Submitted to Client</span> — Recruiter sent profile to hiring manager<br />
                <span className="text-white/50">Interview</span> — Client scheduled an interview<br />
                <span className="text-white/50">Qualified</span> — Passed interview, being considered<br />
                <span className="text-white/50">Hired</span> — Offer accepted, placement made
              </p>
            </div>
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Conversion Rates</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                Conversion percentages show how many candidates progress from one stage to the next.
                A candidate who reaches "Interview" is counted as having passed through all prior stages.
                <span className="text-red-400"> Red (&lt;50%)</span> = major drop-off,
                <span className="text-amber-400"> Amber (50-70%)</span> = watch,
                <span className="text-emerald-400"> Green (&gt;70%)</span> = healthy.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Bottleneck Detection</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                Shows the average number of days candidates sit in each active stage.
                Calculated from each application's <span className="text-white/50">Modified Time</span> (last status change) vs. today.
                Stages where avg days exceed 7 are flagged as bottlenecks. "Stale" means 7+ days with no movement.
              </p>
            </div>
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Recruiter Scorecard</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                <span className="text-white/50">Sub→Int %</span> — Of candidates submitted to clients, what % got interviews? Measures submission quality.<br />
                <span className="text-white/50">Int→Hire %</span> — Of candidates interviewed, what % were hired? Measures closing ability.<br />
                <span className="text-white/50">Overall %</span> — Total hires / total candidates. End-to-end placement rate.
              </p>
            </div>
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Client Health</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                <span className="text-white/50">Rejection Rate</span> — Percentage of candidates rejected by this client.
                High rejection rates (&gt;50%) may indicate misalignment on job requirements or candidate quality.
                This helps identify which clients need a requirements review call.
              </p>
            </div>
            <div>
              <h4 className="text-white/60 font-semibold mb-1">Data Accuracy</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                Metrics are only as accurate as the data in Zoho Recruit. If a recruiter doesn't update a candidate's status,
                that candidate will appear "stale" even if there's been activity. Keeping statuses current in Zoho is critical
                for accurate reporting.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-3 w-16 bg-white/[0.06]" />
              <Skeleton className="h-8 w-12 bg-white/[0.06]" />
              <Skeleton className="h-3 w-20 bg-white/[0.06]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full bg-white/[0.06]" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-6">
              <Skeleton className="h-[250px] w-full bg-white/[0.06]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
