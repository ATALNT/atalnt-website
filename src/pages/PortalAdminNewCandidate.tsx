import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalNav } from '@/components/portal/PortalNav';
import { CandidateDetail } from '@/components/portal/CandidateDetail';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Upload, Eye, Send, Plus, X, Loader2,
  FileText, GripVertical
} from 'lucide-react';

interface OpsSession {
  type: 'ops_lead';
  ops_lead_id: string;
  email: string;
  name: string;
}

const defaultVisibleFields = {
  summary: true,
  highlights: true,
  location: true,
  comp_target: true,
  notice_period: true,
  linkedin_url: true,
  notes: true,
  reason_for_exploring: true,
};

export default function PortalAdminNewCandidate() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Form state
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [summaryHtml, setSummaryHtml] = useState('');
  const [highlights, setHighlights] = useState<string[]>(['']);
  const [location, setLocation] = useState('');
  const [compTarget, setCompTarget] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [reasonForExploring, setReasonForExploring] = useState('');
  const [visibleFields, setVisibleFields] = useState(defaultVisibleFields);
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeFilename, setResumeFilename] = useState('');

  const sessionData = sessionStorage.getItem('portal_session');
  const session: OpsSession | null = sessionData ? JSON.parse(sessionData) : null;

  useEffect(() => {
    if (!session || session.type !== 'ops_lead') {
      navigate('/portal', { replace: true });
      return;
    }
    loadClients();
  }, []);

  const loadClients = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('client_assignments')
      .select('client_id, clients(id, name)')
      .eq('ops_lead_id', session.ops_lead_id);
    setClients(data?.map((a: any) => a.clients) || []);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);

    const fileExt = file.name.split('.').pop();
    const filePath = `${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('resumes')
      .upload(filePath, file, { contentType: file.type });

    if (error) {
      console.error('Upload failed:', error);
      setUploadingResume(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath);
    setResumeUrl(urlData.publicUrl);
    setResumeFilename(file.name);
    setUploadingResume(false);
  };

  const addHighlight = () => setHighlights([...highlights, '']);
  const removeHighlight = (i: number) => setHighlights(highlights.filter((_, idx) => idx !== i));
  const updateHighlight = (i: number, val: string) => {
    const updated = [...highlights];
    updated[i] = val;
    setHighlights(updated);
  };

  const toggleField = (field: string) => {
    setVisibleFields({ ...visibleFields, [field]: !visibleFields[field as keyof typeof visibleFields] });
  };

  const candidatePreview = {
    id: 'preview',
    name,
    position_title: positionTitle,
    summary_html: summaryHtml,
    highlights: highlights.filter(Boolean),
    location,
    comp_target: compTarget,
    notice_period: noticePeriod,
    linkedin_url: linkedinUrl,
    notes,
    reason_for_exploring: reasonForExploring,
    visible_fields: visibleFields,
    status: 'submitted',
    resume_url: resumeUrl,
    resume_filename: resumeFilename,
    published_at: new Date().toISOString(),
  };

  const handlePublish = async () => {
    if (!session || !clientId || !name || !positionTitle) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.from('candidates').insert({
        client_id: clientId,
        ops_lead_id: session.ops_lead_id,
        name,
        position_title: positionTitle,
        summary_html: summaryHtml || null,
        highlights: highlights.filter(Boolean),
        location: location || null,
        comp_target: compTarget || null,
        notice_period: noticePeriod || null,
        linkedin_url: linkedinUrl || null,
        notes: notes || null,
        reason_for_exploring: reasonForExploring || null,
        visible_fields: visibleFields,
        status: 'submitted',
        resume_url: resumeUrl || null,
        resume_filename: resumeFilename || null,
        published: true,
        published_at: new Date().toISOString(),
      }).select().single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_log').insert({
        candidate_id: data.id,
        action: 'published',
        actor_email: session.email,
        actor_type: 'ops_lead',
        details: { client_id: clientId },
      });

      // Notify client
      await fetch('/api/portal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_candidate',
          candidate_id: data.id,
          candidate_name: name,
          position_title: positionTitle,
          client_id: clientId,
        }),
      });

      navigate('/portal/admin');
    } catch (err) {
      console.error('Failed to publish:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_session');
    navigate('/portal', { replace: true });
  };

  if (!session) return null;

  // Preview mode
  if (showPreview) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-[#D4A853]/20 bg-[#D4A853]/[0.06] px-4 py-3 backdrop-blur-md">
          <button
            onClick={() => setShowPreview(false)}
            className="flex items-center gap-1.5 text-sm text-[#D4A853]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to editing
          </button>
          <button
            onClick={handlePublish}
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#b8912e] px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publish to Client
          </button>
        </div>
        <CandidateDetail candidate={candidatePreview} showFeedback={false} isPreview />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav userType="ops_lead" userName={session.name} onLogout={handleLogout} />

      <div className="mx-auto max-w-3xl px-4 pt-24 pb-12 sm:px-6">
        <button
          onClick={() => navigate('/portal/admin')}
          className="mb-6 flex items-center gap-1 text-xs text-white/30 hover:text-white/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to candidates
        </button>

        <h1 className="mb-8 font-display text-2xl font-bold text-white">New Candidate Submission</h1>

        <div className="space-y-8">
          {/* Client selection */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
              Submit To
            </h2>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-[#D4A853]/30 focus:outline-none"
            >
              <option value="" className="bg-[#0a0b13]">Select client...</option>
              {clients.map((c: any) => (
                <option key={c.id} value={c.id} className="bg-[#0a0b13]">{c.name}</option>
              ))}
            </select>
          </section>

          {/* Basic info */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
              Candidate Info
            </h2>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ryan Holder"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Position Title *</label>
                  <input
                    type="text"
                    value={positionTitle}
                    onChange={(e) => setPositionTitle(e.target.value)}
                    placeholder="Freight Sales Executive"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="Reno, NV"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Comp Target</label>
                  <input type="text" value={compTarget} onChange={(e) => setCompTarget(e.target.value)}
                    placeholder="$150K (base + commission)"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Notice Period</label>
                  <input type="text" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)}
                    placeholder="Available immediately"
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">LinkedIn URL</label>
                <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
              Summary
            </h2>
            <p className="mb-2 text-[10px] text-white/20">Use &lt;strong&gt; tags for bold text (e.g., &lt;strong&gt;$1.5M in monthly revenue&lt;/strong&gt;)</p>
            <textarea
              value={summaryHtml}
              onChange={(e) => setSummaryHtml(e.target.value)}
              rows={5}
              placeholder="After speaking with Ryan, it's clear that his strong background in <strong>freight brokerage</strong>..."
              className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
            />
          </section>

          {/* Highlights */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
              Candidate Highlights
            </h2>
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-white/10" />
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => updateHighlight(i, e.target.value)}
                    placeholder="Managed a book generating $1.5M in monthly revenue..."
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                  />
                  {highlights.length > 1 && (
                    <button onClick={() => removeHighlight(i)} className="text-white/20 hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addHighlight}
              className="mt-3 flex items-center gap-1 text-xs text-[#D4A853]/60 hover:text-[#D4A853]"
            >
              <Plus className="h-3 w-3" />
              Add highlight
            </button>
          </section>

          {/* Notes & Reason */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="He is also open to exploring 1099 opportunities."
                  className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/25">Reason for Exploring</label>
                <textarea
                  value={reasonForExploring}
                  onChange={(e) => setReasonForExploring(e.target.value)}
                  rows={2}
                  placeholder="Ryan is seeking new opportunities to further his career growth..."
                  className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Resume upload */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
              Resume
            </h2>
            {resumeUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#D4A853]/20 bg-[#D4A853]/[0.04] px-4 py-3">
                <FileText className="h-5 w-5 text-[#D4A853]" />
                <span className="flex-1 text-sm text-white/70">{resumeFilename}</span>
                <button
                  onClick={() => { setResumeUrl(''); setResumeFilename(''); }}
                  className="text-white/30 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/[0.08] py-8 transition-colors hover:border-[#D4A853]/20">
                {uploadingResume ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-white/20" />
                    <span className="text-sm text-white/30">Upload PDF resume</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                  disabled={uploadingResume}
                />
              </label>
            )}
          </section>

          {/* Field visibility */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
              Visible to Client
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(visibleFields).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => toggleField(key)}
                  className={`rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition-colors ${
                    val
                      ? 'border-[#D4A853]/20 bg-[#D4A853]/[0.06] text-[#D4A853]'
                      : 'border-white/[0.06] text-white/20'
                  }`}
                >
                  {key.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowPreview(true)}
              disabled={!name || !positionTitle}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-sm font-medium text-white/60 transition-colors hover:border-[#D4A853]/20 hover:text-white disabled:opacity-30"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button
              onClick={handlePublish}
              disabled={submitting || !name || !positionTitle || !clientId}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#b8912e] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
