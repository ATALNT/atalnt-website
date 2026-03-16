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

const partners = [
  { name: 'Landstar', logo: landstarLogo, hasBg: true },
  { name: 'Forward Air', logo: forwardairLogo, hasBg: false },
  { name: 'Armstrong Transport Group', logo: armstrongLogo, hasBg: false },
  { name: 'RXO', logo: rxoLogo, hasBg: true },
  { name: 'Pegasus Logistics Group', logo: pegasusLogo, hasBg: true },
  { name: 'Bettaway Supply Chain', logo: bettawayLogo, hasBg: false },
  { name: 'EFW', logo: efwLogo, hasBg: false },
  { name: 'Aeronet Worldwide', logo: aeronetLogo, hasBg: true },
  { name: 'Stevens Global Logistics', logo: stevensglobalLogo, hasBg: true },
  { name: '007 Freight', logo: freightLogo, hasBg: false },
  { name: 'Brown Integrated Logistics', logo: brownLogo, hasBg: true },
  { name: 'Serve Freight', logo: servefreightLogo, hasBg: false },
];

const LogoItem = ({ partner }: { partner: typeof partners[0] }) => (
  <div className="flex-shrink-0 flex items-center justify-center px-8 md:px-12">
    <img
      src={partner.logo}
      alt={partner.name}
      title={partner.name}
      className="h-8 md:h-10 w-auto object-contain select-none"
      style={
        partner.hasBg
          ? {
              filter: 'grayscale(1) invert(1)',
              opacity: 0.45,
              mixBlendMode: 'screen' as const,
            }
          : {
              filter: 'grayscale(1) brightness(2)',
              opacity: 0.45,
            }
      }
      draggable={false}
    />
  </div>
);

export const Partners = () => {
  return (
    <section id="clients" className="py-16 bg-background overflow-hidden">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
          Trusted by industry leaders
        </p>
      </div>

      {/* Marquee Container */}
      <div className="relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* Scrolling track */}
        <div className="flex animate-marquee">
          {/* First set */}
          <div className="flex items-center flex-shrink-0">
            {partners.map((partner) => (
              <LogoItem key={`a-${partner.name}`} partner={partner} />
            ))}
          </div>
          {/* Duplicate for seamless loop */}
          <div className="flex items-center flex-shrink-0">
            {partners.map((partner) => (
              <LogoItem key={`b-${partner.name}`} partner={partner} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
