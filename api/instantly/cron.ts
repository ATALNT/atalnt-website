// ============================================
// GET /api/instantly/cron?task=<name> — Unified Instantly cron dispatcher
// The Vercel Hobby plan caps a deployment at 12 serverless functions, so the
// five Instantly cron jobs live as ONE function that dispatches on ?task=:
//   health  -> mailbox health manager (pause <97, resume 97+, hard-cap 20/day)
//   prune   -> daily lead pruner (delete bounced + completed-no-reply)
//   bounce  -> bounce-rate circuit breaker (pause campaigns over threshold)
//   reply   -> reply manager
//   respond -> lead responder
// Each handler keeps its own file under api/_lib/crons/ (underscore dirs are
// not routed/counted). Schedules are in vercel.json, one entry per task.
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import healthScore from '../_lib/crons/health-score';
import pruneLeads from '../_lib/crons/prune-leads';
import bounceGuard from '../_lib/crons/bounce-guard';
import replyManager from '../_lib/crons/reply-manager';
import leadResponder from '../_lib/crons/lead-responder';

export const maxDuration = 300;

const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>> = {
  health: healthScore,
  prune: pruneLeads,
  bounce: bounceGuard,
  reply: replyManager,
  respond: leadResponder,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const task = String(req.query.task || '');
  const fn = HANDLERS[task];
  if (!fn) {
    return res.status(400).json({ error: `Unknown task '${task}'. Valid: ${Object.keys(HANDLERS).join(', ')}` });
  }
  return fn(req, res);
}
