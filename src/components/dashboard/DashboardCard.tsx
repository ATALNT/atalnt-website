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
      'border-border/50 bg-card/80 backdrop-blur-sm transition-all hover:border-primary/30',
      accent && 'border-primary/40 bg-gradient-to-br from-primary/10 to-card',
      className
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground font-display">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                <span>{trend.value >= 0 ? '+' : ''}{trend.value}%</span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
