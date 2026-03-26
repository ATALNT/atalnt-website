// ============================================
// Freight-Match Keyword Signals & Candidate Parsing
// TypeScript port of: service_categories.py, scoring_engine.py, candidate_parser.py
// ============================================

export const SERVICE_CATEGORIES: string[] = [
  'Freight Forwarding',
  'Customs Brokerage',
  'Domestic Asset-Based Carrier',
  'Domestic 3PL / Freight Brokerage',
  'FTL – Full Truckload',
  'Reefer / Temperature Controlled Transport',
  'LTL – Less Than Truckload',
  'Expedited / Time Critical',
  'Warehousing & Distribution',
  'Temperature Controlled Warehousing',
  'White Glove Delivery',
  'Final Mile Logistics',
];

export const KEYWORD_SIGNALS: Record<string, string[]> = {
  'Freight Forwarding': [
    'ocean freight', 'ocean cargo', 'air freight', 'air cargo', 'fcl', 'lcl',
    'nvocc', 'freight forwarder', 'international shipping', 'international logistics',
    'global freight', 'import freight', 'export freight', 'drayage', 'port logistics',
    'port operations', 'intermodal', 'importers & exporters', 'international accounts',
    'cross-border international',
  ],
  'Customs Brokerage': [
    'customs', 'customs brokerage', 'customs clearance', 'import compliance',
    'export compliance', 'trade compliance', 'isf', 'customs documentation',
    'import/export documentation', 'customs broker license',
  ],
  'Domestic Asset-Based Carrier': [
    'company fleet', 'owned fleet', 'asset-based', 'dedicated fleet',
    'own trucks', 'owner-operated', 'company equipment',
  ],
  'Domestic 3PL / Freight Brokerage': [
    '3pl', 'freight broker', 'brokerage', 'non-asset', 'managed transportation',
    'managed logistics', '4pl', 'supply chain management', 'tms',
  ],
  'FTL – Full Truckload': [
    'full truckload', 'ftl', 'dry van', 'flatbed', 'over-dimensional',
    'specialized freight', 'full loads',
  ],
  'Reefer / Temperature Controlled Transport': [
    'reefer', 'refrigerated freight', 'temperature-controlled freight',
    'cold chain transport', 'produce transport', 'frozen freight',
    'temp-controlled lanes', 'refrigerated trucking', 'cold chain logistics',
  ],
  'LTL – Less Than Truckload': [
    'ltl', 'less than truckload', 'partial loads', 'ltl freight',
    'regional ltl', 'national ltl',
  ],
  'Expedited / Time Critical': [
    'expedited', 'time-critical', 'time-sensitive', 'hot shot', 'air charter',
    'airport recovery', 'same-day', 'next-day', 'critical freight',
    'emergency freight', 'time-definite', 'urgent freight',
  ],
  'Warehousing & Distribution': [
    'warehousing', 'warehouse', 'distribution center', 'cross-dock', 'transload',
    'fulfillment', 'ecommerce fulfillment', '3pl warehouse', 'inventory management',
    'pick-and-pack',
  ],
  'Temperature Controlled Warehousing': [
    'cold storage', 'refrigerated warehouse', 'freezer storage', 'food-grade storage',
    'cold chain storage', 'temperature-controlled storage', 'controlled environment storage',
  ],
  'White Glove Delivery': [
    'white glove', 'inside delivery', 'installation', 'high-value handling',
    'room-of-choice delivery',
  ],
  'Final Mile Logistics': [
    'last mile', 'final mile', 'residential delivery', 'last-mile fulfillment',
    'large item delivery', 'home delivery',
  ],
};

// --- Sales profile signals (scoring_engine.py) ---

const HUNTER_SIGNALS = [
  'new business', 'cold call', 'prospect', 'hunter', 'build book',
  'business development', 'generate leads', 'new accounts', 'pipeline',
  'outbound', 'door-to-door',
];
const FARMER_SIGNALS = [
  'account management', 'grew existing', 'retained', 'farmer',
  'relationship management', 'upsell', 'cross-sell', 'renewal',
  'client retention', 'expand accounts',
];
const ENTERPRISE_SIGNALS = [
  'fortune 500', 'enterprise', 'global accounts', 'national accounts',
  'large accounts', 'strategic accounts', 'major accounts',
];
const SMB_SIGNALS = [
  'smb', 'small business', 'mid-market', 'small to medium',
  'local accounts', 'regional accounts',
];
const W2_SIGNALS = ['w2', 'w-2', 'direct hire', 'salary', 'base salary'];
const AGENT_1099_SIGNALS = ['1099', 'agent', 'independent', 'commission-only', 'contractor'];

function hasSignal(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some((kw) => lower.includes(kw));
}

// --- Public API ---

export function detectServicesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const category of SERVICE_CATEGORIES) {
    const keywords = KEYWORD_SIGNALS[category];
    if (keywords && keywords.some((kw) => lower.includes(kw))) {
      matched.push(category);
    }
  }
  return matched;
}

export interface SalesProfile {
  repType: string;
  targetSize: string;
  salesModel: string;
  salesStyle: string;
}

export function extractSalesProfile(text: string): SalesProfile {
  const isHunter = hasSignal(text, HUNTER_SIGNALS);
  const isFarmer = hasSignal(text, FARMER_SIGNALS);
  const isEnterprise = hasSignal(text, ENTERPRISE_SIGNALS);
  const isSmb = hasSignal(text, SMB_SIGNALS);
  const isW2 = hasSignal(text, W2_SIGNALS);
  const is1099 = hasSignal(text, AGENT_1099_SIGNALS);

  let repType = 'Unknown';
  if (isHunter && isFarmer) repType = 'Hybrid';
  else if (isHunter) repType = 'Hunter';
  else if (isFarmer) repType = 'Farmer';

  let targetSize = 'Unknown';
  if (isEnterprise && isSmb) targetSize = 'All';
  else if (isEnterprise) targetSize = 'Enterprise';
  else if (isSmb) targetSize = 'SMB';

  let salesModel = 'Unknown';
  if (isW2 && is1099) salesModel = 'Both';
  else if (isW2) salesModel = 'W2';
  else if (is1099) salesModel = '1099';

  let salesStyle = 'Unknown';
  if (repType === 'Hunter') salesStyle = 'New Business';
  else if (repType === 'Farmer') salesStyle = 'Account Management';
  else if (repType === 'Hybrid') salesStyle = 'Full Cycle';

  return { repType, targetSize, salesModel, salesStyle };
}
