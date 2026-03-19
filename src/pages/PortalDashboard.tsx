import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalNav } from '@/components/portal/PortalNav';
import { CandidateCard } from '@/components/portal/CandidateCard';
import { Users, Search, Filter, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PortalSession {
  type: 'client';
  client_user_id: string;
  client_id: string;
  client_name: string;
  email: string;
  name: string;
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const sessionData = sessionStorage.getItem('portal_session');
  const session: PortalSession | null = sessionData ? JSON.parse(sessionData) : null;

  useEffect(() => {
    if (!session || session.type !== 'client') {
      navigate('/portal', { replace: true });
      return;
    }
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*, feedback(count)')
        .eq('client_id', session.client_id)
        .eq('published', true)
        .order('published_at', { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_session');
    navigate('/portal', { replace: true });
  };

  const filtered = candidates.filter((c) => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.position_title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <PortalNav userType="client" userName={session.name} onLogout={handleLogout} />

      <div className="mx-auto max-w-5xl px-4 pt-24 pb-12 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-white">
            {session.client_name}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} submitted
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates..."
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-[#D4A853]/30 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-white/20" />
            {['all', 'submitted', 'interview', 'offer', 'placed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Candidate grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-10 w-10 text-white/10" />
            <p className="mt-3 text-sm text-white/30">
              {candidates.length === 0 ? 'No candidates submitted yet' : 'No candidates match your filters'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((c) => (
              <CandidateCard
                key={c.id}
                id={c.id}
                name={c.name}
                position_title={c.position_title}
                status={c.status}
                location={c.visible_fields?.location ? c.location : undefined}
                comp_target={c.visible_fields?.comp_target ? c.comp_target : undefined}
                notice_period={c.visible_fields?.notice_period ? c.notice_period : undefined}
                published_at={c.published_at}
                feedbackCount={c.feedback?.[0]?.count}
                basePath="/portal"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
