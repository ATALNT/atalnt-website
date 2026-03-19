import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, candidate_id, candidate_name, client_name, client_id, position_title, feedback, actor_email } = req.body;

  try {
    if (type === 'new_candidate') {
      // Get client contacts to notify
      const { data: clientUsers } = await supabaseAdmin
        .from('client_users')
        .select('email, name')
        .eq('client_id', client_id);

      // TODO: Send email via Resend to each client contact
      // For now, just log it
      console.log(`[NOTIFY] New candidate ${candidate_name} for ${position_title} published to client ${client_id}`);
      console.log(`[NOTIFY] Would email:`, clientUsers?.map(u => u.email));

      return res.status(200).json({ sent: true, recipients: clientUsers?.length || 0 });
    }

    if (type === 'feedback') {
      // Get the candidate's ops lead
      const { data: candidate } = await supabaseAdmin
        .from('candidates')
        .select('ops_lead_id, ops_leads(email, name)')
        .eq('id', candidate_id)
        .single();

      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      const opsLeadEmail = (candidate as any).ops_leads?.email;
      const nikEmail = 'nik@atalnt.com';

      // TODO: Send email via Resend
      console.log(`[NOTIFY] Feedback on ${candidate_name} from ${actor_email} (${client_name})`);
      console.log(`[NOTIFY] ${feedback.thumbs_up ? 'INTERESTED' : 'PASS'}: ${feedback.comment || 'No comment'}`);
      console.log(`[NOTIFY] Would email: ${opsLeadEmail}, ${nikEmail}`);

      return res.status(200).json({ sent: true, recipients: [opsLeadEmail, nikEmail] });
    }

    return res.status(400).json({ error: 'Unknown notification type' });
  } catch (err: any) {
    console.error('Notification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
