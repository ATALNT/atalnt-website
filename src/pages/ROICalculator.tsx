import { useState, useMemo } from 'react';
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
  CheckCircle2,
  Sparkles,
  Users,
  Zap,
  AlertTriangle,
  UserCog,
  Lightbulb,
} from 'lucide-react';
import { industryConfigs, employeeRanges, monthlyInvestmentBySize } from '@/data/industryData';

function formatNumber(num: number) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface EnhancedResults {
  annualSavings: number;
  monthlySavings: number;
  timeSavedPerWeek: number;
  roiPercent: number;
  paybackMonths: number;
  errorCostSavings: number;
  costOfWaiting: number;
  industryBenchmark: number;
  recommendations: {
    name: string;
    description: string;
    hoursPerWeek: number;
    annualSavings: number;
    priority: number;
    errorReduction: number;
  }[];
}

const UPSELL_THRESHOLD = 75000;

const ROICalculator = () => {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState('');
  const [employees, setEmployees] = useState('');
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [manualHours, setManualHours] = useState(40);
  const [results, setResults] = useState<EnhancedResults | null>(null);

  // Lead form
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadTitle, setLeadTitle] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const currentIndustry = useMemo(
    () => industryConfigs.find((c) => c.value === industry),
    [industry]
  );

  const currentWorkflows = currentIndustry?.workflows ?? [];

  const toggleWorkflow = (id: string) => {
    setSelectedWorkflows((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const handleIndustryChange = (value: string) => {
    setIndustry(value);
    setSelectedWorkflows([]);
  };

  const goToStep = (s: number) => {
    if (s === 2 && (!industry || !employees)) return;
    setStep(s);
    if (s === 3) calculateROI();
    setTimeout(() => {
      const calcSection = document.getElementById('calculator-section');
      if (calcSection) {
        calcSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const calculateROI = () => {
    if (!currentIndustry) return;

    const avgRate = currentIndustry.avgHourlyRate;
    const selected = currentWorkflows.filter((w) => selectedWorkflows.includes(w.id));
    const workflowHours = selected.reduce((sum, w) => sum + w.hoursPerWeek, 0);

    const effectiveHoursSaved =
      workflowHours > 0
        ? Math.min(workflowHours, manualHours * 0.8)
        : manualHours * 0.3;

    const weeklySavings = effectiveHoursSaved * avgRate;
    const monthlySavings = weeklySavings * 4.33;
    const annualSavings = monthlySavings * 12;

    // Error cost savings (rework, corrections = 15% on top)
    const errorCostSavings = Math.round(annualSavings * 0.15);
    const totalAnnualSavings = Math.round(annualSavings + errorCostSavings);

    const monthlyInvestment = monthlyInvestmentBySize[employees] ?? 500;
    const annualInvestment = monthlyInvestment * 12;
    const roiPercent = Math.round(((totalAnnualSavings - annualInvestment) / annualInvestment) * 100);
    const paybackMonths = monthlySavings > 0 ? Math.max(1, Math.round((monthlyInvestment / (monthlySavings * 1.15)) * 2)) : 0;

    const costOfWaiting = Math.round(totalAnnualSavings / 4);

    const recommendations = selected.length > 0
      ? selected
          .map((w) => ({
            name: w.title,
            description: w.description,
            hoursPerWeek: w.hoursPerWeek,
            annualSavings: Math.round(w.hoursPerWeek * avgRate * 4.33 * 12 * 1.15),
            priority: w.priority,
            errorReduction: w.errorReductionPercent,
          }))
          .sort((a, b) => a.priority - b.priority)
      : [{
          name: 'Custom AI Workflow Analysis',
          description: 'Book a strategy session to identify the highest-impact AI workflows for your specific business.',
          hoursPerWeek: Math.round(effectiveHoursSaved),
          annualSavings: totalAnnualSavings,
          priority: 1,
          errorReduction: 80,
        }];

    setResults({
      annualSavings: totalAnnualSavings,
      monthlySavings: Math.round(monthlySavings * 1.15),
      timeSavedPerWeek: Math.round(effectiveHoursSaved),
      roiPercent,
      paybackMonths,
      errorCostSavings,
      costOfWaiting,
      industryBenchmark: currentIndustry.benchmarkSavingsPercent,
      recommendations,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const iframeName = 'zoho_form_submit_iframe';
    let iframe = document.getElementById(iframeName) as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = iframeName;
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const nameParts = leadName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build rich workflow details for submission
    const workflowDetails = results?.recommendations
      .map((r) => `${r.name} (${r.hoursPerWeek} hrs/wk, $${formatNumber(r.annualSavings)}/yr)`)
      .join('; ') ?? '';

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://forms.zohopublic.com/atalnt1/form/ROICalculatorLeadCapture/formperma/HPwyHwt7nxNA-qBRiUnrghDyNoVH1Nh8ymoiTGJEgl4/htmlRecords/submit';
    form.target = iframeName;
    form.acceptCharset = 'UTF-8';
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';

    const fields: Record<string, string> = {
      'zf_referrer_name': '',
      'zf_redirect_url': '',
      'zc_gad': '',
      'Name_First': firstName,
      'Name_Last': lastName,
      'Email': leadEmail,
      'PhoneNumber_countrycode': leadPhone,
      'SingleLine': leadCompany,
      'SingleLine1': currentIndustry?.label ?? industry,
      'SingleLine2': employees,
      'SingleLine3': results?.annualSavings ? `$${formatNumber(results.annualSavings)}` : '',
      'MultiLine': workflowDetails,
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      document.body.removeChild(form);
    }, 1000);

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
            Get a personalized AI automation roadmap tailored to your industry. Calculate your savings in under 2 minutes.
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
              { icon: Calculator, num: '01', title: 'Tell Us About Your Business', desc: 'Select your industry and team size. We\'ll show you the exact workflows AI can automate in your vertical.' },
              { icon: Users, num: '02', title: 'Pick Your Pain Points', desc: 'Choose the manual tasks eating up your team\'s time. We\'ll calculate exactly how much each one costs you.' },
              { icon: Zap, num: '03', title: 'Get Your AI Roadmap', desc: 'See your personalized savings estimate and a prioritized automation plan built for your industry.' },
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
            <p className="text-muted-foreground text-lg">Answer a few questions about your business and get a personalized AI automation roadmap.</p>
          </div>

          <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-2xl bg-gradient-card border border-border">
            {/* Progress */}
            <div className="mb-10">
              <div className="h-1 bg-secondary rounded-full overflow-hidden mb-4">
                <div className="h-full bg-gradient-gold rounded-full transition-all duration-500" style={{ width: `${step * 33.33}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                {['1. Your Business', '2. Pain Points', '3. Your AI Roadmap'].map((label, i) => (
                  <span key={label} className={i < step ? 'text-gold font-medium' : 'text-muted-foreground'}>{label}</span>
                ))}
              </div>
            </div>

            {/* Step 1: Business Info */}
            {step === 1 && (
              <div className="animate-fade-in">
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">What industry are you in?</label>
                    <select value={industry} onChange={(e) => handleIndustryChange(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:border-gold focus:outline-none transition-colors">
                      <option value="">Select your industry</option>
                      {industryConfigs.map((ind) => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Company headcount</label>
                    <select value={employees} onChange={(e) => setEmployees(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:border-gold focus:outline-none transition-colors">
                      <option value="">Select headcount</option>
                      {employeeRanges.map((er) => <option key={er.value} value={er.value}>{er.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Industry Hero Stat */}
                {currentIndustry && (
                  <div className="animate-fade-in p-5 rounded-xl bg-gold/5 border border-gold/20 mb-8">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gold mb-1">Did you know?</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{currentIndustry.heroStat}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => goToStep(2)} className="bg-gradient-gold text-primary-foreground font-semibold px-8 hover:opacity-90 transition-all shadow-gold">
                    Next: Select Pain Points <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Industry-Specific Workflows */}
            {step === 2 && (
              <div className="animate-fade-in">
                <p className="text-muted-foreground mb-6">
                  Select the areas where your <span className="text-gold font-semibold">{currentIndustry?.label}</span> team spends the most manual time:
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {currentWorkflows.map((wf) => {
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                            ~{wf.hoursPerWeek} hrs/week saved
                          </span>
                          <span className="text-xs font-semibold text-violet-400 bg-violet-400/10 px-2 py-1 rounded-full">
                            {wf.errorReductionPercent}% fewer errors
                          </span>
                        </div>
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
                    See My AI Roadmap <ArrowRight className="ml-2" size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Results */}
            {step === 3 && results && (
              <div className="animate-fade-in">
                {/* A) Hero ROI Number */}
                <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 mb-8">
                  <p className="text-muted-foreground mb-2">Your Estimated Annual AI Savings</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-gold">$</span>
                    <span className="text-5xl md:text-6xl font-extrabold text-gradient-gold font-display">{formatNumber(results.annualSavings)}</span>
                    <span className="text-lg text-muted-foreground ml-2">/year</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Based on <span className="text-gold">{currentIndustry?.label}</span> industry benchmarks and your team size
                  </p>
                </div>

                {/* B) Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[
                    { icon: Clock, value: String(results.timeSavedPerWeek), label: 'Hours Saved/Week', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                    { icon: DollarSign, value: `$${formatNumber(results.monthlySavings)}`, label: 'Monthly Savings', color: 'text-gold', bg: 'bg-gold/10' },
                    { icon: TrendingUp, value: `${results.roiPercent}%`, label: 'Estimated ROI', color: 'text-violet-400', bg: 'bg-violet-400/10' },
                    { icon: CalendarDays, value: results.paybackMonths <= 1 ? '< 1 mo' : `${results.paybackMonths} mo`, label: 'Payback Period', color: 'text-sky-400', bg: 'bg-sky-400/10' },
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

                {/* C) AI Automation Roadmap */}
                <div className="p-6 rounded-xl bg-background border border-border mb-8">
                  <h4 className="font-display font-bold text-lg mb-2">Your AI Automation Roadmap</h4>
                  <p className="text-xs text-muted-foreground mb-5">Prioritized by impact — start at the top for fastest results.</p>
                  <div className="space-y-4">
                    {results.recommendations.map((rec, i) => {
                      const maxSavings = Math.max(...results.recommendations.map((r) => r.annualSavings));
                      const barWidth = maxSavings > 0 ? (rec.annualSavings / maxSavings) * 100 : 0;
                      return (
                        <div key={rec.name} className="p-4 rounded-xl border border-border hover:border-gold/30 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="shrink-0">
                              {i === 0 ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-gold text-primary-foreground text-xs font-bold shadow-gold">
                                  <Zap className="w-3 h-3" /> Start Here
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-bold">
                                  Phase {i + 1}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h5 className="font-semibold text-sm">{rec.name}</h5>
                                <span className="text-sm font-bold text-emerald-400 shrink-0 ml-2">${formatNumber(rec.annualSavings)}/yr</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                              <div className="flex items-center gap-4 mb-2">
                                <span className="text-xs text-muted-foreground">{rec.hoursPerWeek} hrs/week saved</span>
                                <span className="text-xs text-muted-foreground">{rec.errorReduction}% error reduction</span>
                              </div>
                              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-400 to-gold rounded-full transition-all duration-700"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Estimated payback period: <span className="text-gold font-semibold">{results.paybackMonths <= 1 ? 'Less than 1 month' : `${results.paybackMonths} months`}</span>
                    </p>
                  </div>
                </div>

                {/* D) What You're Losing by Waiting */}
                <div className="p-6 rounded-xl border border-amber-500/30 bg-amber-500/5 mb-8">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-display font-bold text-lg text-amber-400 mb-2">What You're Losing by Waiting</h4>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-2xl font-bold text-amber-400 font-display">${formatNumber(results.monthlySavings)}</p>
                          <p className="text-xs text-muted-foreground">lost every month you delay</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-400 font-display">${formatNumber(results.costOfWaiting)}</p>
                          <p className="text-xs text-muted-foreground">lost in the next 3 months</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-amber-400 font-display">${formatNumber(results.annualSavings)}</p>
                          <p className="text-xs text-muted-foreground">left on the table this year</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* E) Smart Upsell: Dedicated AI Engineer */}
                {results.annualSavings >= UPSELL_THRESHOLD ? (
                  <div className="p-6 rounded-xl border-2 border-gold/50 bg-gradient-to-br from-gold/10 to-gold/5 mb-8">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
                        <UserCog className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-display font-bold text-lg">Your Savings Justify a Dedicated AI Resource</h4>
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-gradient-gold text-primary-foreground">Recommended</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                          Companies saving ${formatNumber(UPSELL_THRESHOLD)}+ per year see 3x faster implementation with a dedicated ATALNT AI Engineer embedded in their team. Get a full-time AI specialist who knows {currentIndustry?.label?.toLowerCase()}, builds custom automations, and continuously optimizes your workflows.
                        </p>
                        <a href="https://admin-atalnt.zohobookings.com/#/4732308000000813002" target="_blank" rel="noopener noreferrer">
                          <Button className="bg-gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-all shadow-gold">
                            Explore Dedicated AI Engineering <ArrowRight className="ml-2" size={16} />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl border border-border bg-background mb-8">
                    <div className="flex items-start gap-3">
                      <UserCog className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-semibold text-sm mb-1">Scale with a Dedicated AI Engineer</h5>
                        <p className="text-xs text-muted-foreground">As your automation grows, consider a dedicated ATALNT AI resource to maximize ROI and continuously optimize your workflows.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* F) Lead Capture */}
                <div className="p-8 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 mb-8 text-center">
                  {!submitted ? (
                    <>
                      <Sparkles className="w-8 h-8 text-gold mx-auto mb-4" />
                      <h3 className="font-display text-2xl font-bold mb-2">Get Your Full ROI Report & Strategy Session</h3>
                      <p className="text-muted-foreground mb-6">We'll send you a detailed breakdown and schedule a free 30-minute consultation to map out your AI roadmap.</p>
                      <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
                        <div className="grid sm:grid-cols-2 gap-3 mb-3">
                          <input required value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Full Name" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                          <input required type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="Work Email" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 mb-3">
                          <input required value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} placeholder="Company Name" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                          <input value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)} placeholder="Job Title (optional)" className="px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
                        </div>
                        <div className="mb-4">
                          <input type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Phone (optional)" className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none transition-colors" />
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

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gold/20 rounded-full blur-[120px]" />
        <div className="container relative z-10 mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Ready to See What AI Can Do for <span className="text-gradient-gold">Your Business</span>?
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join hundreds of businesses already saving time and money with AI workflows tailored to their industry.
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
