import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">Legal</span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
              Privacy <span className="text-gradient-gold">Policy</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Last Updated: March 14, 2026
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Intro */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <p className="text-muted-foreground leading-relaxed">
                ATALNT ("we," "us," or "our") operates the website www.atalnt.com. This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you visit our website or use our services, including our staffing, AI automation, and consulting solutions.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By using our website or submitting your information to us, you agree to the practices described in this Privacy Policy.
              </p>
            </div>

            {/* Section 1 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">1.</span> Information We Collect
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We collect personal information that you voluntarily provide to us through the following channels:
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Resume and Job Application Submissions</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                When you apply for a position through our Zoho-powered application form, we collect your name, email address, phone number, and uploaded resume. Your resume may contain additional personal details such as work history, education, skills, and references.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">ROI Calculator</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                When you use our ROI Calculator tool and request results, we collect your name, email address, company name, and phone number.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Consultation Booking</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                When you schedule a consultation through our Zoho booking link, we collect the information you provide during the booking process, which may include your name, email address, phone number, and details about your inquiry.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Automatically Collected Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                When you visit our website, we may automatically collect certain technical information, including your IP address, browser type, device information, pages visited, referring URL, and the date and time of your visit.
              </p>
            </div>

            {/* Section 2 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">2.</span> How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li>To process job applications and match candidates with opportunities</li>
                <li>To deliver ROI Calculator results and follow up on your inquiry</li>
                <li>To schedule and conduct consultations</li>
                <li>To communicate with you about our services, including by phone, email, or text message</li>
                <li>To improve our website and services</li>
                <li>To comply with legal obligations</li>
                <li>To detect and prevent fraud or misuse of our services</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">3.</span> SMS/Text Messaging Consent and Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                By providing your phone number through any of our forms (application, ROI Calculator, or consultation booking), you may be offered the option to receive text messages from ATALNT.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Your Consent</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                By opting in to receive text messages, you expressly consent to receive recurring automated or prerecorded text messages from ATALNT at the phone number you provided. Your consent is not a condition of purchasing any goods or services from us.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Types of Messages</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Text messages may include follow-ups related to your job application, ROI Calculator results, consultation scheduling, service updates, and other communications related to our staffing, AI automation, and consulting services.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Message Frequency</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Message frequency varies depending on your interactions with us. Typically, you may receive between 1 and 10 messages per month.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Costs</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Message and data rates may apply depending on your mobile carrier and plan. ATALNT does not charge for text messages, but your carrier's standard messaging rates apply.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Opting Out</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                You can opt out of receiving text messages at any time by replying STOP to any message you receive from us. After opting out, you will receive a single confirmation message, and no further text messages will be sent unless you opt in again.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Help</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                For help with text messaging, reply HELP to any message or contact us at{' '}
                <a href="mailto:privacy@atalnt.com" className="text-gold hover:underline">privacy@atalnt.com</a>.
              </p>

              <h3 className="font-display text-lg font-semibold mb-2">Carrier Disclaimer</h3>
              <p className="text-muted-foreground leading-relaxed">
                Carriers are not liable for delayed or undelivered messages.
              </p>
            </div>

            {/* Section 4 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">4.</span> Cookies and Tracking Technologies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Our website may use cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and understand how visitors interact with our website.
              </p>

              <h3 className="font-display text-lg font-semibold mb-3">Types of Cookies We Use:</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed mb-6">
                <li><span className="text-foreground font-medium">Essential Cookies:</span> Required for the website to function properly.</li>
                <li><span className="text-foreground font-medium">Analytics Cookies:</span> Help us understand how visitors use our website so we can improve it.</li>
                <li><span className="text-foreground font-medium">Functional Cookies:</span> Remember your preferences and settings.</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mb-2">Managing Cookies</h3>
              <p className="text-muted-foreground leading-relaxed">
                You can control cookies through your browser settings. Most browsers allow you to refuse cookies or alert you when cookies are being sent. Please note that disabling cookies may affect the functionality of certain parts of our website.
              </p>
            </div>

            {/* Section 5 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">5.</span> Third-Party Services
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use third-party service providers to help us operate our business and deliver our services. These include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed mb-6">
                <li><span className="text-foreground font-medium">Zoho:</span> We use Zoho for job application forms, consultation booking, and customer relationship management. Information you submit through these tools is processed and stored by Zoho in accordance with their privacy policy.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may also use third-party tools for website analytics, email delivery, and other operational purposes.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell your personal information to third parties. We may share your information with third-party service providers only as necessary to perform services on our behalf, and they are required to protect your information consistent with this Privacy Policy.
              </p>
            </div>

            {/* Section 6 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">6.</span> Data Retention
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We retain your personal information for as long as necessary to fulfill the purposes described in this Privacy Policy, unless a longer retention period is required or permitted by law.
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
                <li>Resume and application data is retained for up to 24 months after submission to facilitate potential future opportunities, unless you request earlier deletion.</li>
                <li>ROI Calculator and consultation inquiry data is retained for up to 24 months.</li>
                <li>You may request deletion of your data at any time by contacting us at{' '}
                  <a href="mailto:privacy@atalnt.com" className="text-gold hover:underline">privacy@atalnt.com</a>.
                </li>
              </ul>
            </div>

            {/* Section 7 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">7.</span> Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement reasonable administrative, technical, and physical security measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.
              </p>
            </div>

            {/* Section 8 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">8.</span> Your Rights Under the California Consumer Privacy Act (CCPA)
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you are a California resident, you have the following rights under the CCPA:
              </p>
              <ul className="list-disc list-inside space-y-3 text-muted-foreground leading-relaxed mb-6">
                <li><span className="text-foreground font-medium">Right to Know:</span> You have the right to request that we disclose the categories and specific pieces of personal information we have collected about you, the categories of sources from which the information was collected, the business purpose for collecting the information, and the categories of third parties with whom we share the information.</li>
                <li><span className="text-foreground font-medium">Right to Delete:</span> You have the right to request that we delete the personal information we have collected from you, subject to certain exceptions permitted by law.</li>
                <li><span className="text-foreground font-medium">Right to Opt Out of Sale:</span> We do not sell your personal information. If this practice changes, we will update this Privacy Policy and provide you with the ability to opt out.</li>
                <li><span className="text-foreground font-medium">Right to Non-Discrimination:</span> We will not discriminate against you for exercising any of your CCPA rights.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:privacy@atalnt.com" className="text-gold hover:underline">privacy@atalnt.com</a>.
                {' '}We will respond to verified requests within 45 days as required by law.
              </p>
            </div>

            {/* Section 9 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">9.</span> Children's Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our website and services are not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us at{' '}
                <a href="mailto:privacy@atalnt.com" className="text-gold hover:underline">privacy@atalnt.com</a>
                {' '}and we will promptly delete the information.
              </p>
            </div>

            {/* Section 10 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">10.</span> Changes to This Privacy Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. The updated policy will be posted on this page with a revised "Last Updated" date. We encourage you to review this Privacy Policy periodically.
              </p>
            </div>

            {/* Section 11 */}
            <div className="p-8 rounded-2xl bg-gradient-card border border-border">
              <h2 className="font-display text-2xl font-bold mb-6">
                <span className="text-gold">11.</span> Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="space-y-2 text-muted-foreground">
                <p className="text-foreground font-semibold text-lg">ATALNT</p>
                <p>
                  Email:{' '}
                  <a href="mailto:privacy@atalnt.com" className="text-gold hover:underline">privacy@atalnt.com</a>
                </p>
                <p>
                  Website:{' '}
                  <a href="https://www.atalnt.com" className="text-gold hover:underline">www.atalnt.com</a>
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

export default Privacy;
