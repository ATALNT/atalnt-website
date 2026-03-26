import { useState } from 'react';
import { MapPin, DollarSign, Briefcase, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface MPCCandidateProfile {
  mpcId: string;
  initials: string;
  currentTitle: string;
  location: string;
  compensationRange: string;
  yearsExperience: string;
  skillHighlights: string[];
  serviceCategories: string[];
  repType: string;
  targetSize: string;
  salesModel: string;
  salesStyle: string;
  recruiterNotes: string;
}

interface CandidateCardProps {
  candidate: MPCCandidateProfile;
}

export const CandidateCard = ({ candidate }: CandidateCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="group [perspective:1200px] w-full"
      style={{ minHeight: '480px' }}
    >
      <div
        className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] cursor-pointer ${
          isFlipped ? '[transform:rotateY(180deg)]' : ''
        }`}
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ minHeight: '480px' }}
      >
        {/* ===== FRONT FACE ===== */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-md hover:shadow-lg transition-shadow">
          {/* Gold accent bar */}
          <div className="h-1 bg-gradient-gold w-full" />

          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-start gap-4">
            {/* Initials badge */}
            <div className="w-14 h-14 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0">
              <span className="font-display text-lg font-bold text-primary-foreground">
                {candidate.initials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">
                {candidate.mpcId}
              </p>
              <h3 className="font-display text-lg font-bold text-foreground leading-tight mt-0.5 line-clamp-2">
                {candidate.currentTitle}
              </h3>
            </div>
          </div>

          {/* Rep type + Sales style badges */}
          <div className="px-5 pb-3 flex flex-wrap gap-1.5">
            {candidate.repType !== 'Unknown' && (
              <Badge variant="secondary" className="text-xs font-medium bg-gold/10 text-gold-dark border-gold/20">
                {candidate.repType}
              </Badge>
            )}
            {candidate.targetSize !== 'Unknown' && (
              <Badge variant="secondary" className="text-xs font-medium">
                {candidate.targetSize}
              </Badge>
            )}
            {candidate.salesModel !== 'Unknown' && (
              <Badge variant="outline" className="text-xs font-medium">
                {candidate.salesModel}
              </Badge>
            )}
          </div>

          {/* Key details */}
          <div className="px-5 pb-3 space-y-2 flex-1">
            {/* Location & Experience */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {candidate.location !== 'Location Undisclosed' && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-gold flex-shrink-0" />
                  <span className="truncate">{candidate.location}</span>
                </span>
              )}
              {candidate.yearsExperience && (
                <span className="flex items-center gap-1">
                  <Briefcase size={13} className="text-gold flex-shrink-0" />
                  {candidate.yearsExperience}
                </span>
              )}
            </div>

            {/* Compensation */}
            <div className="flex items-center gap-1 text-sm font-medium text-foreground">
              <DollarSign size={13} className="text-gold flex-shrink-0" />
              {candidate.compensationRange}
            </div>

            {/* Skills */}
            {candidate.skillHighlights.length > 0 && (
              <div className="pt-1">
                <ul className="space-y-1">
                  {candidate.skillHighlights.slice(0, 5).map((skill, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-gold mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gold" />
                      <span className="line-clamp-1">{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Service category tags */}
          {candidate.serviceCategories.length > 0 && (
            <div className="px-5 pb-4 pt-1 border-t border-border/50 mt-auto">
              <div className="flex flex-wrap gap-1.5">
                {candidate.serviceCategories.slice(0, 4).map((cat) => (
                  <Badge
                    key={cat}
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 font-medium border-gold/30 text-gold-dark bg-gold/5"
                  >
                    {cat}
                  </Badge>
                ))}
                {candidate.serviceCategories.length > 4 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                    +{candidate.serviceCategories.length - 4} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Flip hint */}
          <div className="px-5 pb-3 text-center">
            <span className="text-xs text-muted-foreground/60">
              Tap to learn more &rarr;
            </span>
          </div>
        </div>

        {/* ===== BACK FACE ===== */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-md">
          {/* Gold accent bar */}
          <div className="h-1 bg-gradient-gold w-full" />

          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
            {/* Initials */}
            <div className="w-20 h-20 rounded-full bg-gradient-gold flex items-center justify-center">
              <span className="font-display text-2xl font-bold text-primary-foreground">
                {candidate.initials}
              </span>
            </div>

            <div>
              <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase mb-1">
                {candidate.mpcId}
              </p>
              <h3 className="font-display text-xl font-bold text-foreground">
                {candidate.currentTitle}
              </h3>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Interested in this candidate?
              </p>
              <p className="text-muted-foreground text-sm">
                Schedule a confidential call with our team to get the full profile, resume, and introduction.
              </p>
            </div>

            <a
              href="https://admin-atalnt.zohobookings.com/#/4732308000000813002"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="lg"
                className="bg-gradient-gold text-primary-foreground font-semibold px-8 py-6 text-base hover:opacity-90 transition-all shadow-gold"
              >
                Schedule a Call
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </a>

            <button
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(false);
              }}
            >
              &larr; Back to profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
