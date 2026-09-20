import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { expireThread, resolvePendingPulls, settleIfFunded } from '../services/giftFlow.js';

export type SweepResult = { expired: string[]; funded: string[] };

/**
 * §11: `collecting` threads past their deadline are cancelled and every pull reversed.
 * The same pass resolves pulls left in flight by a Visa timeout, so a thread is never
 * judged short (or refunded) on stale information. Idempotent - safe to re-run any time.
 */
export async function deadlineSweeper(nowMs: number = Date.now()): Promise<SweepResult> {
  const result: SweepResult = { expired: [], funded: [] };

  for (const thread of db.giftThreads.filter((t) => t.state === 'collecting')) {
    await resolvePendingPulls(thread.id);

    if (new Date(thread.deadline).getTime() <= nowMs) {
      await expireThread(thread.id);
      result.expired.push(thread.id);
      continue;
    }

    const before = thread.state;
    await settleIfFunded(thread.id);
    const after = db.giftThreads.find((t) => t.id === thread.id)?.state;
    if (before !== after) result.funded.push(thread.id);
  }

  if (result.expired.length > 0 || result.funded.length > 0) {
    logger.info('deadline sweep', result);
  }
  return result;
}
