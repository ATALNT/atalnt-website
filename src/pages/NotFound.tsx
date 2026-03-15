import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-24">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <div className="font-display text-8xl md:text-9xl font-bold text-gradient-gold mb-6">
              404
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Page Not Found
            </h1>
            <p className="text-muted-foreground text-lg mb-10">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/">
                <Button
                  size="lg"
                  className="bg-gradient-gold text-primary-foreground font-semibold px-8 hover:opacity-90 transition-all shadow-gold"
                >
                  Back to Home
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </a>
              <a href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border text-foreground hover:bg-secondary"
                >
                  Contact Us
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default NotFound;
