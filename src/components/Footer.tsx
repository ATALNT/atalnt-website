import atalntLogo from '@/assets/atalnt-logo-transparent.png';

const footerLinks = {
  services: [
    { label: 'Talent Solutions', href: '/#services' },
    { label: 'Agentic AI & Custom Solutions', href: '/#services' },
    { label: 'AI Candidate Sourcing', href: '/#services' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Leadership', href: '/#leadership' },
    { label: 'Careers', href: '/jobs' },
    { label: 'Contact', href: '/contact' },
  ],
};

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const socialLinks = [
  {
    icon: XIcon,
    href: 'https://x.com/AtalntLLC',
    label: 'X',
  },
  {
    icon: LinkedInIcon,
    href: 'https://www.linkedin.com/company/atalntllc',
    label: 'LinkedIn',
  },
];

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-10 sm:py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center mb-6">
              <img src={atalntLogo} alt="ATALNT" className="h-[5.5rem] w-auto object-contain" />
            </a>
            <p className="text-muted-foreground mb-6 max-w-sm">
              The #1 choice for technology and talent solutions in logistics. 
              Building resilient teams and systems.
            </p>
            <div className="flex gap-4 mb-8">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-gold hover:text-primary-foreground transition-all"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>

            {/* Contact Info */}
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                1920 E NC Highway 54, STE 150
                <br />
                Durham, NC 27713
              </p>
              <p>
                <a href="tel:+17047412618" className="hover:text-gold transition-colors">+1 (704) 741-2618</a>
              </p>
              <p>
                <a href="mailto:admin@atalnt.com" className="hover:text-gold transition-colors">admin@atalnt.com</a>
              </p>
              <p className="pt-2 text-muted-foreground/80">
                Mon - Fri: 8:00 AM - 6:00 PM
              </p>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-semibold mb-4">Solutions</h4>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-gold transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-muted-foreground hover:text-gold transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Quick Reference */}
          <div>
            <h4 className="font-display font-semibold mb-4">Hours</h4>
            <ul className="space-y-3 text-muted-foreground">
              <li>Monday - Friday</li>
              <li>8:00 AM - 6:00 PM</li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} ATALNT. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-gold transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-gold transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
