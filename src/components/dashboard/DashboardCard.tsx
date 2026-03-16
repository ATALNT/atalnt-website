import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
  accent?: boolean;
}

export function DashboardCard({ title, value, subtitle, icon, trend, className, accent }: DashboardCardProps) {
  return (
    <Card className={cn(
      'relative overflow-hidden border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-all duration-300 hover:border-[#D4A853]/20 hover:bg-white/[0.04] group',
      accent && 'border-[#D4A853]/20 bg-gradient-to-br from-[#D4A853]/[0.06] to-transparent',
      className
    )}>
      {/* Top accent line */}
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4A853]/60 to-transparent" />
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{title}</p>
            <p className={cn(
              'text-3xl font-bold tracking-tight font-display',
              accent ? 'text-[#D4A853]' : 'text-white'
            )}>{value}</p>
            {subtitle && (
              <p className="text-[11px] text-white/25">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                <span>{trend.value >= 0 ? '+' : ''}{trend.value}%</span>
                <span className="text-white/25">{trend.label}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn(
              'rounded-xl p-2.5 transition-colors',
              accent
                ? 'bg-[#D4A853]/10 text-[#D4A853] group-hover:bg-[#D4A853]/15'
                : 'bg-white/[0.04] text-white/30 group-hover:text-white/50'
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
