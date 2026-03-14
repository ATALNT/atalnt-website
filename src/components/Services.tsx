import { Users, Bot, Search, ArrowUpRight } from 'lucide-react';

const services = [
  {
    icon: Users,
    title: 'Talent Solutions',
    description: 'We specialize in talent acquisition across logistics, supply chain, accounting, and finance. Our services include direct hire, temp-to-perm, permanent placement, and staffing solutions tailored to each client\'s needs.',
    features: ['Direct Hire', 'Temp-to-Perm', 'Permanent Placement', 'Staffing Solutions'],
  },
  {
    icon: Bot,
    title: 'Agentic AI & Custom Solutions',
    description: 'We help businesses uncover inefficiencies, reduce manual work, and implement AI-powered workflows. From custom integrations to AI readiness initiatives, we build tailored solutions that fit your unique business needs.',
    features: ['Agentic AI', 'AI Workflows', 'AI Readiness', 'Custom Integrations'],
  },
  {
    icon: Search,
    title: 'AI Candidate Sourcing',
    description: 'Our AI-powered sourcing solution helps hiring teams identify relevant candidates faster for specific roles. It is built to improve candidate discovery and streamline sourcing workflows.',
    features: ['AI-Powered Sourcing', 'Candidate Discovery', 'Role Matching', 'Workflow Automation'],
  },
];

export const Services = () => {
  return (
    <section id="services" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">What We Offer</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
            Our
            <span className="text-gradient-gold"> Solutions</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            We combine specialized recruiting, AI automation, and CRM expertise to help businesses scale smarter.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group relative p-8 rounded-2xl bg-gradient-card border border-border hover:border-gold/50 transition-all duration-500 overflow-hidden"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                    <service.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <ArrowUpRight className="w-6 h-6 text-muted-foreground group-hover:text-gold group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>

                <h3 className="font-display text-2xl font-bold mb-3 group-hover:text-gradient-gold transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {service.description}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {service.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 text-sm bg-secondary rounded-full text-muted-foreground"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
