// ============================================
// Zoho OAuth2 Token Management
// ============================================

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

// In-memory cache (per serverless function instance)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getZohoAccessToken(service: 'recruit' | 'voice'): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Zoho OAuth credentials in environment variables');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho OAuth token refresh failed: ${response.status} - ${errorText}`);
  }

  const data: TokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

export function createAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
