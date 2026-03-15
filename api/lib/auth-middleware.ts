// ============================================
// Dashboard Auth Middleware
// ============================================

import type { VercelRequest } from '@vercel/node';

export function verifyDashboardToken(req: VercelRequest): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.DASHBOARD_SECRET;

  if (!secret) {
    console.error('DASHBOARD_SECRET not set');
    return false;
  }

  // Simple token verification - the token IS the secret
  // For a production app you'd use JWT, but for an internal dashboard this is fine
  return token === secret;
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:8080',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
