import { useEffect, useState, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Jobs = () => {
  const [modalUrl, setModalUrl] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setModalUrl(null);
    document.body.style.overflow = '';
  }, []);

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
          brand_color: '#C42104',
          empty_job_msg: 'No current Openings',
        });
      }
    };
    document.body.appendChild(script);

    // Intercept clicks on job links to open in modal instead
    const handleJobClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href*="zohorecruit.com/jobs"]') as HTMLAnchorElement;
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
        setModalUrl(anchor.href);
        document.body.style.overflow = 'hidden';
      }
    };

    // Use a MutationObserver to attach the listener once the widget loads
    const container = document.getElementById('rec_job_listing_div');
    if (container) {
      container.addEventListener('click', handleJobClick, true);
    }

    // Also attach to document for safety (capture phase)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('#rec_job_listing_div a[href*="zohorecruit.com/jobs"]') as HTMLAnchorElement;
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
        setModalUrl(anchor.href);
        document.body.style.overflow = 'hidden';
      }
    }, true);

    return () => {
      // Cleanup
      document.head.removeChild(link);
      document.body.removeChild(script);
      document.body.style.overflow = '';
    };
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (modalUrl) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [modalUrl, closeModal]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-40 pb-16 bg-gradient-card">
        <div className="container mx-auto px-6 text-center">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">
            Careers
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mt-4 mb-6">
            Join Our
            <span className="text-gradient-gold"> Growing Team</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Browse open roles from our client network. We connect top talent
            with leading companies in logistics, technology, and beyond.
          </p>
          <a href="https://admin-atalnt.zohobookings.com/#/4732308000000813002" target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-gradient-gold text-primary-foreground font-semibold px-8 py-6 text-lg hover:opacity-90 transition-all shadow-gold"
            >
              Submit Your Resume
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </a>
        </div>
      </section>

      {/* Zoho Recruit Embedded Jobs */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="bg-card rounded-3xl border border-border p-8 md:p-12">
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
      <section className="py-16 bg-gradient-card">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Don't See the Right Fit?
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            We're always looking for exceptional talent. Reach out and let's find
            the perfect opportunity for you.
          </p>
          <a href="https://admin-atalnt.zohobookings.com/#/4732308000000813002" target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-gradient-gold text-primary-foreground font-semibold px-8 py-6 text-lg hover:opacity-90 transition-all shadow-gold"
            >
              Get in Touch
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </a>
        </div>
      </section>

      <Footer />

      {/* Job Detail Modal */}
      {modalUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={closeModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Modal Content */}
          <div
            className="relative z-10 w-full max-w-4xl h-[85vh] mx-4 rounded-2xl overflow-hidden border border-border bg-background shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
              <h3 className="font-display font-semibold text-lg">Job Details</h3>
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-all"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Iframe */}
            <iframe
              src={modalUrl}
              className="w-full h-[calc(85vh-65px)] bg-white"
              title="Job Details"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;
