// ============================================
// POST /api/auth/login - Dashboard Login
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'crypto';
import { corsHeaders } from '../lib/auth-middleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  Object.entries(corsHeaders()).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const dashboardPassword = process.env.DASHBOARD_PASSWORD;
    const dashboardSecret = process.env.DASHBOARD_SECRET;

    if (!dashboardPassword || !dashboardSecret) {
      console.error('DASHBOARD_PASSWORD or DASHBOARD_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Constant-time comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(dashboardPassword);

    if (passwordBuffer.length !== expectedBuffer.length) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const isValid = timingSafeEqual(passwordBuffer, expectedBuffer);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Return the secret as a bearer token
    // Token expires in 24 hours (client-side enforcement)
    return res.status(200).json({
      token: dashboardSecret,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
