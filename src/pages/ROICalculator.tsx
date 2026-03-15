import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ArrowLeft,
  Calculator,
  Clock,
  DollarSign,
  TrendingUp,
  CalendarDays,
  Table2,
  MessageSquare,
  BarChart3,
  CreditCard,
  Search,
  CalendarCheck,
  CheckCircle2,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

const industries = [
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Accounting' },
  { value: 'realestate', label: 'Real Estate' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'staffing', label: 'Staffing & Recruiting' },
  { value: 'other', label: 'Other' },
];

const employeeRanges = [
  { value: '1-5', label: '1-5 employees' },
  { value: '6-15', label: '6-15 employees' },
  { value: '16-50', label: '16-50 employees' },
  { value: '51-100', label: '51-100 employees' },
  { value: '101-250', label: '101-250 employees' },
  { value: '250+', label: '250+ employees' },
];

const revenueRanges = [
  { value: 'under500k', label: 'Under $500K' },
  { value: '500k-1m', label: '$500K - $1M' },
  { value: '1m-5m', label: '$1M - $5M' },
  { value: '5m-10m', label: '$5M - $10M' },
  { value: '10m+', label: '$10M+' },
];

const workflows = [
  {
    id: 'data-entry',
    icon: Table2,
    title: 'Data Entry & Processing',
    description: 'Manual data input, spreadsheet management, copy-pasting between systems',
    hours: 12,
  },
  {
    id: 'customer-service',
    icon: MessageSquare,
    title: 'Customer Communication',
    description: 'Email responses, follow-ups, scheduling, and client onboarding',
    hours: 15,
  },
  {
    id: 'reporting',
    icon: BarChart3,
    title: 'Reporting & Analytics',
    description: 'Creating reports, pulling metrics, dashboards, and performance tracking',
    hours: 8,
  },
  {
    id: 'invoicing',
    icon: CreditCard,
    title: 'Invoicing & Billing',
    description: 'Invoice generation, payment tracking, reconciliation, and follow-ups',
    hours: 6,
  },
  {
    id: 'lead-gen',
    icon: Search,
    title: 'Lead Generation & Sales',
    description: 'Prospecting, lead qualification, CRM updates, and pipeline management',
    hours: 10,
  },
  {
    id: 'scheduling',
    icon: CalendarCheck,
    title: 'Scheduling & Coordination',
    description: 'Appointment booking, team coordination, calendar management',
    hours: 5,
  },
];

