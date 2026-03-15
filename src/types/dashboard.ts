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
