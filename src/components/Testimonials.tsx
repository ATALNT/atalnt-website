import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "We struggled for months to find resources. ATALNT understood the skill sets we needed and delivered professionals who could hit the ground running from day 1.",
    author: 'Steve Morrison',
    role: 'VP of Operations',
    company: 'GlobalShip Logistics',
  },
  {
    quote: "ATALNT team made recruitment effortless. They managed the screening and only sent us candidates who were truly qualified. It saved my team countless hours.",
    author: 'Tom Mena',
    role: 'Director of Operations',
    company: 'TechFlow Supply',
  },
  {
    quote: "Every candidate we've hired through them has been accurate, detail-oriented, and committed. Their consistency gives me confidence that any future role will be filled just as well.",
    author: 'Emily Hudson',
    role: 'VP of Finance',
    company: 'LogiPrime Corp',
  },
];

export const Testimonials = () => {
  return (
    <section id="testimonials" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">Testimonials</span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
            Why Industry Leaders
            <span className="text-gradient-gold"> Choose ATALNT</span>
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.author}
              className="relative p-8 rounded-2xl bg-gradient-card border border-border hover:border-gold/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 left-8">
                <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center">
                  <Quote className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>

              {/* Content */}
              <p className="text-foreground text-lg leading-relaxed mb-8 mt-4">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center">
                  <span className="font-display font-bold text-primary-foreground">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <p className="text-sm text-gold">{testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
