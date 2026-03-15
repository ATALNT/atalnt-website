import landstarLogo from '@/assets/partners/landstar.png';
import armstrongLogo from '@/assets/partners/armstrong.png';
import efwLogo from '@/assets/partners/efw.png';
import forwardairLogo from '@/assets/partners/forwardair.svg';
import pegasusLogo from '@/assets/partners/pegasus.png';
import bettawayLogo from '@/assets/partners/bettaway.png';
import rxoLogo from '@/assets/partners/rxo.svg';
import stevensglobalLogo from '@/assets/partners/stevensglobal.png';
import freightLogo from '@/assets/partners/007freight.png';
import brownLogo from '@/assets/partners/brownlogistics.png';
import servefreightLogo from '@/assets/partners/servefreight.svg';
import aeronetLogo from '@/assets/partners/aeronet.png';

// hasBg = logo has an opaque/white background that needs to be removed via blend mode
const partners = [
  { name: 'Landstar', logo: landstarLogo, hasBg: true },
  { name: 'Forward Air', logo: forwardairLogo, hasBg: false },
  { name: 'Armstrong Transport Group', logo: armstrongLogo, hasBg: false },
  { name: 'RXO', logo: rxoLogo, hasBg: false },
  { name: 'Pegasus Logistics Group', logo: pegasusLogo, hasBg: true },
  { name: 'Bettaway Supply Chain', logo: bettawayLogo, hasBg: false },
  { name: 'EFW', logo: efwLogo, hasBg: false },
  { name: 'Aeronet Worldwide', logo: aeronetLogo, hasBg: true },
  { name: 'Stevens Global Logistics', logo: stevensglobalLogo, hasBg: true },
  { name: '007 Freight', logo: freightLogo, hasBg: false },
  { name: 'Brown Integrated Logistics', logo: brownLogo, hasBg: true },
  { name: 'Serve Freight', logo: servefreightLogo, hasBg: false },
];

export const Partners = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">
            Trusted Partners
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-4">
            Companies We <span className="text-gradient-gold">Work With</span>
          </h2>
        </div>

        {/* Logo Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1">
          {partners.map((partner) => (
            <div
              key={partner.name}
              className="group flex items-center justify-center p-6 md:p-8 rounded-xl border border-transparent hover:border-border hover:bg-card/50 transition-all duration-300"
            >
              <img
                src={partner.logo}
                alt={partner.name}
                title={partner.name}
                className="max-h-10 md:max-h-12 w-auto object-contain transition-all duration-500 group-hover:opacity-80"
                style={
                  partner.hasBg
                    ? {
                        // Dark logos on white bg: invert to make bg black + logo white, then screen blends black away
                        filter: 'grayscale(1) invert(1)',
                        opacity: 0.4,
                        mixBlendMode: 'screen' as const,
                      }
                    : {
                        // Already white/transparent logos: just grayscale and dim
                        filter: 'grayscale(1) brightness(2)',
                        opacity: 0.4,
                      }
                }
                onMouseEnter={(e) => {
                  if (partner.hasBg) {
                    e.currentTarget.style.opacity = '0.7';
                  } else {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.4';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
