import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { CandidateCard, MPCCandidateProfile } from '@/components/CandidateCard';
import { ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MPCResponse {
  candidates: MPCCandidateProfile[];
  count: number;
}

const fetchCandidates = async (): Promise<MPCResponse> => {
  const res = await fetch('/api/recruit/mpc-candidates');
  if (!res.ok) throw new Error('Failed to fetch candidates');
  return res.json();
};

const SkeletonCard = () => (
  <div className="w-full rounded-2xl border border-border bg-card overflow-hidden shadow-md" style={{ minHeight: '480px' }}>
    <div className="h-1 bg-gradient-gold w-full" />
    <div className="px-5 pt-5 pb-3 flex items-start gap-4">
      <div className="w-14 h-14 rounded-full bg-muted animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
      </div>
    </div>
    <div className="px-5 pb-3 flex gap-1.5">
      <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
      <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
    </div>
    <div className="px-5 pb-3 space-y-3 flex-1">
      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
      <div className="h-4 w-28 bg-muted animate-pulse rounded" />
      <div className="space-y-2 pt-2">
        <div className="h-3 w-full bg-muted animate-pulse rounded" />
        <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-3 w-5/6 bg-muted animate-pulse rounded" />
      </div>
    </div>
    <div className="px-5 pb-4 pt-1 border-t border-border/50 mt-auto">
      <div className="flex gap-1.5">
        <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
        <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
      </div>
    </div>
  </div>
);

const ActiveCandidates = () => {
  const { data, isLoading, error } = useQuery<MPCResponse>({
    queryKey: ['mpc-candidates'],
    queryFn: fetchCandidates,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const candidates = data?.candidates ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 md:pt-40 pb-12 md:pb-16 bg-gradient-card">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">
            Most Placeable Candidates
          </span>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold mt-4 mb-4 md:mb-6">
            Freight Sales
            <span className="text-gradient-gold"> Talent</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-6 md:mb-8">
            Pre-vetted freight and logistics sales professionals ready for their next opportunity.
            Each candidate has been screened by our recruiting team.
          </p>
          {!isLoading && candidates.length > 0 && (
            <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-2 text-sm font-medium text-gold-dark">
              <Users size={16} />
              {candidates.length} Active Candidate{candidates.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </section>

      {/* Candidate Grid */}
      <section className="py-8 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          {error ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2">Unable to load candidates right now.</p>
              <p className="text-muted-foreground/60 text-sm">Please try again later.</p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2">No active candidates at the moment.</p>
              <p className="text-muted-foreground/60 text-sm">Check back soon — our roster updates regularly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((candidate) => (
                <CandidateCard key={candidate.mpcId} candidate={candidate} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-gradient-card">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="font-display text-2xl md:text-4xl font-bold mb-4">
            Don't See the Right Fit?
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-6 md:mb-8">
            We have additional candidates in our pipeline. Schedule a confidential call
            and we'll match you with the right freight sales talent.
          </p>
          <a
            href="https://admin-atalnt.zohobookings.com/#/4732308000000813002"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              className="bg-gradient-gold text-primary-foreground font-semibold px-6 md:px-8 py-5 md:py-6 text-base md:text-lg hover:opacity-90 transition-all shadow-gold"
            >
              Schedule a Call
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ActiveCandidates;
