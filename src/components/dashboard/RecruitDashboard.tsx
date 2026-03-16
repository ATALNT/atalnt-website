import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardCard } from './DashboardCard';
import { fetchRecruitJobs, fetchRecruitApplications } from '@/lib/dashboard-api';
import { Briefcase, Users, Send, Trophy, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = {
  inProgress: '#D4A853',
  filled: '#22c55e',
  onHold: '#f59e0b',
  inactive: '#6b7280',
  primary: '#D4A853',
  secondary: '#3b82f6',
  accent: '#8b5cf6',
};

const STATUS_COLORS: Record<string, string> = {
  'Applied': '#3b82f6',
  'Submitted-to-hiring-manager': '#D4A853',
  'Interview-Scheduled': '#8b5cf6',
  'Qualified': '#22c55e',
  'Hired': '#10b981',
  'Rejected': '#ef4444',
  'Rejected-by-ops': '#dc2626',
  'Archived': '#6b7280',
  'Associated': '#64748b',
};

interface RecruitDashboardProps {
  token: string;
  datePreset: string;
  dateRange: { from: string; to: string };
}

export function RecruitDashboard({ token, datePreset, dateRange }: RecruitDashboardProps) {
  const jobsQuery = useQuery({
    queryKey: ['recruit', 'jobs'],
    queryFn: () => fetchRecruitJobs(token),
    refetchInterval: 5 * 60 * 1000, // 5 min
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
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Failed to load Recruit data</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {jobsQuery.error?.message || appsQuery.error?.message || 'Check API connection'}
        </p>
      </div>
    );
  }

  const activeJobsByClient = (jobsData?.jobsByClient || []).filter((c: any) => c.inProgress > 0);

  return (
    <div className="space-y-6">
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DashboardCard
          title="Open Jobs"
          value={jobsData?.overview?.totalOpenJobs ?? 0}
          subtitle="In-Progress"
          icon={<Briefcase className="h-5 w-5" />}
          accent
        />
        <DashboardCard
          title="Applications"
          value={appsData?.overview?.totalApplications ?? 0}
          subtitle={datePreset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          icon={<Users className="h-5 w-5" />}
        />
        <DashboardCard
          title="Submissions"
          value={appsData?.overview?.submissionsThisWeek ?? appsData?.overview?.totalApplications ?? 0}
          subtitle={datePreset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          icon={<Send className="h-5 w-5" />}
        />
        <DashboardCard
          title="Interviews"
          value={(appsData?.recruiterPerformance || []).reduce((sum: number, r: any) => sum + r.interviews, 0)}
          subtitle={datePreset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          icon={<Send className="h-5 w-5" />}
        />
        <DashboardCard
          title="Hires"
          value={appsData?.overview?.hiresThisMonth ?? 0}
          subtitle={datePreset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          icon={<Trophy className="h-5 w-5" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by Client */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Active Jobs by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeJobsByClient.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activeJobsByClient} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                  <XAxis type="number" stroke="hsl(220 10% 55%)" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="clientName"
                    stroke="hsl(220 10% 55%)"
                    fontSize={11}
                    width={120}
                    tick={{ fill: 'hsl(45 20% 85%)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 10%)',
                      border: '1px solid hsl(220 15% 20%)',
                      borderRadius: '8px',
                      color: 'hsl(45 20% 95%)',
                    }}
                  />
                  <Bar dataKey="inProgress" name="In-Progress" fill={COLORS.inProgress} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No active jobs</p>
            )}
          </CardContent>
        </Card>

        {/* Pipeline by Status */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Application Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(appsData?.pipelineByStatus || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={appsData.pipelineByStatus.slice(0, 10)} margin={{ bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                  <XAxis
                    dataKey="status"
                    stroke="hsl(220 10% 55%)"
                    fontSize={10}
                    angle={-45}
                    textAnchor="end"
                    tick={{ fill: 'hsl(45 20% 85%)' }}
                  />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 10%)',
                      border: '1px solid hsl(220 15% 20%)',
                      borderRadius: '8px',
                      color: 'hsl(45 20% 95%)',
                    }}
                  />
                  <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                    {appsData.pipelineByStatus.slice(0, 10).map((entry: any, index: number) => (
                      <Cell key={index} fill={STATUS_COLORS[entry.status] || '#D4A853'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No application data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recruiter Performance & Zero Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recruiter Performance */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recruiter Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead className="text-muted-foreground">Recruiter</TableHead>
                  <TableHead className="text-muted-foreground text-right">Submissions</TableHead>
                  <TableHead className="text-muted-foreground text-right">Interviews</TableHead>
                  <TableHead className="text-muted-foreground text-right">Hires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(appsData?.recruiterPerformance || []).slice(0, 10).map((r: any) => (
                  <TableRow key={r.recruiterName} className="border-border/20">
                    <TableCell className="font-medium text-foreground">{r.recruiterName}</TableCell>
                    <TableCell className="text-right text-primary font-semibold">{r.submissions}</TableCell>
                    <TableCell className="text-right">{r.interviews}</TableCell>
                    <TableCell className="text-right">
                      {r.hires > 0 ? (
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">{r.hires}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Zero Submission Jobs */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Jobs With Zero Candidates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(jobsData?.zeroSubmissionJobs || []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead className="text-muted-foreground">Client</TableHead>
                    <TableHead className="text-muted-foreground">Job Title</TableHead>
                    <TableHead className="text-muted-foreground text-right">Days Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsData.zeroSubmissionJobs.slice(0, 10).map((job: any) => (
                    <TableRow key={job.jobId} className="border-border/20">
                      <TableCell className="font-medium text-foreground text-sm">{job.clientName}</TableCell>
                      <TableCell className="text-sm">{job.postingTitle}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={
                            job.daysOpen > 14
                              ? 'bg-red-500/20 text-red-400'
                              : job.daysOpen > 7
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
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
              <p className="text-center text-emerald-400 py-12">All active jobs have candidates</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
