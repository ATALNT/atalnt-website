// ============================================
// ATALNT Analytics Dashboard - Type Definitions
// ============================================

// === Date Range ===
export interface DateRange {
  from: string; // ISO date string
  to: string;
}

export type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_7_days' | 'last_30_days' | 'last_month' | 'custom';

// === Auth ===
export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
}

// === Zoho Recruit Types ===
export interface RecruitJob {
  id: string;
  postingTitle: string;
  clientName: string;
  jobOpeningStatus: string;
  numberOfPositions: number;
  numberOfApplications: number;
  priority: string;
  assignedRecruiters: string[];
  createdTime: string;
  modifiedTime: string;
  targetDate: string | null;
  city: string;
  jobType: string;
  isHotJobOpening: boolean;
}

export interface RecruitCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  source: string;
  candidateStatus: string;
  createdTime: string;
  assignedRecruiter: string;
}

export interface RecruitApplication {
  id: string;
  candidateId: string;
  candidateName: string;
  jobOpeningId: string;
  jobTitle: string;
  clientName: string;
  applicationStatus: string;
  createdTime: string;
  modifiedTime: string;
  assignedRecruiter: string;
}

// === Aggregated Recruit Data ===
export interface JobsByClientData {
  clientName: string;
  inProgress: number;
  filled: number;
  onHold: number;
  inactive: number;
  total: number;
}

export interface PipelineStatusData {
  status: string;
  count: number;
  color: string;
}

export interface ZeroSubmissionJob {
  jobId: string;
  postingTitle: string;
  clientName: string;
  numberOfPositions: number;
  daysOpen: number;
  priority: string;
}

export interface RecruiterPerformance {
  recruiterName: string;
  submissions: number;
  calls: number;
  interviews: number;
  hires: number;
}

export interface RecruitOverviewStats {
  totalOpenJobs: number;
  totalCandidatesInPipeline: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  totalApplications: number;
  hiresThisMonth: number;
}

// === Zoho Voice Types ===
export interface VoiceCall {
  id: string;
  mode: 'incoming' | 'outgoing';
  from: string;
  to: string;
  agentName: string;
  agentEmail: string;
  queueName: string;
  duration: number; // seconds
  dateTime: string;
  status: 'answered' | 'missed' | 'voicemail' | 'busy' | 'no-answer';
  hasRecording: boolean;
  disposition: string;
}

export interface VoiceText {
  id: string;
  from: string;
  to: string;
  agentName: string;
  direction: 'inbound' | 'outbound';
  dateTime: string;
  status: string;
}

// === Aggregated Voice Data ===
export interface CallsByPersonData {
  agentName: string;
  inbound: number;
  outbound: number;
  missed: number;
  totalDuration: number; // minutes
  avgDuration: number; // seconds
}

export interface TextsByPersonData {
  agentName: string;
  sent: number;
  received: number;
  total: number;
}

export interface DailyCallVolume {
  date: string;
  inbound: number;
  outbound: number;
  missed: number;
  total: number;
}

export interface HourlyCallLoad {
  hour: string;
  count: number;
}

export interface VoiceOverviewStats {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  totalDuration: number; // minutes
  avgCallDuration: number; // seconds
  totalTexts: number;
}

// === Combined Data ===
export interface RecruiterActivityScore {
  recruiterName: string;
  calls: number;
  submissions: number;
  interviews: number;
  hires: number;
  activityScore: number; // weighted composite
}

// === API Response Wrapper ===
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

// ============================================
// Instantly Command Center
// ============================================

export type ReplyClass = 'demo' | 'positive' | 'neutral' | 'negative' | 'wrong_person' | 'auto';

export interface InstantlyCampaignRow {
  id: string;
  name: string;
  status: number;
  isolated: boolean;
  senders: number;
  leads: number;
  contacted: number;
  remaining: number;
  sent: number;
  replies: number;
  auto_replies: number;
  bounced: number;
  opportunities: number;
  reply_rate: number;
  bounce_rate: number;
  health: { light: 'green' | 'yellow' | 'red'; reason: string };
  created?: string;
}

export interface InstantlyOverview {
  generated_at: string;
  tiles: {
    sends_today: number; ceiling: number; sends_pct: number;
    reply_rate: number; historical_reply_rate: number; replies_today: number;
    positive_replies: number; positive_today: number;
    bounce_rate: number; bounce_trip: number;
    demos_requested: number;
  };
  active: InstantlyCampaignRow[];
  past: InstantlyCampaignRow[];
  daily: Record<string, { date: string; sent: number; replies: number }[]>;
  fleet: { gmail_total: number; gmail_eligible: number; error_state: number; total: number };
  guard: { ran_at: string | null; verdict: string; problems: string[] };
}

export interface InstantlyAudience {
  as_of: string;
  total: number;
  with_company: number;
  unique_companies: number;
  title_groups: Record<string, number>;
  top_companies: { name: string; count: number }[];
  status_funnel: Record<string, number>;
  subject_split: { subject: string; leads: number; replies: number; reply_rate: number }[];
  verticals: Record<string, number>;
  sources: Record<string, number>;
  reply_classes: Record<string, number>;
}

export interface InstantlyCampaignDetail {
  id: string;
  name: string;
  status: number;
  senders: number;
  schedule: { timing?: { from: string; to: string }; days?: Record<string, boolean>; timezone?: string } | null;
  daily: { date: string; sent: number; replies: number; auto: number; opportunities: number }[];
  steps: { step: number; variant: string | null; sent: number; replies: number; reply_rate: number }[];
  sequence: { step: number; delay: number; subject: string; body_html: string }[];
  audience: InstantlyAudience | null;
}

export interface InstantlyMessaging {
  lead: { email: string; first_name: string; company: string; group: string } | null;
  leads: { email: string; first_name: string; company: string; group: string }[];
  senders: number;
  steps: { step: number; delay_days: number; subject: string; body: string }[];
  unresolved: boolean;
}

export interface InstantlyReply {
  id: string;
  thread_id: string;
  campaign_id: string;
  campaign: string;
  from_email: string;
  from_name: string;
  to_mailbox: string;
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  interest: number | null;
  class: ReplyClass;
}

export interface InstantlyReplies {
  items: InstantlyReply[];
  counts: Record<string, number>;
  fetched_at: string;
}

export interface InstantlyThread {
  id: string;
  messages: { id: string; from: string; to: string[]; subject: string; timestamp: string; direction: 'sent' | 'received'; text: string }[];
}
