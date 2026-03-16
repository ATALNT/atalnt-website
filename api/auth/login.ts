// ============================================
// POST /api/auth/login - Dashboard Login
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vercel auto-parses JSON body when bodyParser is enabled (default)
    const password = req.body?.password;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const dashboardPassword = process.env.DASHBOARD_PASSWORD;
    const dashboardSecret = process.env.DASHBOARD_SECRET;

    if (!dashboardPassword || !dashboardSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (password !== dashboardPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    return res.status(200).json({
      token: dashboardSecret,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch (error: any) {
    console.error('Login error:', error?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
