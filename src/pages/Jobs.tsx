import { useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Jobs = () => {
  useEffect(() => {
    // Load Zoho Recruit embed CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://static.zohocdn.com/recruit/embed_careers_site/css/v1.1/embed_jobs.css';
    link.type = 'text/css';
    document.head.appendChild(link);

    // Load Zoho Recruit embed JS
    const script = document.createElement('script');
    script.src = 'https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js';
    script.type = 'text/javascript';
    script.onload = () => {
      // Initialize the widget once script is loaded
      if ((window as any).rec_embed_js) {
        (window as any).rec_embed_js.load({
          widget_id: 'rec_job_listing_div',
          page_name: 'Careers',
          source: 'CareerSite',
          site: 'https://atalnt.zohorecruit.com',
          brand_color: '#D4A853',
          empty_job_msg: 'No current Openings',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 md:pt-40 pb-12 md:pb-16 bg-gradient-card">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">
            Careers
          </span>
          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold mt-4 mb-4 md:mb-6">
            Join Our
            <span className="text-gradient-gold"> Growing Team</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-6 md:mb-8">
            Browse open roles from our client network. We connect top talent
            with leading companies in logistics, technology, and beyond.
          </p>
          <a href="/apply">
            <Button
              size="lg"
              className="bg-gradient-gold text-primary-foreground font-semibold px-6 md:px-8 py-5 md:py-6 text-base md:text-lg hover:opacity-90 transition-all shadow-gold"
            >
              Submit Your Resume
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </a>
        </div>
      </section>

      {/* Zoho Recruit Embedded Jobs */}
      <section className="py-8 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-6 md:p-12 overflow-x-auto">
            <div className="embed_jobs_head embed_jobs_with_style_3">
              <div className="embed_jobs_head2">
                <div className="embed_jobs_head3">
                  <div id="rec_job_listing_div"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-gradient-card">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="font-display text-2xl md:text-4xl font-bold mb-4">
            Don't See the Right Fit?
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-6 md:mb-8">
            We're always looking for exceptional talent. Reach out and let's find
            the perfect opportunity for you.
          </p>
          <a href="/apply">
            <Button
              size="lg"
              className="bg-gradient-gold text-primary-foreground font-semibold px-6 md:px-8 py-5 md:py-6 text-base md:text-lg hover:opacity-90 transition-all shadow-gold"
            >
              Get in Touch
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Jobs;
