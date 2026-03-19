import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { MapPin, DollarSign, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateCardProps {
  id: string;
  name: string;
  position_title: string;
  status: string;
  location?: string;
  comp_target?: string;
  notice_period?: string;
  published_at?: string;
  feedbackCount?: number;
  basePath?: string;
}

export function CandidateCard({
  id, name, position_title, status, location, comp_target,
  notice_period, published_at, feedbackCount, basePath = '/portal'
}: CandidateCardProps) {
  const submittedDate = published_at
    ? new Date(published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Link
      to={`${basePath}/candidate/${id}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:border-[#D4A853]/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-white group-hover:text-[#D4A853] transition-colors">
            {name}
          </h3>
          <p className="mt-0.5 text-sm text-white/50">{position_title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={status} />
          <ExternalLink className="h-3.5 w-3.5 text-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {location && (
          <span className="flex items-center gap-1 text-[11px] text-white/30">
            <MapPin className="h-3 w-3" />
            {location}
          </span>
        )}
        {comp_target && (
          <span className="flex items-center gap-1 text-[11px] text-white/30">
            <DollarSign className="h-3 w-3" />
            {comp_target}
          </span>
        )}
        {notice_period && (
          <span className="flex items-center gap-1 text-[11px] text-white/30">
            <Clock className="h-3 w-3" />
            {notice_period}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
        {submittedDate && (
          <span className="text-[10px] text-white/20">Submitted {submittedDate}</span>
        )}
        {feedbackCount !== undefined && feedbackCount > 0 && (
          <span className="text-[10px] text-[#D4A853]/50">{feedbackCount} feedback</span>
        )}
      </div>
    </Link>
  );
}
