import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-logistics.jpg';

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}>
        
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-6 py-24">
        <div className="max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">
              #1 Choice for Enterprise Logistics Solutions
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-slide-up">
            Technology & Talent
            <br />
            <span className="text-gradient-gold">Solutions</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            We help companies solve their toughest challenges: finding skilled talent, 
            building resilient systems, and staying ahead of disruption.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <a href="https://admin-atalnt.zohobookings.com/#/4732308000000813002" target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-gradient-gold text-primary-foreground font-semibold px-8 py-6 text-lg hover:opacity-90 transition-all shadow-gold">
                Accelerate Growth
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </a>
            <a href="/jobs">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-secondary px-8 py-6 text-lg">
                View Open Jobs
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </a>
          </div>
          <p className="text-sm text-muted-foreground mt-3 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            Browse roles from our client network that we're actively hiring for.
          </p>

        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-gold rounded-full" />
        </div>
      </div>
    </section>);

};