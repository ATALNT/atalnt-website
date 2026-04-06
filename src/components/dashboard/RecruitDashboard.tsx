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
  Zap, AlertCircle, Info, FileText, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

// Colors for funnel stages (from API)
const FUNNEL_COLORS: Record<string, string> = {
  'Entered Pipeline': '#64748b',
  'Submitted to Client': '#D4A853',
  'Interviewed': '#8b5cf6',
  'Qualified': '#22c55e',
  'Offer': '#f59e0b',
  'Hired': '#10b981',
};

// Colors for raw Zoho statuses (pipeline view)
const STATUS_COLORS: Record<string, string> = {
  'Associated': '#64748b',
  'Applied': '#3b82f6',
  'Submitted-to-hiring manager': '#D4A853',
  'Interview-Scheduled': '#8b5cf6',
  '2nd Interview-Scheduled': '#7c3aed',
  '3rd Interview-Scheduled': '#6d28d9',
  'Qualified': '#22c55e',
  'Offer made': '#f59e0b',
  'Offer accepted': '#eab308',
  'Offer declined': '#f97316',
  'Hired': '#10b981',
  'Rejected': '#ef4444',
  'Rejected by ops': '#dc2626',
  'Rejected by hiring manager': '#e11d48',
  'Interviewed - Rejected': '#be123c',
  'Rejected by partner': '#9f1239',
  'Unqualified': '#6b7280',
  'Withdrawn': '#a855f7',
  'Archived': '#4b5563',
};

// Rejection category colors
const REJECTION_COLORS: Record<string, string> = {
  'Screening': '#dc2626',
  'Client Rejected': '#e11d48',
  'Post-Interview': '#be123c',
  'Partner Rejected': '#9f1239',
  'Offer Declined': '#f97316',
  'Candidate Withdrew': '#a855f7',
  'General': '#6b7280',
};

interface RecruitDashboardProps {
  token: string;
  datePreset: string;
  dateRange: { from: string; to: string };
}

