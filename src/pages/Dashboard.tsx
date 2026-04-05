import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardLogin } from '@/components/dashboard/DashboardLogin';
import { RecruitDashboard } from '@/components/dashboard/RecruitDashboard';
import { VoiceDashboard } from '@/components/dashboard/VoiceDashboard';
import { SalesDashboard } from '@/components/dashboard/SalesDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, RefreshCw, Briefcase, Phone, Signal, TrendingUp } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: start.toISOString(), to };
    }
    case 'this_week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to };
    }
    case 'last_7_days': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to };
    }
    case 'last_30_days': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to };
    }
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      return { from: start.toISOString(), to };
    }
    case 'last_90_days': {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to };
    }
    case 'all_time': {
      return { from: '2020-01-01T00:00:00.000Z', to };
    }
    default: {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to };
    }
  }
}

export default function Dashboard() {
  // Hide Zoho SalesIQ chat widget via injected CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'hide-salesiq-dashboard';
    style.textContent = `
      .zsiq_floatmain,
      .zsiq_theme1,
      .zls-sptwndw,
      [data-id="zsalesiq"],
      .zsiq-newtheme {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const { token, isAuthenticated, login, logout } = useAuth();
  const [datePreset, setDatePreset] = useState('last_7_days');
  const [activeTab, setActiveTab] = useState('recruit');
  const queryClient = useQueryClient();

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  if (!isAuthenticated || !token) {
    return <DashboardLogin onLogin={login} />;
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      {/* Subtle grid background */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(212,168,83,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,168,83,0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#D4A853]/10 bg-[#0a0b0f]/90 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src="/atalnt-logo-transparent.png"
                alt="ATALNT"
                className="h-8 relative z-10"
              />
              <div className="absolute inset-0 blur-lg bg-[#D4A853]/20 rounded-full" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-display text-white leading-none tracking-wide">
                  Executive Dashboard
                </h1>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <Signal className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
              </div>
              <p className="text-[11px] text-[#8a8a9a] mt-0.5 tracking-wide">Real-time operational intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Preset Selector */}
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-[180px] bg-white/[0.04] border-white/[0.08] text-sm text-white/80 hover:border-[#D4A853]/30 hover:bg-white/[0.06] transition-all rounded-lg h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#12131a] border-white/[0.08] backdrop-blur-xl rounded-lg shadow-2xl shadow-black/40">
                <SelectItem value="today" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">Today</SelectItem>
                <SelectItem value="this_week" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">This Week</SelectItem>
                <SelectItem value="last_7_days" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">Last 7 Days</SelectItem>
                <SelectItem value="this_month" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">This Month</SelectItem>
                <SelectItem value="last_30_days" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">Last 30 Days</SelectItem>
                <SelectItem value="this_quarter" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">This Quarter</SelectItem>
                <SelectItem value="last_90_days" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">Last 90 Days</SelectItem>
                <SelectItem value="all_time" className="text-white/70 focus:bg-[#D4A853]/10 focus:text-white">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-[#D4A853] hover:border-[#D4A853]/30 hover:bg-[#D4A853]/5 transition-all"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-white/40 hover:text-white/80"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1 backdrop-blur-sm">
            <TabsTrigger
              value="recruit"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4A853] data-[state=active]:to-[#b8912e] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-lg data-[state=active]:shadow-[#D4A853]/20 flex items-center gap-2 px-6 text-white/60 transition-all"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Recruiting</span>
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4A853] data-[state=active]:to-[#b8912e] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-lg data-[state=active]:shadow-[#D4A853]/20 flex items-center gap-2 px-6 text-white/60 transition-all"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Phone & Texts</span>
            </TabsTrigger>
            <TabsTrigger
              value="sales"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#D4A853] data-[state=active]:to-[#b8912e] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-lg data-[state=active]:shadow-[#D4A853]/20 flex items-center gap-2 px-6 text-white/60 transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Sales</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recruit" className="mt-6">
            <RecruitDashboard token={token} datePreset={datePreset} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="voice" className="mt-6">
            <VoiceDashboard token={token} datePreset={datePreset} />
          </TabsContent>

          <TabsContent value="sales" className="mt-6">
            <SalesDashboard token={token} datePreset={datePreset} dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-4 mt-8 relative z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between text-[11px] text-white/20 tracking-wide">
          <span>ATALNT LLC - Executive Intelligence Platform</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
            <span>Auto-refreshes every 5 minutes</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
