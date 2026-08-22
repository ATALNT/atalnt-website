// ============================================
// Dashboard API Client
// ============================================

import type {
  InstantlyOverview, InstantlyCampaignDetail, InstantlyMessaging, InstantlyReplies, InstantlyThread,
} from '@/types/dashboard';

async function fetchWithAuth(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem('atalnt_dashboard_auth');
      window.location.reload();
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// === Recruit APIs ===

export async function fetchRecruitJobs(token: string) {
  return fetchWithAuth('/api/recruit/jobs', token);
}

export async function fetchRecruitApplications(token: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithAuth(`/api/recruit/applications${query}`, token);
}

// === CRM / Sales APIs ===

export async function fetchSalesDashboard(token: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithAuth(`/api/crm/deals${query}`, token);
}

// === Voice APIs ===

export async function fetchVoiceCalls(token: string, preset?: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (preset) params.set('preset', preset);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithAuth(`/api/voice/calls${query}`, token);
}

// === Instantly Command Center ===


const CMD = '/api/instantly/command';

export async function fetchInstantlyOverview(token: string): Promise<InstantlyOverview> {
  return fetchWithAuth(`${CMD}?view=overview`, token);
}

export async function fetchInstantlyCampaign(token: string, id: string): Promise<InstantlyCampaignDetail> {
  return fetchWithAuth(`${CMD}?view=campaign&id=${encodeURIComponent(id)}`, token);
}

export async function fetchInstantlyMessaging(token: string, id: string, lead?: string): Promise<InstantlyMessaging> {
  return fetchWithAuth(`${CMD}?view=messaging&id=${encodeURIComponent(id)}${lead ? `&lead=${encodeURIComponent(lead)}` : ''}`, token);
}

export async function fetchInstantlyReplies(token: string, opts: { campaign?: string; cls?: string } = {}): Promise<InstantlyReplies> {
  const q = new URLSearchParams({ view: 'replies' });
  if (opts.campaign) q.set('campaign', opts.campaign);
  if (opts.cls) q.set('class', opts.cls);
  return fetchWithAuth(`${CMD}?${q.toString()}`, token);
}

export async function fetchInstantlyThread(token: string, id: string): Promise<InstantlyThread> {
  return fetchWithAuth(`${CMD}?view=thread&id=${encodeURIComponent(id)}`, token);
}

export async function classifyInstantlyReply(
  token: string,
  leadEmail: string,
  status: 'interested' | 'demo' | 'negative' | 'wrong_person' | 'neutral'
): Promise<{ ok: boolean }> {
  const response = await fetch(`${CMD}?view=classify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_email: leadEmail, status }),
  });
  if (!response.ok) throw new Error(`classify failed: ${response.status}`);
  return response.json();
}
