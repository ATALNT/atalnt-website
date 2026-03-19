import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, token } = req.body;

  if (!email && !token) {
    return res.status(400).json({ error: 'Email or token required' });
  }

  try {
    // Token-based login (from magic link)
    if (token) {
      const { data: clientUser, error } = await supabaseAdmin
        .from('client_users')
        .select('*, clients(id, name)')
        .eq('magic_token', token)
        .gt('magic_token_expires_at', new Date().toISOString())
        .single();

      if (error || !clientUser) {
        return res.status(401).json({ error: 'Invalid or expired link' });
      }

      // Clear token and update login time
      await supabaseAdmin
        .from('client_users')
        .update({
          magic_token: null,
          magic_token_expires_at: null,
          verified_at: clientUser.verified_at || new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .eq('id', clientUser.id);

      return res.status(200).json({
        type: 'client',
        session: {
          type: 'client',
          client_user_id: clientUser.id,
          client_id: clientUser.clients.id,
          client_name: clientUser.clients.name,
          email: clientUser.email,
          name: clientUser.name,
        },
      });
    }

    // Email-based login
    // Check if ops lead
    const { data: opsLead } = await supabaseAdmin
      .from('ops_leads')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (opsLead) {
      // For now, ops leads get direct access (TODO: add password check)
      return res.status(200).json({
        type: 'ops_lead',
        session: {
          type: 'ops_lead',
          ops_lead_id: opsLead.id,
          email: opsLead.email,
          name: opsLead.name,
        },
      });
    }

    // Check if client user
    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('*, clients(id, name)')
      .eq('email', email.toLowerCase())
      .single();

    if (clientUser) {
      // Generate magic link token
      const magicToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

      await supabaseAdmin
        .from('client_users')
        .update({ magic_token: magicToken, magic_token_expires_at: expiresAt })
        .eq('id', clientUser.id);

      // TODO: Send email with magic link via Resend
      // For now, return the token directly for testing
      const portalUrl = `${req.headers.origin || 'https://atalnt.com'}/portal?token=${magicToken}`;

      return res.status(200).json({
        type: 'magic_link_sent',
        // Remove this in production — only for testing
        _debug_link: portalUrl,
      });
    }

    return res.status(404).json({ error: 'Email not found. Contact your ATALNT representative.' });
  } catch (err: any) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
