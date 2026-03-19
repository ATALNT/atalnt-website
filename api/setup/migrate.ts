import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: string[] = [];

  try {
    // Create tables one by one using the REST API
    // We'll use raw SQL via the Supabase Management API or create tables via the client

    // Test connection first
    const { error: testError } = await supabase.from('clients').select('id').limit(1);

    if (testError && testError.code === '42P01') {
      // Table doesn't exist - need to run schema
      results.push('Tables do not exist yet. Please run the SQL schema in Supabase SQL Editor.');
      results.push('Schema file: supabase-schema.sql in the project root');
      return res.status(200).json({ status: 'needs_setup', results });
    } else if (testError) {
      results.push(`Connection test error: ${testError.message}`);
      return res.status(500).json({ status: 'error', results });
    }

    results.push('Tables already exist. Migration not needed.');
    return res.status(200).json({ status: 'ready', results });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
