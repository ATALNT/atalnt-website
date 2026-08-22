// ============================================
// Storage for the command center's daily campaign aggregates.
//
// The original design stored one row per campaign in Supabase. That project
// (rzuwazpomhpiqypjtcnh) no longer resolves: free-tier projects pause after a
// week idle and are deleted after 90 days, and nothing had touched it since the
// automation tab went dormant. The whole aggregate set is ~12KB, so it does not
// need a database. It is ONE JSON document:
//
//   production: Vercel Blob (free on Hobby, needs BLOB_READ_WRITE_TOKEN)
//   local dev:  /tmp/instantly-aggregates.json
//
// Shape: { computed_at, campaigns: { [campaign_id]: { name, data } } }
// ============================================

import { readFile, writeFile } from 'node:fs/promises';

export interface AggregateDoc {
  computed_at: string;
  campaigns: Record<string, { name: string; data: Record<string, unknown> }>;
}

const BLOB_PATH = 'instantly/campaign-aggregates.json';
const LOCAL_PATH = '/tmp/instantly-aggregates.json';

export async function loadAggregates(): Promise<AggregateDoc | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
      const hit = blobs.find((b) => b.pathname === BLOB_PATH);
      if (!hit) return null;
      const r = await fetch(hit.url, { cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.json()) as AggregateDoc;
    } catch (e) {
      console.error('aggregate load (blob) failed', e instanceof Error ? e.message : e);
      return null;
    }
  }
  try {
    return JSON.parse(await readFile(LOCAL_PATH, 'utf8')) as AggregateDoc;
  } catch {
    return null;
  }
}

export async function saveAggregates(doc: AggregateDoc): Promise<void> {
  const body = JSON.stringify(doc);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    await put(BLOB_PATH, body, { access: 'public', contentType: 'application/json', addRandomSuffix: false });
    return;
  }
  await writeFile(LOCAL_PATH, body, 'utf8');
}
