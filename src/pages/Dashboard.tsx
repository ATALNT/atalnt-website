import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardLogin } from '@/components/dashboard/DashboardLogin';
import { RecruitDashboard } from '@/components/dashboard/RecruitDashboard';
import { VoiceDashboard } from '@/components/dashboard/VoiceDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, RefreshCw, Briefcase, Phone } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  const { token, isAuthenticated, login, logout } = useAuth();
  const [datePreset, setDatePreset] = useState('this_week');
  const [activeTab, setActiveTab] = useState('recruit');
  const queryClient = useQueryClient();

  if (!isAuthenticated || !token) {
    return <DashboardLogin onLogin={login} />;
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/atalnt-logo-transparent.png"
              alt="ATALNT"
              className="h-8"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold font-display text-foreground leading-none">
                Analytics Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">Real-time team performance</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Preset Selector */}
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-[160px] bg-card/80 border-border/50 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="border-border/50"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/80 border border-border/50 p-1">
            <TabsTrigger
              value="recruit"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 px-6"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Recruiting</span>
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2 px-6"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Phone & Texts</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recruit" className="mt-6">
            <RecruitDashboard token={token} />
          </TabsContent>

          <TabsContent value="voice" className="mt-6">
            <VoiceDashboard token={token} datePreset={datePreset} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 mt-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>ATALNT LLC - Internal Analytics</span>
          <span>Auto-refreshes every 5 minutes</span>
        </div>
      </footer>
    </div>
  );
}
