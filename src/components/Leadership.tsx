import { Linkedin } from 'lucide-react';
import nikJainImg from '@/assets/nik-jain.png';
import kellyBrownImg from '@/assets/kelly-brown.jpg';
import lavanyaThatikondaImg from '@/assets/lavanya-thatikonda.jpeg';

const leaders = [
  {
    name: 'Kelly Brown',
    role: 'Founding Partner',
    bio: 'Founding Partner with over 15 years in global logistics and transportation recruiting. Kelly built her own agency from the ground up into a six-figure success, bringing resilience and relationship-driven strategies to ATALNT.',
    image: kellyBrownImg,
    objectPosition: 'object-[center_30%]',
    linkedin: 'https://www.linkedin.com/in/kellydockrell/',
  },
  {
    name: 'Lavanya Thatikonda',
    role: 'Principal Partner',
    bio: 'Principal Partner and serial entrepreneur with 16+ years scaling organizations and driving workforce growth. Lavanya has grown companies from 50 to 400+ employees, combining technology leadership with recruitment expertise at ATALNT.',
    image: lavanyaThatikondaImg,
    objectPosition: 'object-[center_15%] scale-[1.15] origin-top',
    linkedin: 'https://www.linkedin.com/in/lavanyapoosarla/',
  },
  {
    name: 'Nik Jain',
    role: 'Executive Partner',
    bio: 'Executive Partner with a diverse background in recruiting, logistics, and technology. Nik founded JP Recruiting Agency and now leads the AI practice at ATALNT, combining entrepreneurial vision with a servant-leadership approach to drive growth.',
    image: nikJainImg,
    objectPosition: 'object-[center_20%]',
    linkedin: 'https://www.linkedin.com/in/jainnik/',
  },
];

export const Leadership = () => {
  return (
    <section id="leadership" className="py-24 bg-gradient-card">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">Our Leadership</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
            Meet the Minds Behind
            <span className="text-gradient-gold"> ATALNT</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Industry veterans with decades of combined experience transforming 
            how companies find talent and leverage technology.
          </p>
        </div>

        {/* Leaders Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {leaders.map((leader, index) => (
            <div
              key={leader.name}
              className="group relative"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Image Container */}
              <div className="relative overflow-hidden rounded-2xl mb-6">
                <img
                  src={leader.image}
                  alt={leader.name}
                  className={`w-full aspect-[4/5] object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105 ${leader.objectPosition ?? 'object-center'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                
                {/* Social Links */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <a href={leader.linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gold flex items-center justify-center hover:bg-gold-light transition-colors">
                    <Linkedin className="w-5 h-5 text-primary-foreground" />
                  </a>
                </div>
              </div>

              {/* Info */}
              <h3 className="font-display text-2xl font-bold mb-1">{leader.name}</h3>
              <p className="text-gold font-medium mb-3">{leader.role}</p>
              <p className="text-muted-foreground">{leader.bio}</p>
            </div>
          ))}
        </div>

        {/* Join CTA */}
        <div className="text-center mt-16">
          <a
            href="https://admin-atalnt.zohobookings.com/#/4732308000000937030"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-gold text-primary-foreground font-semibold rounded-full hover:opacity-90 transition-opacity shadow-gold"
          >
            Join Our Team
          </a>
        </div>
      </div>
    </section>
  );
};
