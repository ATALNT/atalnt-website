import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const contactInfo = [
  {
    icon: MapPin,
    label: 'Address',
    value: '1920 E NC Highway 54, STE 150\nDurham, NC 27713',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '+1 (704) 741-2618',
    href: 'tel:+17047412618',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'admin@atalnt.com',
    href: 'mailto:admin@atalnt.com',
  },
  {
    icon: Clock,
    label: 'Hours of Operation',
    value: 'Mon - Fri: 8:00 AM - 6:00 PM',
  },
];

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">Get in Touch</span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-6">
              Contact <span className="text-gradient-gold">Us</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Reach out to learn how ATALNT can help your business find the right talent and technology solutions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {contactInfo.map((item) => (
              <div
                key={item.label}
                className="p-5 sm:p-8 rounded-2xl bg-gradient-card border border-border"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold mb-5">
                  <item.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{item.label}</h3>
                {item.href ? (
                  <a href={item.href} className="text-muted-foreground hover:text-gold transition-colors whitespace-pre-line">
                    {item.value}
                  </a>
                ) : (
                  <p className="text-muted-foreground whitespace-pre-line">{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
