import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PortalNav } from '@/components/portal/PortalNav';
import { CandidateDetail } from '@/components/portal/CandidateDetail';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PortalCandidate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const sessionData = sessionStorage.getItem('portal_session');
  const session = sessionData ? JSON.parse(sessionData) : null;
  const isClient = session?.type === 'client';
  const isOpsLead = session?.type === 'ops_lead';

  useEffect(() => {
    if (!session) {
      navigate('/portal', { replace: true });
      return;
    }
    loadCandidate();
  }, [id]);

  const loadCandidate = async () => {
    if (!id) return;
    try {
      const [candidateRes, activityRes, feedbackRes] = await Promise.all([
        supabase.from('candidates').select('*').eq('id', id).single(),
        supabase.from('activity_log').select('*').eq('candidate_id', id).order('created_at', { ascending: false }),
        supabase.from('feedback').select('*, client_users(name, email)').eq('candidate_id', id).order('created_at', { ascending: false }),
      ]);

      if (candidateRes.error) throw candidateRes.error;
      setCandidate(candidateRes.data);
      setActivity(activityRes.data || []);
      setFeedback(feedbackRes.data || []);
    } catch (err) {
      console.error('Failed to load candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (thumbsUp: boolean, comment: string) => {
    if (!session || !id) return;

    const { error } = await supabase.from('feedback').insert({
      candidate_id: id,
      client_user_id: session.client_user_id,
      thumbs_up: thumbsUp,
      comment: comment || null,
    });

    if (error) throw error;

    // Log activity
    await supabase.from('activity_log').insert({
      candidate_id: id,
      action: thumbsUp ? 'feedback_positive' : 'feedback_negative',
      actor_email: session.email,
      actor_type: 'client',
      details: { comment: comment || null },
    });

    // Send notification to ops lead
    await fetch('/api/portal/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'feedback',
        candidate_id: id,
        candidate_name: candidate?.name,
        client_name: session.client_name,
        feedback: { thumbs_up: thumbsUp, comment },
        actor_email: session.email,
      }),
    });

    // Reload
    loadCandidate();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_session');
    navigate('/portal', { replace: true });
  };

  if (!session) return null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-white/40">Candidate not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav
        userType={isOpsLead ? 'ops_lead' : 'client'}
        userName={session.name}
        onLogout={handleLogout}
      />

      <div className="pt-16">
        {/* Back button */}
        <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-white/30 transition-colors hover:text-white/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        <CandidateDetail
          candidate={candidate}
          activityEntries={activity}
          existingFeedback={feedback.map((f: any) => ({
            thumbs_up: f.thumbs_up,
            comment: f.comment,
          }))}
          onFeedbackSubmit={isClient ? handleFeedbackSubmit : undefined}
          showFeedback={isClient}
        />
      </div>
    </div>
  );
}
