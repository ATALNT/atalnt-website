import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Stats } from '@/components/Stats';
import { Partners } from '@/components/Partners';
import { Services } from '@/components/Services';
import { Leadership } from '@/components/Leadership';
import { Testimonials } from '@/components/Testimonials';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Partners />
      <Stats />
      <Services />
      <Testimonials />
      <Leadership />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
