import { randomInt } from 'node:crypto';

/** Systems Trace Audit Number: exactly 6 digits. */
export function generateStan(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Retrieval Reference Number: exactly 12 characters.
 * Convention is ydddhhNNNNNN - year digit, day of year, hour, then a random tail.
 */
export function generateRrn(now = new Date()): string {
  const year = String(now.getUTCFullYear() % 10);
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = String(
    Math.floor((now.getTime() - startOfYear) / 86_400_000),
  ).padStart(3, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const tail = String(randomInt(0, 1_000_000)).padStart(6, '0');
  return `${year}${dayOfYear}${hour}${tail}`;
}

/** Visa wants localTransactionDateTime as YYYY-MM-DDThh:mm:ss with no timezone suffix. */
export function localTransactionDateTime(now = new Date()): string {
  return now.toISOString().replace(/\.\d{3}Z$/, '');
}
