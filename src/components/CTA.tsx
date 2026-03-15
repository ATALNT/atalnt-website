import { ArrowRight, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CTA = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gold/20 rounded-full blur-[120px]" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-8">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">
              Ready to Transform Your Operations?
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Let's Build Something
            <span className="text-gradient-gold"> Extraordinary</span>
          </h2>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Partner with us to unlock your company's full potential. 
            From talent to technology, we deliver solutions that drive real results.
            Explore open roles from our client network or schedule a consultation.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <a href="/roi-calculator">
              <Button
                size="lg"
                className="bg-gradient-gold text-primary-foreground font-semibold px-8 py-6 text-lg hover:opacity-90 transition-all shadow-gold"
              >
                Calculate Your AI ROI
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </a>
            <a href="https://atalnt.zohorecruit.com/jobs/Careers" target="_blank" rel="noopener noreferrer">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-border text-foreground hover:bg-secondary px-8 py-6 text-lg"
              >
                View Open Jobs
              </Button>
            </a>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap justify-center gap-8 text-muted-foreground">
            <a href="tel:+17047412618" className="flex items-center gap-2 hover:text-gold transition-colors">
              <Phone size={18} />
              <span>+1 (704) 741-2618</span>
            </a>
            <a href="mailto:admin@atalnt.com" className="flex items-center gap-2 hover:text-gold transition-colors">
              <Mail size={18} />
              <span>admin@atalnt.com</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