function formatNumber(num: number) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const ROICalculator = () => {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState('');
  const [employees, setEmployees] = useState('');
  const [avgSalary, setAvgSalary] = useState(35);
  const [revenue, setRevenue] = useState('');
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [manualHours, setManualHours] = useState(40);
  const [results, setResults] = useState<null | {
    annualSavings: number;
    monthlySavings: number;
    timeSaved: number;
    roiPercent: number;
    paybackMonths: number;
    recommendations: { name: string; desc: string; hours: number; savings: number }[];
  }>(null);

  // Lead form
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleWorkflow = (id: string) => {
    setSelectedWorkflows((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const goToStep = (s: number) => {
    if (s === 2 && (!industry || !employees)) return;
    setStep(s);
    if (s === 3) calculateROI();
    // Scroll to the calculator section, not the top of the page
    setTimeout(() => {
      const calcSection = document.getElementById('calculator-section');
      if (calcSection) {
        calcSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const calculateROI = () => {
    const selected = workflows.filter((w) => selectedWorkflows.includes(w.id));
    let workflowHours = selected.reduce((sum, w) => sum + w.hours, 0);

    const effectiveHoursSaved =
      workflowHours > 0
        ? Math.min(workflowHours, manualHours * 0.8)
        : manualHours * 0.3;

    const weeklySavings = effectiveHoursSaved * avgSalary;
    const monthlySavings = weeklySavings * 4.33;
    const annualSavings = monthlySavings * 12;

    let monthlyInvestment: number;
    switch (employees) {
      case '1-5': monthlyInvestment = 200; break;
      case '6-15': monthlyInvestment = 450; break;
      case '16-50': monthlyInvestment = 800; break;
      case '51-100': monthlyInvestment = 1500; break;
      case '101-250': monthlyInvestment = 3000; break;
      case '250+': monthlyInvestment = 5000; break;
      default: monthlyInvestment = 500;
    }

    const annualInvestment = monthlyInvestment * 12;
    const roiPercent = Math.round(((annualSavings - annualInvestment) / annualInvestment) * 100);
    const paybackMonths = monthlySavings > 0 ? Math.max(1, Math.round((monthlyInvestment / monthlySavings) * 2)) : 0;

    const recommendations = selected.length > 0
      ? selected.map((w) => ({
          name: w.title,
          desc: w.description,
          hours: w.hours,
          savings: Math.round(w.hours * avgSalary * 4.33 * 12),
        }))
      : [{
          name: 'Custom AI Workflow Analysis',
          desc: 'Book a strategy session to identify the highest-impact AI workflows for your specific business.',
          hours: Math.round(effectiveHoursSaved),
          savings: Math.round(annualSavings),
        }];

    setResults({
      annualSavings: Math.round(annualSavings),
      monthlySavings: Math.round(monthlySavings),
      timeSaved: Math.round(effectiveHoursSaved),
      roiPercent,
      paybackMonths,
      recommendations,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Submit to Zoho Forms
    const formData = new FormData();
    const nameParts = leadName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    formData.append('Name.first', firstName);
    formData.append('Name.last', lastName);
    formData.append('Email', leadEmail);
    formData.append('PhoneNumber', leadPhone);
    formData.append('SingleLine', leadCompany); // Company
    formData.append('SingleLine1', industry); // Industry
    formData.append('SingleLine2', String(employees)); // Employees
    formData.append('SingleLine3', results?.annualSavings ? `$${results.annualSavings.toLocaleString()}` : ''); // Annual Savings
    formData.append('MultiLine', selectedWorkflows.join(', ')); // Selected Workflows

    try {
      await fetch('https://forms.zoho.com/atalnt1/form/ROICalculatorLeadCapture/htmlRecords/submit', {
        method: 'POST',
        body: formData,
        mode: 'no-cors',
      });
    } catch (err) {
      console.error('Form submission error:', err);
    }

    // Track conversion in Zoho PageSense
    (window as any).pagesense = (window as any).pagesense || [];
    (window as any).pagesense.push(['trackEvent', 'roi_lead_submit']);

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-background to-background" />
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gold/10 rounded-full blur-[150px]" />
        <div className="container relative z-10 mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">AI-Powered Business Growth</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-slide-up">
            See How Much <span className="text-gradient-gold">AI Workflows</span>
            <br />Can Save Your Business
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Small and mid-size businesses are saving 20-40% on operational costs with AI automation. Calculate your personalized ROI in under 2 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {[
              { value: '85%', label: 'see ROI within 90 days' },
              { value: '30hrs', label: 'avg. time saved per week' },
              { value: '3.5x', label: 'average return on investment' },
            ].map((stat) => (
              <div key={stat.value} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gold font-display">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">How It Works</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
              Three Steps to <span className="text-gradient-gold">Transformation</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Calculator, num: '01', title: 'Calculate Your ROI', desc: 'Use our interactive calculator to see exactly how much time and money AI workflows can save your specific business.' },
              { icon: Users, num: '02', title: 'Strategy Session', desc: 'Meet with our AI specialists to map out the highest-impact workflows for your unique operations and goals.' },
              { icon: Zap, num: '03', title: 'Launch & Scale', desc: 'We implement, train your team, and continuously optimize your AI workflows to maximize results.' },
            ].map((item, i) => (
              <div key={item.num} className="group relative p-8 rounded-2xl bg-gradient-card border border-border hover:border-gold/50 transition-all duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                      <item.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-bold text-muted-foreground">{item.num}</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator-section" className="py-20 relative overflow-hidden scroll-mt-24">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-background to-background" />
        <div className="container relative z-10 mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">ROI Calculator</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
              Calculate Your <span className="text-gradient-gold">AI Savings</span>
            </h2>
            <p className="text-muted-foreground text-lg">Answer a few questions about your business and see your personalized ROI estimate in real time.</p>
          </div>

          <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-2xl bg-gradient-card border border-border">
            {/* Progress */}
            <div className="mb-10">
              <div className="h-1 bg-secondary rounded-full overflow-hidden mb-4">
                <div className="h-full bg-gradient-gold rounded-full transition-all duration-500" style={{ width: `${step * 33.33}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                {['1. Business Info', '2. Operations', '3. Your Results'].map((label, i) => (
                  <span key={label} className={i < step ? 'text-gold font-medium' : 'text-muted-foreground'}>{label}</span>
                ))}
              </div>
            </div>

            {/* Step 1 */}
            {step === 1 && (
              <div className="animate-fade-in">
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">What industry are you in?</label>
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:border-gold focus:outline-none transition-colors">
                      <option value="">Select your industry</option>
                      {industries.map((ind) => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">How many employees do you have?</label>
                    <select value={employees} onChange={(e) => setEmployees(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:border-gold focus:outline-none transition-colors">
                      <option value="">Select team size</option>
                      {employeeRanges.map((er) => <option key={er.value} value={er.value}>{er.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Average employee hourly cost ($)</label>
                    <input type="number" value={avgSalary} onChange={(e) => setAvgSalary(Number(e.target.value) || 0)} min={10} max={500} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:border-gold focus:outline-none transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Annual Revenue (approx.)</label>
                    <select value={revenue} onChange={(e) => setRevenue(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:border-gold focus:outline-none transition-colors">
                      <option value="">Select range</option>
                      {revenueRanges.map((rr) => <option key={rr.value} value={rr.value}>{rr.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => goToStep(2)} className="bg-gradient-gold text-primary-foreground font-semibold px-8 hover:opacity-90 transition-all shadow-gold">
                    Next: Operations <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="animate-fade-in">
                <p className="text-muted-foreground mb-6">Select the areas where your team spends the most manual time:</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {workflows.map((wf) => {
                    const selected = selectedWorkflows.includes(wf.id);
                    return (
                      <button key={wf.id} onClick={() => toggleWorkflow(wf.id)}
                        className={`text-left p-5 rounded-xl border transition-all duration-300 ${
                          selected
                            ? 'border-gold bg-gold/5 shadow-[0_0_20px_rgba(196,160,0,0.1)]'
                            : 'border-border bg-background hover:border-gold/30'
                        }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                          selected ? 'bg-gradient-gold shadow-gold' : 'bg-secondary'
                        }`}>
                          <wf.icon className={`w-5 h-5 ${selected ? 'text-primary-foreground' : 'text-gold'}`} />
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{wf.title}</h4>
                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{wf.description}</p>
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                          ~{wf.hours} hrs/week saved
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-8 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Total hours/week your team spends on manual tasks</label>
                  <input type="range" min={5} max={200} value={manualHours} onChange={(e) => setManualHours(Number(e.target.value))}
                    className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-gold [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:shadow-gold" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>5 hrs</span>
                    <span className="text-gold font-semibold">{manualHours} hrs/week</span>
                    <span>200 hrs</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => goToStep(1)} className="border-border hover:bg-secondary">
                    <ArrowLeft className="mr-2" size={18} /> Back
                  </Button>
                  <Button onClick={() => goToStep(3)} className="bg-gradient-gold text-primary-foreground font-semibold px-8 hover:opacity-90 transition-all shadow-gold">
                    See My Results <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Results */}
            {step === 3 && results && (
              <div className="animate-fade-in">
                {/* Main number */}
                <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 mb-8">
                  <p className="text-muted-foreground mb-2">Your Estimated AI ROI</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-gold">$</span>
                    <span className="text-5xl md:text-6xl font-extrabold text-gradient-gold font-display">{formatNumber(results.annualSavings)}</span>
                    <span className="text-lg text-muted-foreground ml-2">/year in savings</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { icon: Clock, value: String(results.timeSaved), label: 'Hours Saved/Week', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                    { icon: DollarSign, value: `$${formatNumber(results.monthlySavings)}`, label: 'Monthly Savings', color: 'text-gold', bg: 'bg-gold/10' },
                    { icon: TrendingUp, value: `${results.roiPercent}%`, label: 'Estimated ROI', color: 'text-violet-400', bg: 'bg-violet-400/10' },
                    { icon: CalendarDays, value: results.paybackMonths <= 1 ? '< 1 mo' : `${results.paybackMonths} mo`, label: 'Months to Payback', color: 'text-sky-400', bg: 'bg-sky-400/10' },
                  ].map((stat) => (
                    <div key={stat.label} className="p-5 rounded-xl bg-background border border-border text-center">
                      <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div className="text-2xl font-bold font-display">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                <div className="p-6 rounded-xl bg-background border border-border mb-8">
                  <h4 className="font-display font-bold text-lg mb-4">Your AI Workflow Recommendations</h4>
                  <div className="divide-y divide-border">
                    {results.recommendations.map((rec) => (
                      <div key={rec.name} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-semibold text-sm">{rec.name}</h5>
                          <p className="text-xs text-muted-foreground">{rec.desc}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-400 shrink-0">${formatNumber(rec.savings)}/yr</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lead Capture */}
                <div className="p-8 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 mb-8 text-center">
                  {!submitted ? (
                    <>
                      <Sparkles className="w-8 h-8 text-gold mx-auto mb-4" />
                      <h3 className="font-display text-2xl font-bold mb-2">Get Your Full ROI Report & Strategy Session</h3>
                      <p className="text-muted-foreground mb-6">We'll send you a detailed breakdown and schedule a free 30-minute consultation to map out your AI roadmap.</p>
                      <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
                        <div className="grid sm:grid-cols-2 gap-3 mb-3">
                          <input required value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Your Name" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                          <input required type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="Work Email" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 mb-4">
                          <input required value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} placeholder="Company Name" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                          <input type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Phone (optional)" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                        </div>
                        <Button type="submit" className="w-full bg-gradient-gold text-primary-foreground font-semibold py-6 text-lg hover:opacity-90 transition-all shadow-gold">
                          Book My Free Strategy Session <ArrowRight className="ml-2" size={20} />
                        </Button>
                        <p className="text-xs text-muted-foreground mt-3">No commitment required. We'll reach out within 24 hours.</p>
                      </form>
                    </>
                  ) : (
                    <div className="py-8">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                      <h3 className="font-display text-2xl font-bold text-emerald-400 mb-2">You're All Set!</h3>
                      <p className="text-muted-foreground">We've received your information and will be in touch within 24 hours to schedule your free strategy session.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => { setStep(2); setResults(null); }} className="border-border hover:bg-secondary">
                    <ArrowLeft className="mr-2" size={18} /> Adjust Inputs
                  </Button>
                  <a href="https://admin-atalnt.zohobookings.com/#/4732308000000813002" target="_blank" rel="noopener noreferrer">
                    <Button className="bg-gradient-gold text-primary-foreground font-semibold px-8 hover:opacity-90 transition-all shadow-gold">
                      Book a Meeting <ArrowRight className="ml-2" size={18} />
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-gold font-semibold tracking-wider uppercase text-sm">What Clients Say</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mt-4 mb-6">
              Real Results from <span className="text-gradient-gold">Real Businesses</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'We automated our entire client onboarding process. What used to take 3 hours now takes 15 minutes. The ROI calculator was spot on.',
                role: 'Operations Manager',
                company: 'Logistics Company, 45 employees',
              },
              {
                quote: "I was skeptical about AI, but the numbers don't lie. We're saving over $8,000/month on tasks that used to eat up our team's time.",
                role: 'Business Owner',
                company: 'Professional Services, 12 employees',
              },
              {
                quote: "The strategy session alone was worth it. They identified workflows I hadn't even considered automating. Game changer for our small team.",
                role: 'Founder & CEO',
                company: 'E-commerce Brand, 8 employees',
              },
            ].map((t) => (
              <div key={t.role} className="p-8 rounded-2xl bg-gradient-card border border-border hover:border-gold/50 transition-all duration-500">
                <div className="text-gold text-lg mb-4 tracking-wider">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p className="text-muted-foreground mb-6 leading-relaxed italic">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.role}</p>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gold/20 rounded-full blur-[120px]" />
        <div className="container relative z-10 mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Ready to See What AI Can Do for <span className="text-gradient-gold">Your Business</span>?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join hundreds of small and mid-size businesses already saving time and money with AI workflows.
          </p>
          <Button onClick={() => { setStep(1); setResults(null); setTimeout(() => { const el = document.getElementById('calculator-section'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }}
            size="lg" className="bg-gradient-gold text-primary-foreground font-semibold px-10 py-6 text-lg hover:opacity-90 transition-all shadow-gold">
            Calculate My ROI Now <ArrowRight className="ml-2" size={20} />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ROICalculator;
