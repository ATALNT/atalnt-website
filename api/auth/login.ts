// ============================================
// POST /api/auth/login - Dashboard Login
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: true,
  },
};

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
    // Read body manually if req.body is not available
    let password: string | undefined;

    try {
      const body = req.body;
      password = body?.password;
    } catch {
      // If body parsing fails, read raw body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      const parsed = JSON.parse(rawBody);
      password = parsed?.password;
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

    // Password matched - return token
    const tokenResponse = {
      token: dashboardSecret,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    return res.status(200).json(tokenResponse);
  } catch (error: any) {
    console.error('Login error:', error?.message, error?.stack);
    return res.status(500).json({
      error: 'Internal server error',
      debug: error?.message || 'Unknown error',
    });
  }
}
