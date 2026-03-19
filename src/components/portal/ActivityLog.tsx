import { Clock, MessageSquare, Send, ArrowRight, Eye, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityEntry {
  id: string;
  action: string;
  actor_email: string;
  actor_type: 'ops_lead' | 'client';
  details: Record<string, any>;
  created_at: string;
}

const actionConfig: Record<string, { icon: typeof Clock; color: string; label: (d: any) => string }> = {
  published: {
    icon: Send,
    color: 'text-[#D4A853]',
    label: () => 'Candidate published to portal',
  },
  feedback_positive: {
    icon: ThumbsUp,
    color: 'text-emerald-400',
    label: (d) => d?.comment ? `Interested: "${d.comment}"` : 'Marked as interested',
  },
  feedback_negative: {
    icon: ThumbsDown,
    color: 'text-red-400',
    label: (d) => d?.comment ? `Passed: "${d.comment}"` : 'Marked as pass',
  },
  status_changed: {
    icon: ArrowRight,
    color: 'text-blue-400',
    label: (d) => `Status changed to ${d?.new_status || 'unknown'}`,
  },
  viewed: {
    icon: Eye,
    color: 'text-white/40',
    label: () => 'Viewed candidate profile',
  },
};

interface ActivityLogProps {
  entries: ActivityEntry[];
  className?: string;
}

export function ActivityLog({ entries, className }: ActivityLogProps) {
  if (entries.length === 0) {
    return (
      <div className={cn('rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center', className)}>
        <Clock className="mx-auto h-5 w-5 text-white/20" />
        <p className="mt-2 text-xs text-white/30">No activity yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {entries.map((entry, i) => {
        const config = actionConfig[entry.action] || {
          icon: MessageSquare,
          color: 'text-white/40',
          label: () => entry.action,
        };
        const Icon = config.icon;
        const localTime = new Date(entry.created_at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={cn('rounded-full border border-white/[0.06] bg-white/[0.02] p-1.5', config.color)}>
                <Icon className="h-3 w-3" />
              </div>
              {i < entries.length - 1 && (
                <div className="w-[1px] flex-1 bg-white/[0.06]" />
              )}
            </div>
            {/* Content */}
            <div className="pb-4">
              <p className="text-xs text-white/70">{config.label(entry.details)}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[10px] text-white/25">{entry.actor_email}</span>
                <span className="text-[10px] text-white/15">·</span>
                <span className="text-[10px] text-white/25">{localTime}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
