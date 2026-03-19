import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  interview: { label: 'Interview', color: 'text-[#D4A853]', bg: 'bg-[#D4A853]/10 border-[#D4A853]/20' },
  offer: { label: 'Offer', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  placed: { label: 'Placed', color: 'text-emerald-300', bg: 'bg-emerald-300/10 border-emerald-300/20' },
  rejected: { label: 'Passed', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.submitted;
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
      config.color,
      config.bg,
      className
    )}>
      {config.label}
    </span>
  );
}
