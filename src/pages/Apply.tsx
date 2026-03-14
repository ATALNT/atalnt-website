import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const Apply = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-40 pb-8 bg-gradient-card">
        <div className="container mx-auto px-6 text-center">
          <span className="text-gold font-semibold tracking-wider uppercase text-sm">
            Apply Now
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mt-4 mb-6">
            Submit Your
            <span className="text-gradient-gold"> Resume</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Fill out the form below and our team will match you with the right opportunity.
          </p>
        </div>
      </section>

      {/* Embedded Zoho Form */}
      <section className="py-8 pb-16">
        <div className="container mx-auto px-6">
          <div className="bg-card rounded-3xl border border-border p-4 md:p-8 overflow-hidden">
            <iframe
              aria-label="Recruiter Candidate Intake Form"
              frameBorder="0"
              style={{ width: '100%', minHeight: '1200px', border: 'none' }}
              src="https://forms.zohopublic.com/atalnt1/form/Candidateintakeform/formperma/-YlyEQ27YGiulK7mOmP95pvEd_tw_z6beK7MjVGZxcE"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Apply;
