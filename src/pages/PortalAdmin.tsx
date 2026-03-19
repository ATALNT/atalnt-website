import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PortalNav } from '@/components/portal/PortalNav';
import { CandidateCard } from '@/components/portal/CandidateCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { Plus, Users, Search, Filter, Loader2, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface OpsSession {
  type: 'ops_lead';
  ops_lead_id: string;
  email: string;
  name: string;
}

export default function PortalAdmin() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  const sessionData = sessionStorage.getItem('portal_session');
  const session: OpsSession | null = sessionData ? JSON.parse(sessionData) : null;

  useEffect(() => {
    if (!session || session.type !== 'ops_lead') {
      navigate('/portal', { replace: true });
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    if (!session) return;
    try {
      // Get assigned clients
      const { data: assignments } = await supabase
        .from('client_assignments')
        .select('client_id, clients(id, name, slug)')
        .eq('ops_lead_id', session.ops_lead_id);

      const assignedClients = assignments?.map((a: any) => a.clients) || [];
      setClients(assignedClients);

      const clientIds = assignedClients.map((c: any) => c.id);

      if (clientIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get all candidates for assigned clients
      const { data: candidateData, error } = await supabase
        .from('candidates')
        .select('*, clients(name), feedback(count)')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCandidates(candidateData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_session');
    navigate('/portal', { replace: true });
  };

  const handleStatusChange = async (candidateId: string, newStatus: string) => {
    if (!session) return;
    const { error } = await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', candidateId);

    if (error) {
      console.error('Failed to update status:', error);
      return;
    }

    // Log activity
    await supabase.from('activity_log').insert({
      candidate_id: candidateId,
      action: 'status_changed',
      actor_email: session.email,
      actor_type: 'ops_lead',
      details: { new_status: newStatus },
    });

    loadData();
  };

  const filtered = candidates.filter((c) => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.position_title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesClient = clientFilter === 'all' || c.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <PortalNav userType="ops_lead" userName={session.name} onLogout={handleLogout} />

      <div className="mx-auto max-w-6xl px-4 pt-24 pb-12 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Candidates</h1>
            <p className="mt-1 text-sm text-white/40">
              {candidates.length} total · {candidates.filter(c => c.published).length} published
            </p>
          </div>
          <Link
            to="/portal/admin/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A853] to-[#b8912e] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Submission
          </Link>
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-white/20" />
            {['all', 'submitted', 'interview', 'offer', 'placed', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {s === 'rejected' ? 'passed' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Client filter */}
        {clients.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-white/20" />
            <button
              onClick={() => setClientFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                clientFilter === 'all' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'
              }`}
            >
              All Clients
            </button>
            {clients.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setClientFilter(c.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  clientFilter === c.id ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Candidates */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-10 w-10 text-white/10" />
            <p className="mt-3 text-sm text-white/30">
              {candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
            </p>
            <Link
              to="/portal/admin/new"
              className="mt-4 text-sm text-[#D4A853] hover:underline"
            >
              Submit your first candidate
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="group flex items-center gap-3">
                <div className="flex-1">
                  <CandidateCard
                    id={c.id}
                    name={c.name}
                    position_title={c.position_title}
                    status={c.status}
                    location={c.location}
                    comp_target={c.comp_target}
                    notice_period={c.notice_period}
                    published_at={c.published_at}
                    feedbackCount={c.feedback?.[0]?.count}
                    basePath="/portal/admin"
                  />
                </div>
                {/* Quick status change */}
                <div className="hidden shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                  {['submitted', 'interview', 'offer', 'placed'].map((s) => (
                    <button
                      key={s}
                      onClick={(e) => { e.preventDefault(); handleStatusChange(c.id, s); }}
                      disabled={c.status === s}
                      className={`rounded px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider transition-colors ${
                        c.status === s
                          ? 'bg-[#D4A853]/20 text-[#D4A853]'
                          : 'text-white/20 hover:bg-white/[0.04] hover:text-white/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
