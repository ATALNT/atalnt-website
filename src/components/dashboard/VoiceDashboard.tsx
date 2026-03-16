import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardCard } from './DashboardCard';
import { fetchVoiceCalls } from '@/lib/dashboard-api';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Activity, MessageSquare, MessageSquareText, Send, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, LineChart, Line
} from 'recharts';

const COLORS = {
  inbound: '#22c55e',
  outbound: '#3b82f6',
  missed: '#ef4444',
  gold: '#D4A853',
  smsIn: '#a78bfa',
  smsOut: '#f472b6',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(10, 11, 15, 0.95)',
  border: '1px solid rgba(212, 168, 83, 0.15)',
  borderRadius: '10px',
  color: '#fff',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
        <Phone className="h-12 w-12 text-white/15 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">Phone & Texts Coming Soon</h3>
        <p className="text-sm text-white/30 mt-2 max-w-md mx-auto">
          Zoho Voice integration is being configured. Call logs, SMS data, and agent performance metrics will appear here once connected.
        </p>
      </div>
    );
  }

  const overview = data?.overview || {};
  const callsByPerson = data?.callsByPerson || [];
  const smsByPerson = data?.smsByPerson || [];
  const dailyVolume = data?.dailyVolume || [];
  const dailySmsVolume = data?.dailySmsVolume || [];
  const hourlyLoad = data?.hourlyLoad || [];

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Call KPI Cards */}
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

      {/* SMS KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        <DashboardCard
          title="Total Texts"
          value={overview.totalSms ?? 0}
          icon={<MessageSquare className="h-5 w-5" />}
          accent
        />
        <DashboardCard
          title="Texts Received"
          value={overview.inboundSms ?? 0}
          icon={<MessageSquareText className="h-5 w-5" />}
        />
        <DashboardCard
          title="Texts Sent"
          value={overview.outboundSms ?? 0}
          icon={<Send className="h-5 w-5" />}
        />
      </div>

      {/* Calls by Person - Main Chart */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/20 to-transparent" />
        <CardHeader className="pb-2">
          <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
            Calls by Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callsByPerson.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={callsByPerson} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="agentName"
                  stroke="rgba(255,255,255,0.15)"
                  fontSize={12}
                  tick={{ fill: 'rgba(255,255,255,0.5)' }}
                />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={12} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
                <Bar dataKey="outbound" name="Outbound" fill={COLORS.outbound} stackId="calls" radius={[0, 0, 0, 0]} />
                <Bar dataKey="inbound" name="Inbound" fill={COLORS.inbound} stackId="calls" radius={[0, 0, 0, 0]} />
                <Bar dataKey="missed" name="Missed" fill={COLORS.missed} stackId="calls" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-white/20 py-12">No call data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Texts by Person */}
      {smsByPerson.length > 0 && (
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Texts by Team Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={smsByPerson} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="agentName"
                  stroke="rgba(255,255,255,0.15)"
                  fontSize={12}
                  tick={{ fill: 'rgba(255,255,255,0.5)' }}
                />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={12} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
                <Bar dataKey="outgoing" name="Sent" fill={COLORS.smsOut} stackId="sms" radius={[0, 0, 0, 0]} />
                <Bar dataKey="incoming" name="Received" fill={COLORS.smsIn} stackId="sms" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Volume & Hourly Load */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Volume */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Daily Call Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailyVolume}>
                  <defs>
                    <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.outbound} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.outbound} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.inbound} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.inbound} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.15)"
                    fontSize={11}
                    tick={{ fill: 'rgba(255,255,255,0.4)' }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="rgba(255,255,255,0.15)" fontSize={12} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
                  <Area type="monotone" dataKey="outbound" name="Outbound" stroke={COLORS.outbound} fill="url(#outboundGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="inbound" name="Inbound" stroke={COLORS.inbound} fill="url(#inboundGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="missed" name="Missed" stroke={COLORS.missed} fill={COLORS.missed} fillOpacity={0.08} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-white/20 py-12">No daily data</p>
            )}
          </CardContent>
        </Card>

        {/* Daily SMS Volume */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Daily Text Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailySmsVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dailySmsVolume}>
                  <defs>
                    <linearGradient id="smsOutGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.smsOut} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.smsOut} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="smsInGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.smsIn} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.smsIn} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.15)"
                    fontSize={11}
                    tick={{ fill: 'rgba(255,255,255,0.4)' }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="rgba(255,255,255,0.15)" fontSize={12} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)' }} />
                  <Area type="monotone" dataKey="outgoing" name="Sent" stroke={COLORS.smsOut} fill="url(#smsOutGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="incoming" name="Received" stroke={COLORS.smsIn} fill="url(#smsInGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-white/20 py-12">No text data for this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Call Distribution */}
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <CardHeader className="pb-2">
          <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
            Hourly Call Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hourlyLoad.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hourlyLoad}>
                <defs>
                  <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#D4A853" stopOpacity={0.5} />
                    <stop offset="50%" stopColor="#D4A853" stopOpacity={1} />
                    <stop offset="100%" stopColor="#D4A853" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="hour"
                  stroke="rgba(255,255,255,0.15)"
                  fontSize={11}
                  tick={{ fill: 'rgba(255,255,255,0.4)' }}
                />
                <YAxis stroke="rgba(255,255,255,0.15)" fontSize={12} tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Calls"
                  stroke="url(#goldLine)"
                  strokeWidth={2.5}
                  dot={{ fill: '#D4A853', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#D4A853', stroke: 'rgba(212,168,83,0.3)', strokeWidth: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-white/20 py-12">No hourly data</p>
          )}
        </CardContent>
      </Card>

      {/* Agent Details Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Call Details */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Agent Call Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Agent</th>
                    <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Out</th>
                    <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">In</th>
                    <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Missed</th>
                    <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Time</th>
                    <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {callsByPerson.map((agent: any) => (
                    <tr key={agent.agentName} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-2 font-medium text-white/80">{agent.agentName}</td>
                      <td className="py-3 px-2 text-right text-blue-400 font-semibold">{agent.outbound}</td>
                      <td className="py-3 px-2 text-right text-emerald-400">{agent.inbound}</td>
                      <td className="py-3 px-2 text-right text-red-400">{agent.missed}</td>
                      <td className="py-3 px-2 text-right text-[#D4A853] font-semibold">{formatDuration(agent.totalDuration)}</td>
                      <td className="py-3 px-2 text-right text-white/30">{agent.avgDuration}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Agent Text Details */}
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
              Agent Text Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {smsByPerson.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="text-left py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Agent</th>
                      <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Sent</th>
                      <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Received</th>
                      <th className="text-right py-3 px-2 text-white/25 font-medium text-[10px] uppercase tracking-widest">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smsByPerson.map((agent: any) => (
                      <tr key={agent.agentName} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-2 font-medium text-white/80">{agent.agentName}</td>
                        <td className="py-3 px-2 text-right text-pink-400 font-semibold">{agent.outgoing}</td>
                        <td className="py-3 px-2 text-right text-purple-400">{agent.incoming}</td>
                        <td className="py-3 px-2 text-right text-[#D4A853] font-semibold">{agent.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-white/20 py-12">No text data for this period</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VoiceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-3 w-16 bg-white/[0.06]" />
              <Skeleton className="h-8 w-12 bg-white/[0.06]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-3 w-16 bg-white/[0.06]" />
              <Skeleton className="h-8 w-12 bg-white/[0.06]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-6">
          <Skeleton className="h-[350px] w-full bg-white/[0.06]" />
        </CardContent>
      </Card>
    </div>
  );
}
