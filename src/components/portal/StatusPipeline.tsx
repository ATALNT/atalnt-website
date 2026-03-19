import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const stages = ['submitted', 'interview', 'offer', 'placed'] as const;
const stageLabels: Record<string, string> = {
  submitted: 'Submitted',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed',
};

interface StatusPipelineProps {
  currentStatus: string;
  className?: string;
}

export function StatusPipeline({ currentStatus, className }: StatusPipelineProps) {
  const currentIndex = stages.indexOf(currentStatus as any);
  const isRejected = currentStatus === 'rejected';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {stages.map((stage, i) => {
        const isPast = !isRejected && i < currentIndex;
        const isCurrent = !isRejected && i === currentIndex;

        return (
          <div key={stage} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all',
                  isPast && 'border-[#D4A853]/40 bg-[#D4A853]/20 text-[#D4A853]',
                  isCurrent && 'border-[#D4A853] bg-[#D4A853] text-black shadow-lg shadow-[#D4A853]/30',
                  !isPast && !isCurrent && 'border-white/10 bg-white/[0.02] text-white/20',
                  isRejected && 'border-red-400/20 bg-red-400/10 text-red-400/40'
                )}
              >
                {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                'text-[9px] font-medium uppercase tracking-wider',
                isPast && 'text-[#D4A853]/60',
                isCurrent && 'text-[#D4A853]',
                !isPast && !isCurrent && 'text-white/20',
                isRejected && 'text-red-400/40'
              )}>
                {stageLabels[stage]}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={cn(
                'mb-4 h-[1px] w-6 sm:w-10',
                isPast ? 'bg-[#D4A853]/40' : 'bg-white/10'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
