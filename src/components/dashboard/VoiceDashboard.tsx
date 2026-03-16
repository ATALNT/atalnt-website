import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardCard } from './DashboardCard';
import { fetchVoiceCalls } from '@/lib/dashboard-api';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Activity, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from 'recharts';

const COLORS = {
  inbound: '#22c55e',
  outbound: '#3b82f6',
  missed: '#ef4444',
  gold: '#D4A853',
};

interface VoiceDashboardProps {
  token: string;
  datePreset: string;
}

export function VoiceDashboard({ token, datePreset }: VoiceDashboardProps) {
  const callsQuery = useQuery({
    queryKey: ['voice', 'calls', datePreset],
    queryFn: () => fetchVoiceCalls(token, datePreset),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const data = callsQuery.data?.data;

  if (callsQuery.isLoading) {
    return <VoiceSkeleton />;
  }

  if (callsQuery.isError) {
    return (
      <div className="p-12 text-center">
        <Phone className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Phone & Texts Coming Soon</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Zoho Voice integration is being configured. Call logs, SMS data, and agent performance metrics will appear here once connected.
        </p>
      </div>
    );
  }

  const overview = data?.overview || {};
  const callsByPerson = data?.callsByPerson || [];
  const dailyVolume = data?.dailyVolume || [];
  const hourlyLoad = data?.hourlyLoad || [];

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <DashboardCard
          title="Total Calls"
          value={overview.totalCalls ?? 0}
          icon={<Phone className="h-5 w-5" />}
          accent
        />
        <DashboardCard
          title="Inbound"
          value={overview.inboundCalls ?? 0}
          icon={<PhoneIncoming className="h-5 w-5" />}
        />
        <DashboardCard
          title="Outbound"
          value={overview.outboundCalls ?? 0}
          icon={<PhoneOutgoing className="h-5 w-5" />}
        />
        <DashboardCard
          title="Missed"
          value={overview.missedCalls ?? 0}
          icon={<PhoneMissed className="h-5 w-5" />}
        />
        <DashboardCard
          title="Total Duration"
          value={formatDuration(overview.totalDuration ?? 0)}
          icon={<Clock className="h-5 w-5" />}
        />
        <DashboardCard
          title="Avg Duration"
          value={`${overview.avgCallDuration ?? 0}s`}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Calls by Person - Main Chart */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Calls by Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callsByPerson.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={callsByPerson} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis
                  dataKey="agentName"
                  stroke="hsl(220 10% 55%)"
                  fontSize={12}
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
                <Legend />
                <Bar dataKey="outbound" name="Outbound" fill={COLORS.outbound} stackId="calls" radius={[0, 0, 0, 0]} />
                <Bar dataKey="inbound" name="Inbound" fill={COLORS.inbound} stackId="calls" radius={[0, 0, 0, 0]} />
                <Bar dataKey="missed" name="Missed" fill={COLORS.missed} stackId="calls" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-12">No call data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Daily Volume & Hourly Load */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Volume */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Daily Call Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyVolume}>
                  <defs>
                    <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.outbound} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.outbound} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.inbound} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.inbound} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(220 10% 55%)"
                    fontSize={11}
                    tick={{ fill: 'hsl(45 20% 85%)' }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(220 18% 10%)',
                      border: '1px solid hsl(220 15% 20%)',
                      borderRadius: '8px',
                      color: 'hsl(45 20% 95%)',
                    }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="outbound" name="Outbound" stroke={COLORS.outbound} fill="url(#outboundGradient)" />
                  <Area type="monotone" dataKey="inbound" name="Inbound" stroke={COLORS.inbound} fill="url(#inboundGradient)" />
                  <Area type="monotone" dataKey="missed" name="Missed" stroke={COLORS.missed} fill={COLORS.missed} fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No daily data</p>
            )}
          </CardContent>
        </Card>

        {/* Hourly Call Load */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Hourly Call Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyLoad.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={hourlyLoad}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                  <XAxis
                    dataKey="hour"
                    stroke="hsl(220 10% 55%)"
                    fontSize={11}
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
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Calls"
                    stroke={COLORS.gold}
                    strokeWidth={2}
                    dot={{ fill: COLORS.gold, r: 4 }}
                    activeDot={{ r: 6, fill: COLORS.gold }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No hourly data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Duration Table */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Agent Call Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Agent</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium">Outbound</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium">Inbound</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium">Missed</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium">Total Time</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {callsByPerson.map((agent: any) => (
                  <tr key={agent.agentName} className="border-b border-border/10 hover:bg-muted/20">
                    <td className="py-3 px-2 font-medium text-foreground">{agent.agentName}</td>
                    <td className="py-3 px-2 text-right text-blue-400 font-semibold">{agent.outbound}</td>
                    <td className="py-3 px-2 text-right text-emerald-400">{agent.inbound}</td>
                    <td className="py-3 px-2 text-right text-red-400">{agent.missed}</td>
                    <td className="py-3 px-2 text-right text-primary font-semibold">{formatDuration(agent.totalDuration)}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{agent.avgDuration}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VoiceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-6">
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
