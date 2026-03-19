import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET - list candidates for a client or ops lead
    if (req.method === 'GET') {
      const { client_id, ops_lead_id } = req.query;

      let query = supabaseAdmin
        .from('candidates')
        .select('*, clients(name), feedback(count)')
        .order('created_at', { ascending: false });

      if (client_id) {
        query = query.eq('client_id', client_id).eq('published', true);
      } else if (ops_lead_id) {
        query = query.eq('ops_lead_id', ops_lead_id);
      } else {
        return res.status(400).json({ error: 'client_id or ops_lead_id required' });
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json(data);
    }

    // PATCH - update candidate status
    if (req.method === 'PATCH') {
      const { id, status, actor_email } = req.body;

      if (!id || !status) {
        return res.status(400).json({ error: 'id and status required' });
      }

      const { error } = await supabaseAdmin
        .from('candidates')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Log activity
      if (actor_email) {
        await supabaseAdmin.from('activity_log').insert({
          candidate_id: id,
          action: 'status_changed',
          actor_email,
          actor_type: 'ops_lead',
          details: { new_status: status },
        });
      }

      return res.status(200).json({ updated: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Candidates API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
