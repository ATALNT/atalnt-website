import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">Legal</span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
              Terms of <span className="text-gradient-gold">Service</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Last Updated: March 14, 2026
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-10">
            {/* Introduction */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <p className="text-muted-foreground leading-relaxed">
                Welcome to www.atalnt.com, operated by ATALNT ("we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of our website and services. By accessing or using our website, you agree to be bound by these Terms. If you do not agree, please do not use our website.
              </p>
            </div>

            {/* 1. Our Services */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">1.</span> Our Services
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                ATALNT provides technology and talent solutions, including staffing, AI automation, and consulting services. Our website allows you to learn about our services, submit job applications, use our ROI Calculator, and schedule consultations.
              </p>
            </div>

            {/* 2. Eligibility */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">2.</span> Eligibility
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By using our website, you represent that you are at least 16 years of age and have the legal capacity to enter into these Terms. If you are using our website on behalf of a company or organization, you represent that you have the authority to bind that entity to these Terms.
              </p>
            </div>

            {/* 3. Acceptable Use */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">3.</span> Acceptable Use
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree to use our website only for lawful purposes and in a manner that does not infringe the rights of, or restrict or inhibit the use and enjoyment of, the website by any third party. You agree not to:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Submit false, misleading, or fraudulent information through any form on our website</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Upload or transmit viruses, malware, or other harmful code</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Attempt to gain unauthorized access to our systems, servers, or networks</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Use our website to send unsolicited communications or spam</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Scrape, crawl, or use automated tools to extract data from our website without our written permission</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Interfere with or disrupt the operation of our website</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Use our website in any way that violates applicable local, state, national, or international law</span>
                </li>
              </ul>
            </div>

            {/* 4. Intellectual Property */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">4.</span> Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                All content on our website, including text, graphics, logos, images, software, and design elements, is the property of ATALNT or our licensors and is protected by United States and international copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, modify, create derivative works from, publicly display, or otherwise use any of our content without our prior written consent. The ATALNT name and logo are trademarks of ATALNT and may not be used without our permission.
              </p>
            </div>

            {/* 5. User-Submitted Content */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">5.</span> User-Submitted Content
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By submitting information through our website (including resumes, contact information, and ROI Calculator data), you grant ATALNT a non-exclusive, royalty-free right to use that information for the purposes described in our Privacy Policy, including processing applications, delivering services, and communicating with you. You are responsible for ensuring that any information you submit is accurate, current, and does not violate the rights of any third party.
              </p>
            </div>

            {/* 6. SMS/Text Messaging Terms */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">6.</span> SMS/Text Messaging Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                By providing your phone number and opting in to receive text messages from ATALNT, you agree to the following terms:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>You consent to receive recurring automated or prerecorded text messages from ATALNT at the phone number you provided. Consent is not a condition of any purchase or service.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Messages may relate to job applications, service inquiries, consultation scheduling, ROI Calculator follow-ups, and other communications about our services.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Message frequency varies. You may receive between 1 and 10 messages per month.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Message and data rates may apply. ATALNT does not charge for text messages, but your carrier's standard rates apply.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>To opt out, reply STOP to any text message from ATALNT. You will receive a single confirmation message and will no longer receive text messages from us unless you opt in again.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>For help, reply HELP or email privacy@atalnt.com.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>Carriers are not liable for delayed or undelivered messages.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-gold mt-1.5 text-xs">&#9679;</span>
                  <span>We may revise these SMS terms at any time. Continued receipt of messages after changes constitutes acceptance of the updated terms.</span>
                </li>
              </ul>
            </div>

            {/* 7. ROI Calculator */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">7.</span> ROI Calculator
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our ROI Calculator is provided as a tool to help you estimate potential value from our services. The results generated by the ROI Calculator are estimates only and are not guarantees of actual results, savings, or outcomes. Actual results will vary based on your specific circumstances, and ATALNT makes no warranties regarding the accuracy or reliability of the calculator's output.
              </p>
            </div>

            {/* 8. Third-Party Links and Services */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">8.</span> Third-Party Links and Services
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our website may contain links to third-party websites or services, including Zoho for application submissions and consultation booking. These third-party sites are not controlled by ATALNT, and we are not responsible for their content, privacy practices, or terms of use. We encourage you to review the terms and privacy policies of any third-party sites you visit.
              </p>
            </div>

            {/* 9. Disclaimer of Warranties */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">9.</span> Disclaimer of Warranties
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our website and services are provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. To the fullest extent permitted by law, ATALNT disclaims all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that our website will be uninterrupted, error-free, secure, or free of viruses or other harmful components.
              </p>
            </div>

            {/* 10. Limitation of Liability */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">10.</span> Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                To the fullest extent permitted by applicable law, ATALNT and its officers, directors, employees, agents, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities, arising out of or related to your use of our website or services. Our total liability to you for any claim arising from your use of our website or services shall not exceed the amount you paid to ATALNT, if any, during the 12 months preceding the claim.
              </p>
            </div>

            {/* 11. Indemnification */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">11.</span> Indemnification
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify, defend, and hold harmless ATALNT and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, or expenses (including reasonable attorneys' fees) arising out of or related to your use of our website, your violation of these Terms, or your violation of any rights of another party.
              </p>
            </div>

            {/* 12. Governing Law and Disputes */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">12.</span> Governing Law and Disputes
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law principles. Any disputes arising out of or relating to these Terms or your use of our website shall be resolved exclusively in the state or federal courts located in California, and you consent to the personal jurisdiction of those courts.
              </p>
            </div>

            {/* 13. Changes to These Terms */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">13.</span> Changes to These Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. When we make changes, we will update the "Last Updated" date at the top of this page. Your continued use of our website after any changes constitutes your acceptance of the updated Terms. We encourage you to review these Terms periodically.
              </p>
            </div>

            {/* 14. Severability */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">14.</span> Severability
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </div>

            {/* 15. Entire Agreement */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">15.</span> Entire Agreement
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and ATALNT regarding your use of our website and supersede any prior agreements or understandings.
              </p>
            </div>

            {/* 16. Contact Us */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-xl font-semibold mb-4">
                <span className="text-gold">16.</span> Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">ATALNT</p>
                <p>
                  Email:{' '}
                  <a href="mailto:privacy@atalnt.com" className="text-gold hover:underline">
                    privacy@atalnt.com
                  </a>
                </p>
                <p>
                  Website:{' '}
                  <a href="https://www.atalnt.com" className="text-gold hover:underline">
                    www.atalnt.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Terms;
