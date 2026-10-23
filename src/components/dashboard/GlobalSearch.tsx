import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSearch } from '@/lib/dashboard-api';
import { Search, X, Loader2, User, Building2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchApplication {
  jobTitle: string;
  clientName: string;
  status: string;
  recruiter: string;
  updated: string | null;
}

interface SearchCandidate {
  id: string;
  name: string;
  email: string;
  title: string;
  location: string;
  sourcer: string;
  owner: string;
  created: string | null;
  applications: SearchApplication[];
  url: string;
}

interface SearchClientRole {
  title: string;
  status: string;
  priority: string;
  opsManager: string;
  url: string;
}

interface SearchClient {
  name: string;
  openRoles: number;
  totalRoles: number;
  roles: SearchClientRole[];
  crmUrl: string | null;
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === 'hired' || s.includes('offer accepted')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (s.includes('offer')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (s.includes('interview')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
  if (s.includes('submitted')) return 'text-[#D4A853] bg-[#D4A853]/10 border-[#D4A853]/20';
  if (s.includes('reject') || s === 'withdrawn' || s === 'unqualified') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (s === 'in-progress') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  return 'text-white/50 bg-white/5 border-white/10';
}

function daysAgo(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  return days <= 0 ? 'today' : `${days}d ago`;
}

export function GlobalSearch({ token, className }: { token: string; className?: string }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce typing so Zoho isn't hit on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Cmd/Ctrl+K focuses the search; Esc closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const searchQuery = useQuery({
    queryKey: ['dashboard-search', query],
    queryFn: () => fetchDashboardSearch(token, query),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  });

  const candidates: SearchCandidate[] = searchQuery.data?.data?.candidates || [];
  const clients: SearchClient[] = searchQuery.data?.data?.clients || [];
  const showPanel = open && input.trim().length >= 2;
  const waiting = searchQuery.isFetching || input.trim() !== query;

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search candidates or clients..."
          aria-label="Search candidates or clients"
          className="w-full h-9 pl-9 pr-16 text-sm text-white/80 placeholder:text-white/25 bg-white/[0.04] border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#D4A853]/40 focus:bg-white/[0.06] transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {input ? (
            <button
              type="button"
              onClick={() => { setInput(''); setQuery(''); inputRef.current?.focus(); }}
              className="text-white/30 hover:text-white/70"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline text-[10px] text-white/25 border border-white/[0.08] rounded px-1.5 py-0.5">⌘K</kbd>
          )}
        </div>
      </div>

      {showPanel && (
        <div className="absolute right-0 mt-2 w-[min(640px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#12131a]/95 backdrop-blur-xl shadow-2xl shadow-black/50 z-[60]">
          {waiting && !candidates.length && !clients.length ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching Zoho Recruit and CRM...
            </div>
          ) : searchQuery.isError ? (
            <div className="px-4 py-6 text-sm text-red-400">Search failed. Try again in a moment.</div>
          ) : !candidates.length && !clients.length ? (
            <div className="px-4 py-6 text-sm text-white/40">
              No candidates or clients start with "{query}". Try a last name, an email, or the start of a company name.
            </div>
          ) : (
            <div className="py-2">
              {candidates.length > 0 && (
                <div>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                    Candidates ({candidates.length})
                  </p>
                  {candidates.map((c) => (
                    <a
                      key={c.id}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-3 hover:bg-white/[0.04] border-b border-white/[0.03] last:border-0 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-[#D4A853] shrink-0" />
                            <span className="text-sm font-medium text-white/90 truncate">{c.name}</span>
                            {c.sourcer && <span className="text-[10px] text-white/35 shrink-0">sourced by {c.sourcer}</span>}
                          </div>
                          <p className="text-xs text-white/40 mt-0.5 truncate">
                            {[c.title, c.location, c.email].filter(Boolean).join(' · ') || 'No details on file'}
                          </p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 shrink-0 mt-1" />
                      </div>
                      {c.applications.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {c.applications.slice(0, 4).map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={cn('px-1.5 py-0.5 rounded border text-[10px] shrink-0', statusTone(a.status))}>{a.status}</span>
                              <span className="text-white/60 truncate">
                                {a.jobTitle}{a.clientName ? ` · ${a.clientName}` : ''}
                              </span>
                              <span className="text-white/25 shrink-0 ml-auto">
                                {[a.recruiter, daysAgo(a.updated)].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          ))}
                          {c.applications.length > 4 && (
                            <p className="text-[10px] text-white/30">+{c.applications.length - 4} more jobs</p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-white/25">Not on any job yet</p>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {clients.length > 0 && (
                <div className={cn(candidates.length > 0 && 'mt-2 pt-2 border-t border-white/[0.06]')}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                    Clients ({clients.length})
                  </p>
                  {clients.map((c) => (
                    <div key={c.name} className="px-4 py-3 border-b border-white/[0.03] last:border-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="h-3.5 w-3.5 text-[#D4A853] shrink-0" />
                          <span className="text-sm font-medium text-white/90 truncate">{c.name}</span>
                          <span className="text-[10px] text-white/35 shrink-0">
                            {c.totalRoles ? `${c.openRoles} open of ${c.totalRoles} roles` : 'No jobs in Recruit'}
                          </span>
                        </div>
                        {c.crmUrl && (
                          <a
                            href={c.crmUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-white/35 hover:text-[#D4A853] shrink-0"
                          >
                            CRM <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {c.roles.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {c.roles.slice(0, 5).map((r, i) => (
                            <a
                              key={i}
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs hover:bg-white/[0.03] rounded px-1 -mx-1 py-0.5"
                            >
                              <span className={cn('px-1.5 py-0.5 rounded border text-[10px] shrink-0', statusTone(r.status))}>{r.status}</span>
                              <span className="text-white/60 truncate">{r.title}</span>
                              <span className="text-white/25 shrink-0 ml-auto">
                                {[r.priority, r.opsManager].filter(Boolean).join(' · ')}
                              </span>
                            </a>
                          ))}
                          {c.roles.length > 5 && <p className="text-[10px] text-white/30">+{c.roles.length - 5} more roles</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
