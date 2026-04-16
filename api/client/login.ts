// ============================================
// POST /api/client/login - Client Portal Login
// Supports per-client passwords
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLIENT_CONFIG: Record<string, { passwordEnv: string; secretEnv: string }> = {
  balfour: { passwordEnv: 'BALFOUR_PASSWORD', secretEnv: 'BALFOUR_SECRET' },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let password: string | undefined;
    let clientSlug: string | undefined;

    if (req.body && typeof req.body === 'object') {
      password = req.body.password;
      clientSlug = req.body.client;
    } else if (req.body && typeof req.body === 'string') {
      try { const parsed = JSON.parse(req.body); password = parsed?.password; clientSlug = parsed?.client; } catch {}
    }

    if (!password || !clientSlug) {
      return res.status(400).json({ error: 'Password and client are required' });
    }

    const config = CLIENT_CONFIG[clientSlug.toLowerCase()];
    if (!config) return res.status(400).json({ error: 'Unknown client' });

    const clientPassword = process.env[config.passwordEnv];
    const clientSecret = process.env[config.secretEnv];

    if (!clientPassword || !clientSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (password !== clientPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    return res.status(200).json({
      token: clientSecret,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch (error: any) {
    console.error('Client login error:', error?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
