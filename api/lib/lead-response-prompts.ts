// ============================================
// Gemini System Prompt & Industry Framework
// for auto-responding to interested leads
// ============================================

export const SYSTEM_PROMPT = `You are writing a follow-up email on behalf of Nik Jain, Executive Partner at ATALNT (Talent + Technology Solutions). A sales persona has already been emailing this lead and just told them "I'm looping in Nik Jain, our Managing Partner." Now Nik is following up.

TONE & STYLE RULES:
- Direct, no fluff, short paragraphs
- Open with "[Persona first name] looped me in here."
- Mirror the prospect's sophistication level
- Use "friction" and "workflows" language naturally
- Don't oversell AI — focus on operational outcomes
- No buzzwords like "synergy", "leverage", "cutting-edge"
- Sound like a real person, not a template

STRUCTURE (keep it short — 100-150 words max):
1. Opening: "[Persona first name] looped me in here."
2. One sentence acknowledging their reply or interest specifically
3. One credibility anchor if relevant (e.g., "We recently helped a financial advisory firm in Irving TX cut their Salesforce implementation from 6 months to 3 weeks")
4. 2-3 bullet points of industry-specific pain points (from the industry context provided)
5. Soft CTA: "If helpful, happy to walk through this together. You can grab a time here: {bookings_url}"

DO NOT include:
- Subject line (we handle that separately)
- Email signature (we append that separately)
- Greeting like "Hi [Name]" (we prepend that separately)
- Any mention of pricing or costs
- Generic AI/ML language unless the prospect is technical

OUTPUT: Return ONLY the email body text (no greeting, no signature, no subject). Start directly with "[Persona first name] looped me in here."`;

export const INDUSTRY_FRAMEWORKS: Record<string, string> = {
  consulting: `INDUSTRY: Consulting / Professional Services
PAIN POINTS:
- Proposal automation — hours spent on repetitive RFP responses
- Resource utilization tracking across multiple engagements
- Knowledge management — tribal knowledge locked in email threads
- Client deliverable templates that still require manual customization`,

  tax_accounting: `INDUSTRY: Tax / Accounting / CPA
PAIN POINTS:
- Client intake and document collection still manual (email back-and-forth)
- Past returns and engagement history scattered across systems
- Engagement prep takes hours of pulling data from multiple sources
- Seasonal scaling — need to onboard temp staff fast without losing quality`,

  crypto_tech: `INDUSTRY: Crypto / Tech / Fintech
PAIN POINTS:
- Data pipeline reliability and monitoring across chains
- Developer workflow friction — context switching between tools
- System architecture documentation that stays current
- Compliance reporting automation (don't use generic AI language — be specific)`,

  investment_banking: `INDUSTRY: Investment Banking / Private Equity / VC
PAIN POINTS:
- Deal pricing and execution effort estimation still spreadsheet-driven
- Pipeline intelligence — knowing which deals are actually moving
- Due diligence document assembly takes weeks
- Portfolio company reporting consolidation`,

  wealth_advisory: `INDUSTRY: Wealth Advisory / Financial Planning
PAIN POINTS:
- Pipeline predictability — which prospects will actually close
- Client acquisition cost tracking across channels
- CRM data quality — advisors don't update records consistently
- Compliance documentation for new client onboarding`,

  franchise: `INDUSTRY: Franchise / Multi-Location Business
PAIN POINTS:
- Documentation and SOPs that actually get followed
- Proposal generation for new franchise locations
- Knowledge management across locations
- Sales pipeline visibility across franchisees`,

  staffing_recruiting: `INDUSTRY: Staffing / Recruiting
PAIN POINTS:
- Candidate sourcing across multiple job boards
- Resume screening and ranking at scale
- Client submission tracking and follow-up automation
- Placement analytics and margin optimization`,

  generic: `INDUSTRY: Professional Services (General)
PAIN POINTS:
- Manual workflows creating bottleneck and friction
- Data scattered across multiple systems with no single source of truth
- Repetitive processes that could be systematized
- Scaling operations without proportionally scaling headcount`,
};

export function detectIndustry(websiteText: string): string {
  const text = websiteText.toLowerCase();

  if (text.includes('tax') || text.includes('cpa') || text.includes('accounting') || text.includes('bookkeeping'))
    return 'tax_accounting';
  if (text.includes('crypto') || text.includes('blockchain') || text.includes('web3') || text.includes('defi'))
    return 'crypto_tech';
  if (text.includes('investment bank') || text.includes('private equity') || text.includes('venture capital') || text.includes('m&a'))
    return 'investment_banking';
  if (text.includes('wealth') || text.includes('financial advis') || text.includes('financial plan') || text.includes('ria'))
    return 'wealth_advisory';
  if (text.includes('franchise') || text.includes('multi-location') || text.includes('franchis'))
    return 'franchise';
  if (text.includes('consulting') || text.includes('advisory') || text.includes('professional services'))
    return 'consulting';
  if (text.includes('staffing') || text.includes('recruiting') || text.includes('talent acquisition') || text.includes('placement'))
    return 'staffing_recruiting';

  return 'generic';
}
