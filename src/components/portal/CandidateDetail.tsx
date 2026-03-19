import logo from '@/assets/atalnt-logo-transparent.png';
import { StatusPipeline } from './StatusPipeline';
import { ResumeViewer } from './ResumeViewer';
import { FeedbackWidget } from './FeedbackWidget';
import { ActivityLog } from './ActivityLog';
import { MapPin, DollarSign, Clock, Linkedin, FileText, StickyNote } from 'lucide-react';

interface CandidateData {
  id: string;
  name: string;
  position_title: string;
  summary_html?: string;
  highlights: string[];
  location?: string;
  comp_target?: string;
  notice_period?: string;
  linkedin_url?: string;
  notes?: string;
  reason_for_exploring?: string;
  visible_fields: Record<string, boolean>;
  status: string;
  resume_url?: string;
  resume_filename?: string;
  published_at?: string;
}

interface CandidateDetailProps {
  candidate: CandidateData;
  activityEntries?: any[];
  existingFeedback?: { thumbs_up: boolean; comment: string | null }[];
  onFeedbackSubmit?: (thumbsUp: boolean, comment: string) => Promise<void>;
  showFeedback?: boolean;
  isPreview?: boolean;
}

export function CandidateDetail({
  candidate, activityEntries = [], existingFeedback = [],
  onFeedbackSubmit, showFeedback = true, isPreview = false,
}: CandidateDetailProps) {
  const vf = candidate.visible_fields;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-[#D4A853]/[0.06] via-background to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,168,83,0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#D4A853]/60">
            <img src={logo} alt="ATALNT" className="h-6 w-auto opacity-60" />
            <span>Represented by ATALNT</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
            {candidate.name}
          </h1>
          <p className="mt-1 text-lg text-white/50">{candidate.position_title}</p>
          <div className="mt-6">
            <StatusPipeline currentStatus={candidate.status} />
          </div>
          {isPreview && (
            <div className="mt-4 rounded-lg border border-[#D4A853]/30 bg-[#D4A853]/10 px-3 py-2 text-xs font-medium text-[#D4A853]">
              Preview Mode — This is how the client will see this candidate
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main content */}
          <div className="space-y-8">
            {/* Summary */}
            {vf.summary && candidate.summary_html && (
              <section>
                <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                  Summary
                </h2>
                <div
                  className="prose prose-invert prose-sm max-w-none text-white/70 [&_strong]:text-[#D4A853]"
                  dangerouslySetInnerHTML={{ __html: candidate.summary_html }}
                />
              </section>
            )}

            {/* Highlights */}
            {vf.highlights && candidate.highlights.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                  Candidate Highlights
                </h2>
                <ul className="space-y-2">
                  {candidate.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4A853]/60" />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Other Details */}
            <section>
              <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                Other Details
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {vf.location && candidate.location && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <MapPin className="h-4 w-4 text-[#D4A853]/60" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/25">Location</p>
                      <p className="text-sm text-white/70">{candidate.location}</p>
                    </div>
                  </div>
                )}
                {vf.comp_target && candidate.comp_target && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <DollarSign className="h-4 w-4 text-[#D4A853]/60" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/25">Comp Target</p>
                      <p className="text-sm text-white/70">{candidate.comp_target}</p>
                    </div>
                  </div>
                )}
                {vf.notice_period && candidate.notice_period && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <Clock className="h-4 w-4 text-[#D4A853]/60" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/25">Notice Period</p>
                      <p className="text-sm text-white/70">{candidate.notice_period}</p>
                    </div>
                  </div>
                )}
                {vf.linkedin_url && candidate.linkedin_url && (
                  <a
                    href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-[#D4A853]/20"
                  >
                    <Linkedin className="h-4 w-4 text-[#D4A853]/60" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/25">LinkedIn</p>
                      <p className="text-sm text-[#D4A853]">View Profile</p>
                    </div>
                  </a>
                )}
              </div>
            </section>

            {/* Notes */}
            {vf.notes && candidate.notes && (
              <section>
                <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                  <StickyNote className="mr-1.5 inline h-3.5 w-3.5" />
                  Notes
                </h2>
                <p className="rounded-lg border border-[#D4A853]/10 bg-[#D4A853]/[0.03] px-4 py-3 text-sm italic text-white/50">
                  {candidate.notes}
                </p>
              </section>
            )}

            {/* Reason for Exploring */}
            {vf.reason_for_exploring && candidate.reason_for_exploring && (
              <section>
                <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                  Reason for Exploring
                </h2>
                <p className="text-sm text-white/60">{candidate.reason_for_exploring}</p>
              </section>
            )}

            {/* Resume */}
            {candidate.resume_url && (
              <ResumeViewer resumeUrl={candidate.resume_url} filename={candidate.resume_filename} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Feedback */}
            {showFeedback && onFeedbackSubmit && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <FeedbackWidget
                  candidateId={candidate.id}
                  onSubmit={onFeedbackSubmit}
                  existingFeedback={existingFeedback}
                />
              </div>
            )}

            {/* Activity Log */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="mb-4 font-display text-sm font-semibold text-white/80">Activity</h3>
              <ActivityLog entries={activityEntries} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
