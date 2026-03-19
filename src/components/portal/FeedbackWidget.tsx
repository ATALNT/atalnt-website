import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackWidgetProps {
  candidateId: string;
  onSubmit: (thumbsUp: boolean, comment: string) => Promise<void>;
  existingFeedback?: { thumbs_up: boolean; comment: string | null }[];
}

export function FeedbackWidget({ candidateId, onSubmit, existingFeedback }: FeedbackWidgetProps) {
  const [selected, setSelected] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (selected === null) return;
    setSubmitting(true);
    try {
      await onSubmit(selected, comment);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-[#D4A853]/20 bg-[#D4A853]/[0.04] p-6 text-center">
        <p className="font-display text-sm font-semibold text-[#D4A853]">Feedback submitted</p>
        <p className="mt-1 text-xs text-white/40">Thank you for your response</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-white/80">Your Feedback</h3>

      {/* Existing feedback from other users */}
      {existingFeedback && existingFeedback.length > 0 && (
        <div className="space-y-2">
          {existingFeedback.map((fb, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              {fb.thumbs_up ? (
                <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <ThumbsDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              )}
              <p className="text-xs text-white/50">{fb.comment || 'No comment'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Thumbs up / down selection */}
      <div className="flex gap-3">
        <button
          onClick={() => setSelected(true)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all',
            selected === true
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
              : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-emerald-400/20 hover:text-emerald-400/60'
          )}
        >
          <ThumbsUp className="h-4 w-4" />
          Interested
        </button>
        <button
          onClick={() => setSelected(false)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all',
            selected === false
              ? 'border-red-400/40 bg-red-400/10 text-red-400'
              : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-red-400/20 hover:text-red-400/60'
          )}
        >
          <ThumbsDown className="h-4 w-4" />
          Pass
        </button>
      </div>

      {/* Comment box */}
      {selected !== null && (
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)..."
            rows={3}
            className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none focus:ring-0"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#b8912e] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      )}
    </div>
  );
}
