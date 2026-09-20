import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { pushToOrganiser } from '../services/giftFlow.js';

/**
 * §11 safety net: a thread that is funded but whose push never landed gets another go.
 * `pushToOrganiser` reuses the `thread:{id}:push` idempotency key, so a retry can never
 * send the pot twice even if the first attempt actually succeeded at Visa.
 */
export async function pushWhenFunded(): Promise<string[]> {
  const retried: string[] = [];

  for (const thread of db.giftThreads.filter(
    (t) => t.state === 'funded' && !t.pushTxnId,
  )) {
    await pushToOrganiser(thread.id);
    retried.push(thread.id);
  }

  if (retried.length > 0) logger.info('push retried', { threadIds: retried });
  return retried;
}
