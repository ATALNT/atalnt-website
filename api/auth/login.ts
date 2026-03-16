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
    // Try multiple ways to get the password from request body
    let password: string | undefined;

    // Method 1: req.body already parsed (Vercel default)
    if (req.body && typeof req.body === 'object' && req.body.password) {
      password = req.body.password;
    }
    // Method 2: req.body is a string (needs parsing)
    else if (req.body && typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        password = parsed?.password;
      } catch {
        // Not valid JSON string
      }
    }
    // Method 3: Check query params as fallback
    if (!password && req.query?.password) {
      password = String(req.query.password);
    }

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
    console.error('Login error:', error?.message, error?.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
