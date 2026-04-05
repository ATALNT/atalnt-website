// ============================================
// Dashboard API Client
// ============================================

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

export async function fetchRecruitCandidates(token: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithAuth(`/api/recruit/candidates${query}`, token);
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
