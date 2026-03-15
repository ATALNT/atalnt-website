import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Target, Handshake, Lightbulb, TrendingUp, Users, Bot, Search } from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Results-Driven',
    description: 'Every engagement is measured by outcomes, not activity. We focus on delivering real, tangible value to every client we serve.',
  },
  {
    icon: Handshake,
    title: 'Relationship-First',
    description: 'We build lasting partnerships, not transactions. Our repeat client rate speaks to the trust we earn through consistent, high-quality delivery.',
  },
  {
    icon: Lightbulb,
    title: 'Innovation-Led',
    description: 'We stay ahead of industry shifts by investing in AI, automation, and data-driven strategies that give our clients a competitive edge.',
  },
  {
    icon: TrendingUp,
    title: 'Growth-Oriented',
    description: 'We help organizations scale with confidence — whether that means building a team of 5 or transforming operations for 500.',
  },
];

const capabilities = [
  {
    icon: Users,
    title: 'Talent Solutions',
    description: 'Direct hire, temp-to-perm, permanent placement, and staffing solutions across logistics, supply chain, accounting, and finance.',
  },
  {
    icon: Bot,
    title: 'Agentic AI & Custom Solutions',
    description: 'AI-powered workflows, custom integrations, and AI readiness initiatives that reduce manual work and uncover operational efficiencies.',
  },
  {
    icon: Search,
    title: 'AI Candidate Sourcing',
    description: 'Intelligent sourcing technology that identifies relevant candidates faster and streamlines hiring workflows at scale.',
  },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">About Us</span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mt-4 mb-6">
              Building the Future of{' '}
              <span className="text-gradient-gold">Enterprise Operations</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              ATALNT is a technology and talent solutions firm that helps companies solve their toughest
              challenges — finding skilled talent, building resilient systems, and staying ahead of disruption.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-4">
                Our <span className="text-gradient-gold">Mission</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                To empower organizations with the talent and technology they need to compete and win.
                We combine decades of industry expertise with cutting-edge AI to deliver solutions that
                drive measurable results — from filling critical roles in days to automating workflows
                that save thousands of hours annually.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-4">
                Our <span className="text-gradient-gold">Vision</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                To be the #1 choice for enterprise technology and talent solutions. We envision a world
                where businesses don't have to choose between speed and quality — where the right person
                and the right system are always within reach, powered by AI-driven intelligence and
                human expertise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16 bg-gradient-card">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-gold font-semibold tracking-wider uppercase text-sm">Our Story</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-4">
                From Recruiting Roots to{' '}
                <span className="text-gradient-gold">Enterprise Innovation</span>
              </h2>
            </div>
            <div className="space-y-6 text-muted-foreground leading-relaxed text-lg">
              <p>
                ATALNT was founded by a team of industry veterans who saw a fundamental gap in how
                companies approach talent acquisition and technology adoption. With over 30 years of
                combined experience spanning logistics, transportation, supply chain, and technology,
                our founding partners built ATALNT to bridge that gap.
              </p>
              <p>
                What started as a specialized recruiting firm has evolved into a full-service technology
                and talent solutions company. Today, we serve clients across logistics, supply chain,
                accounting, finance, and technology — delivering everything from direct-hire placements
                to enterprise AI implementations.
              </p>
              <p>
                Our leadership team brings a unique blend of entrepreneurial drive and enterprise-scale
                experience. We've built and scaled multiple businesses, grown organizations from 50 to
                400+ employees, and placed over 950 professionals in roles that matter. That combination
                of hands-on execution and strategic vision is what sets ATALNT apart.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">What Drives Us</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-4 mb-6">
              Our Core <span className="text-gradient-gold">Values</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value) => (
              <div
                key={value.title}
                className="group p-8 rounded-2xl bg-gradient-card border border-border hover:border-gold/50 transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold mb-5">
                  <value.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="py-24 bg-gradient-card">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">What We Do</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-4 mb-6">
              Our <span className="text-gradient-gold">Capabilities</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              We combine specialized recruiting, AI automation, and technology expertise to help businesses scale smarter.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="p-8 rounded-2xl bg-card border border-border"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold mb-6">
                  <cap.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold mb-3">{cap.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-card rounded-3xl border border-border p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="font-display text-4xl md:text-5xl font-bold text-gradient-gold mb-2">950+</div>
                <p className="text-muted-foreground font-medium">Placements</p>
              </div>
              <div>
                <div className="font-display text-4xl md:text-5xl font-bold text-gradient-gold mb-2">99%</div>
                <p className="text-muted-foreground font-medium">Client Retention</p>
              </div>
              <div>
                <div className="font-display text-4xl md:text-5xl font-bold text-gradient-gold mb-2">2</div>
                <p className="text-muted-foreground font-medium">Days to First Candidate</p>
              </div>
              <div>
                <div className="font-display text-4xl md:text-5xl font-bold text-gradient-gold mb-2">30+</div>
                <p className="text-muted-foreground font-medium">Years of Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-card">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Ready to Work with <span className="text-gradient-gold">ATALNT</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
            Whether you need to fill critical roles, automate operations, or build AI-powered workflows,
            we're ready to help you move forward.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://admin-atalnt.zohobookings.com/#/4732308000000813002" target="_blank" rel="noopener noreferrer">
              <button className="px-8 py-4 bg-gradient-gold text-primary-foreground font-semibold rounded-full hover:opacity-90 transition-opacity shadow-gold">
                Schedule a Consultation
              </button>
            </a>
            <a href="/jobs">
              <button className="px-8 py-4 border border-border text-foreground font-semibold rounded-full hover:bg-secondary transition-colors">
                View Open Jobs
              </button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
