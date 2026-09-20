import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { runReversals } from '../services/giftFlow.js';

/**
 * §11: contributions stuck mid-reversal get retried until the money is back.
 * `runReversals` skips rows that already carry a reversalTxnId and reuses the
 * `contribution:{id}:reverse` key, so re-running is free.
 */
export async function refundRetry(): Promise<string[]> {
  const retried: string[] = [];

  for (const thread of db.giftThreads.filter((t) => t.state === 'refunding')) {
    await runReversals(thread.id);
    retried.push(thread.id);
  }

  if (retried.length > 0) logger.info('refund retry', { threadIds: retried });
  return retried;
}