export function RecruitDashboard({ token, datePreset, dateRange }: RecruitDashboardProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [interviewSort, setInterviewSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'stageOrder', dir: 'desc' });
  const [openJobsSort, setOpenJobsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'priorityTier', dir: 'asc' });
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [openJobsExpanded, setOpenJobsExpanded] = useState(true);
  const [interviewExpanded, setInterviewExpanded] = useState(true);
  const [formSubmissionsExpanded, setFormSubmissionsExpanded] = useState(true);
  const [formSubmissionsSort, setFormSubmissionsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalFormSubmissions', dir: 'desc' });
  const [expandedFormRecruiters, setExpandedFormRecruiters] = useState<Set<string>>(new Set());

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
  const rejectionBreakdown = appsData?.rejectionBreakdown || [];
  const submissionsByRecruiter = appsData?.submissionsByRecruiter || [];
  const interviewPipeline = appsData?.interviewPipeline || [];
  const interviewStageCounts = appsData?.interviewStageCounts || [];
  const openJobsReport = appsData?.openJobsReport || [];
  const recruiterFormSubmissions = appsData?.recruiterFormSubmissions || [];

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
      {/* PRIMARY REPORT — Submissions by Recruiter    */}
      {/* The first thing an agency owner wants to see */}
      {/* ============================================ */}

      {/* ============================================ */}
      {/* KPI OVERVIEW ROW                             */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
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
          title="Offers"
          value={overview.totalOffers ?? 0}
          subtitle={periodLabel}
          icon={<Zap className="h-4 w-4" />}
        />
        <DashboardCard
          title="Hires"
          value={overview.totalHires ?? 0}
          subtitle={periodLabel}
          icon={<Trophy className="h-4 w-4" />}
          accent
        />
        <DashboardCard
          title="Rejected"
          value={overview.totalRejected ?? 0}
          subtitle={periodLabel}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <DashboardCard
          title="Withdrawn"
          value={overview.totalWithdrawn ?? 0}
          subtitle={periodLabel}
          icon={<AlertTriangle className="h-4 w-4" />}
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
      {/* OPEN JOBS REPORT                              */}
      {/* All open jobs with tier, submissions, candidates */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setOpenJobsExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {openJobsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
              <Briefcase className="h-3.5 w-3.5 text-[#D4A853]/60" />
              Open Jobs
            </CardTitle>
            <div className="flex items-center gap-3">
              {['Tier 1', 'Tier 2', 'Tier 3'].map((tier) => {
                const count = openJobsReport.filter((j: any) => j.priorityTier === tier).length;
                return count > 0 ? (
                  <span key={tier} className="text-[10px] text-white/40">
                    {tier}: <span className={tier === 'Tier 1' ? 'text-red-400 font-semibold' : tier === 'Tier 2' ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>{count}</span>
                  </span>
                ) : null;
              })}
              <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">
                {openJobsReport.length} Total
              </Badge>
            </div>
          </div>
        </CardHeader>
        {openJobsExpanded && <CardContent>
          {openJobsReport.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    {[
                      { key: 'jobTitle', label: 'Job Title', align: '' },
                      { key: 'clientName', label: 'Client', align: '' },
                      { key: 'priorityTier', label: 'Priority', align: '' },
                      { key: 'totalSubmissions', label: 'Submissions', align: 'text-right' },
                      { key: 'interviewCount', label: 'Interviews', align: 'text-right' },
                      { key: 'daysOpen', label: 'Days Open', align: 'text-right' },
                      { key: 'requiredSkills', label: 'Required Skills', align: '' },
                      { key: 'assignedRecruiter', label: 'Recruiter', align: '' },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className={`text-white/25 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50 select-none transition-colors ${col.align}`}
                        onClick={() => setOpenJobsSort((prev) => ({
                          key: col.key,
                          dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc',
                        }))}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {openJobsSort.key === col.key ? (
                            openJobsSort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-[#D4A853]" /> : <ArrowDown className="h-3 w-3 text-[#D4A853]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...openJobsReport].sort((a: any, b: any) => {
                    const k = openJobsSort.key;
                    const dir = openJobsSort.dir === 'asc' ? 1 : -1;
                    if (k === 'daysOpen' || k === 'totalSubmissions' || k === 'interviewCount') return (a[k] - b[k]) * dir;
                    if (k === 'priorityTier') {
                      const tierOrder = (t: string) => t === 'Tier 1' ? 1 : t === 'Tier 2' ? 2 : t === 'Tier 3' ? 3 : 4;
                      return (tierOrder(a[k]) - tierOrder(b[k])) * dir;
                    }
                    return String(a[k] || '').localeCompare(String(b[k] || '')) * dir;
                  }).map((job: any, i: number) => {
                    const isExpanded = expandedJobs.has(job.jobTitle);
                    const tierColor = job.priorityTier === 'Tier 1' ? { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' }
                      : job.priorityTier === 'Tier 2' ? { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' }
                      : { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
                    return (
                      <>
                        <TableRow
                          key={`job-${i}`}
                          className="border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => setExpandedJobs((prev) => {
                            const next = new Set(prev);
                            if (next.has(job.jobTitle)) next.delete(job.jobTitle);
                            else next.add(job.jobTitle);
                            return next;
                          })}
                        >
                          <TableCell className="font-medium text-white/80">
                            <span className="inline-flex items-center gap-1.5">
                              {isExpanded ? <ChevronUp className="h-3 w-3 text-[#D4A853]/60" /> : <ChevronDown className="h-3 w-3 text-white/30" />}
                              {job.jobTitle}
                            </span>
                          </TableCell>
                          <TableCell className="text-white/50 text-sm">{job.clientName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${tierColor.bg} ${tierColor.text} border ${tierColor.border}`}>
                              {job.priorityTier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className={job.totalSubmissions > 0
                              ? 'bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20'
                              : 'bg-white/5 text-white/30 border border-white/10'
                            }>
                              {job.totalSubmissions}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className={job.interviewCount > 0
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-white/5 text-white/30 border border-white/10'
                            }>
                              {job.interviewCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-white/50 text-sm">{job.daysOpen}d</TableCell>
                          <TableCell className="text-white/40 text-xs max-w-[200px] truncate" title={job.requiredSkills}>{job.requiredSkills || '—'}</TableCell>
                          <TableCell className="text-white/50 text-sm">{job.assignedRecruiter}</TableCell>
                        </TableRow>
                        {isExpanded && job.submittedCandidates.length > 0 && (
                          <TableRow key={`job-${i}-expanded`} className="border-white/[0.03] bg-white/[0.01]">
                            <TableCell colSpan={8} className="p-0">
                              <div className="border-l-2 border-[#D4A853]/20 ml-4 pl-4 py-2">
                                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Submitted Candidates ({job.submittedCandidates.length})</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-white/[0.04] hover:bg-transparent">
                                      <TableHead className="text-white/20 text-[9px] uppercase tracking-widest">Candidate</TableHead>
                                      <TableHead className="text-white/20 text-[9px] uppercase tracking-widest">Status</TableHead>
                                      <TableHead className="text-white/20 text-[9px] uppercase tracking-widest">Recruiter</TableHead>
                                      <TableHead className="text-white/20 text-[9px] uppercase tracking-widest">Submitted</TableHead>
                                      <TableHead className="text-white/20 text-right text-[9px] uppercase tracking-widest">Days in Stage</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {job.submittedCandidates.map((c: any, ci: number) => (
                                      <TableRow key={ci} className="border-white/[0.02] hover:bg-white/[0.01]">
                                        <TableCell className="text-white/70 text-sm">{c.candidateName}</TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                            {c.currentStatus}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-white/50 text-sm">{c.recruiter}</TableCell>
                                        <TableCell className="text-white/40 text-sm">{c.submittedDate}</TableCell>
                                        <TableCell className="text-right">
                                          <Badge variant="secondary" className={
                                            c.daysInCurrentStage > 7 ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            : c.daysInCurrentStage > 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          }>
                                            {c.daysInCurrentStage}d
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {isExpanded && job.submittedCandidates.length === 0 && (
                          <TableRow key={`job-${i}-empty`} className="border-white/[0.03] bg-white/[0.01]">
                            <TableCell colSpan={8}>
                              <div className="border-l-2 border-[#D4A853]/20 ml-4 pl-4 py-3">
                                <p className="text-white/30 text-sm">No submissions yet for this job</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-white/30 py-8">No open jobs found</p>
          )}
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* INTERVIEW PIPELINE                           */}
      {/* Active candidates in interview stages        */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setInterviewExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {interviewExpanded ? <ChevronUp className="h-3.5 w-3.5 text-purple-400/60" /> : <ChevronDown className="h-3.5 w-3.5 text-purple-400/60" />}
              <Users className="h-3.5 w-3.5 text-purple-400/60" />
              Interview Pipeline
            </CardTitle>
            <div className="flex items-center gap-3">
              {interviewStageCounts.map((s: any) => (
                <span key={s.stage} className="text-[10px] text-white/40">
                  {s.stage}: <span className="text-purple-400 font-semibold">{s.count}</span>
                </span>
              ))}
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs">
                {interviewPipeline.length} Total
              </Badge>
            </div>
          </div>
        </CardHeader>
        {interviewExpanded && <CardContent>
          {interviewPipeline.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    {[
                      { key: 'candidateName', label: 'Candidate', align: '' },
                      { key: 'interviewStage', label: 'Stage', align: '' },
                      { key: 'jobTitle', label: 'Job Opening', align: '' },
                      { key: 'clientName', label: 'Client', align: '' },
                      { key: 'recruiter', label: 'Ops', align: '' },
                      { key: 'candidateRecruiter', label: 'Recruiter', align: '' },
                      { key: 'daysInStage', label: 'Days in Stage', align: 'text-right' },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className={`text-white/25 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50 select-none transition-colors ${col.align}`}
                        onClick={() => setInterviewSort((prev) => ({
                          key: col.key,
                          dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc',
                        }))}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {interviewSort.key === col.key ? (
                            interviewSort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-purple-400" /> : <ArrowDown className="h-3 w-3 text-purple-400" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...interviewPipeline].sort((a: any, b: any) => {
                    const k = interviewSort.key;
                    const dir = interviewSort.dir === 'asc' ? 1 : -1;
                    if (k === 'daysInStage' || k === 'stageOrder') return (a[k] - b[k]) * dir;
                    return String(a[k] || '').localeCompare(String(b[k] || '')) * dir;
                  }).slice(0, 25).map((item: any, i: number) => {
                    const stageColor = item.interviewStage === '3rd Interview' ? '#6d28d9'
                      : item.interviewStage === '2nd Interview' ? '#7c3aed'
                      : '#8b5cf6';
                    return (
                      <TableRow key={`${item.candidateName}-${i}`} className="border-white/[0.03] hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-white/80">{item.candidateName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]" style={{
                            backgroundColor: `${stageColor}15`,
                            color: stageColor,
                            borderColor: `${stageColor}30`,
                            borderWidth: 1,
                          }}>
                            {item.interviewStage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/50 text-sm max-w-[200px] truncate">{item.jobTitle}</TableCell>
                        <TableCell className="text-white/50 text-sm">{item.clientName}</TableCell>
                        <TableCell className="text-white/50 text-sm">{item.recruiter}</TableCell>
                        <TableCell className="text-white/50 text-sm">{item.candidateRecruiter || 'Unassigned'}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={
                              item.daysInStage > 7
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : item.daysInStage > 3
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }
                          >
                            {item.daysInStage}d
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-white/30 py-8">No candidates currently in interview stages</p>
          )}
        </CardContent>}
      </Card>

      {/* ============================================ */}
      {/* RECRUITER FORM SUBMISSIONS                   */}
      {/* Per-recruiter form submissions & progression */}
      {/* ============================================ */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/30 to-transparent" />
        <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setFormSubmissionsExpanded((v) => !v)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
              {formSubmissionsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[#D4A853]/60" /> : <ChevronDown className="h-3.5 w-3.5 text-[#D4A853]/60" />}
              <FileText className="h-3.5 w-3.5 text-[#D4A853]/60" />
              Recruiter Form Submissions
            </CardTitle>
            <div className="flex items-center gap-3">
              {recruiterFormSubmissions.length > 0 && (
                <>
                  <span className="text-[10px] text-white/40">
                    Total: <span className="text-[#D4A853] font-semibold">{recruiterFormSubmissions.reduce((sum: number, r: any) => sum + r.totalFormSubmissions, 0)}</span>
                  </span>
                  <span className="text-[10px] text-white/40">
                    Hires: <span className="text-emerald-400 font-semibold">{recruiterFormSubmissions.reduce((sum: number, r: any) => sum + r.hires, 0)}</span>
                  </span>
                </>
              )}
              <Badge variant="secondary" className="bg-[#D4A853]/10 text-[#D4A853] border border-[#D4A853]/20 text-xs">
                {recruiterFormSubmissions.length} Recruiters
              </Badge>
            </div>
          </div>
        </CardHeader>
        {formSubmissionsExpanded && <CardContent>
          {recruiterFormSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.04] hover:bg-transparent">
                    {[
                      { key: 'recruiterName', label: 'Recruiter', align: '' },
                      { key: 'totalFormSubmissions', label: 'Form Submissions', align: 'text-right' },
                      { key: 'submittedToClient', label: 'Submitted to Client', align: 'text-right' },
                      { key: 'inInterview', label: 'In Interview', align: 'text-right' },
                      { key: 'offers', label: 'Offers', align: 'text-right' },
                      { key: 'hires', label: 'Hires', align: 'text-right' },
                      { key: 'rejected', label: 'Rejected', align: 'text-right' },
                      { key: 'active', label: 'Active', align: 'text-right' },
                      { key: 'clientSubmissionRate', label: 'Submission %', align: 'text-right' },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className={`text-white/25 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/50 select-none transition-colors ${col.align}`}
                        onClick={() => setFormSubmissionsSort((prev) => ({
                          key: col.key,
                          dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc',
                        }))}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {formSubmissionsSort.key === col.key ? (
                            formSubmissionsSort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-[#D4A853]" /> : <ArrowDown className="h-3 w-3 text-[#D4A853]" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...recruiterFormSubmissions].sort((a: any, b: any) => {
                    const k = formSubmissionsSort.key;
                    const dir = formSubmissionsSort.dir === 'asc' ? 1 : -1;
                    if (k === 'recruiterName') return String(a[k] || '').localeCompare(String(b[k] || '')) * dir;
                    return ((a[k] || 0) - (b[k] || 0)) * dir;
                  }).map((r: any) => {
                    const isExpanded = expandedFormRecruiters.has(r.recruiterName);
                    return (
                      <>
                        <TableRow
                          key={r.recruiterName}
                          className="border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => setExpandedFormRecruiters((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.recruiterName)) next.delete(r.recruiterName); else next.add(r.recruiterName);
                            return next;
                          })}
                        >
                          <TableCell className="font-medium text-white/80 flex items-center gap-1.5">
                            {isExpanded ? <ChevronUp className="h-3 w-3 text-white/30" /> : <ChevronDown className="h-3 w-3 text-white/30" />}
                            {r.recruiterName}
                          </TableCell>
                          <TableCell className="text-right text-[#D4A853] font-semibold">{r.totalFormSubmissions}</TableCell>
                          <TableCell className="text-right text-blue-400 font-semibold">{r.submittedToClient}</TableCell>
                          <TableCell className="text-right">
                            {r.inInterview > 0 ? <span className="text-purple-400 font-semibold">{r.inInterview}</span> : <span className="text-white/20">0</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.offers > 0 ? <span className="text-amber-400 font-semibold">{r.offers}</span> : <span className="text-white/20">0</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.hires > 0 ? (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{r.hires}</Badge>
                            ) : <span className="text-white/20">0</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.rejected > 0 ? <span className="text-red-400">{r.rejected}</span> : <span className="text-white/20">0</span>}
                          </TableCell>
                          <TableCell className="text-right text-white/40">{r.active}</TableCell>
                          <TableCell className="text-right"><RateCell value={r.clientSubmissionRate} /></TableCell>
                        </TableRow>
                        {isExpanded && r.candidates.map((c: any, ci: number) => (
                          <TableRow key={`${r.recruiterName}-${ci}`} className="border-white/[0.02] bg-white/[0.01]">
                            <TableCell className="pl-8 text-white/50 text-xs">{c.candidateName}</TableCell>
                            <TableCell className="text-right text-white/30 text-xs" colSpan={2}>{c.jobTitle}</TableCell>
                            <TableCell className="text-right text-white/30 text-xs" colSpan={2}>{c.clientName || '—'}</TableCell>
                            <TableCell className="text-right" colSpan={2}>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${STATUS_COLORS[c.currentStatus] || '#6b7280'}20`, color: STATUS_COLORS[c.currentStatus] || '#6b7280' }}>
                                {c.currentStatus}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-white/30 text-xs">{c.daysInStage}d</TableCell>
                            <TableCell className="text-right text-white/30 text-xs">{c.createdDate}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-white/30 py-8">No form submission data available</p>
          )}
        </CardContent>}
      </Card>


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
                <span className="text-white/50">Entered Pipeline</span> — Candidate associated or applied to a job<br />
                <span className="text-white/50">Submitted to Client</span> — Recruiter sent profile to hiring manager<br />
                <span className="text-white/50">Interviewed</span> — Client scheduled 1st, 2nd, or 3rd interview<br />
                <span className="text-white/50">Qualified</span> — Passed interviews, being considered<br />
                <span className="text-white/50">Offer</span> — Offer made, accepted, or declined<br />
                <span className="text-white/50">Hired</span> — Offer accepted, placement complete
              </p>
              <p className="text-white/20 text-[10px] leading-relaxed mt-1">
                Each candidate is counted at their <em>highest reached stage</em>. A candidate rejected after interview
                still counts as having reached the Interview stage. This gives an accurate picture of pipeline throughput.
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
              <h4 className="text-white/60 font-semibold mb-1">Rejection Breakdown</h4>
              <p className="text-white/30 text-xs leading-relaxed">
                <span className="text-white/50">Screening</span> — Rejected by ops or marked unqualified before submission<br />
                <span className="text-white/50">Client Rejected</span> — Hiring manager rejected the submitted profile<br />
                <span className="text-white/50">Post-Interview</span> — Rejected after the interview stage<br />
                <span className="text-white/50">Partner Rejected</span> — Rejected by a client partner<br />
                <span className="text-white/50">Offer Declined</span> — Candidate declined the offer<br />
                <span className="text-white/50">Candidate Withdrew</span> — Candidate voluntarily withdrew<br />
                <span className="text-white/50">General</span> — Generic rejection, stage unknown
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
