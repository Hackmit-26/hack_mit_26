import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { deadlineSweeper } from './deadlineSweeper.js';
import { pushWhenFunded } from './pushWhenFunded.js';
import { refundRetry } from './refundRetry.js';

let timer: NodeJS.Timeout | null = null;
let running = false;

/** One pass of every job. Exported so tests drive it directly instead of waiting on timers. */
export async function runJobsOnce(): Promise<void> {
  await deadlineSweeper();
  await pushWhenFunded();
  await refundRetry();
}

export function startJobs(): void {
  if (!config.JOBS_ENABLED || timer) return;

  timer = setInterval(() => {
    // Single in-process instance (§17); an overlapping tick would just duplicate work.
    if (running) return;
    running = true;
    void runJobsOnce()
      .catch((err: unknown) => {
        logger.error('job pass failed', {
          message: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        running = false;
      });
  }, config.DEADLINE_SWEEP_INTERVAL_MS);

  timer.unref();
  logger.info('jobs started', { intervalMs: config.DEADLINE_SWEEP_INTERVAL_MS });
}

export function stopJobs(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export { deadlineSweeper, pushWhenFunded, refundRetry };
