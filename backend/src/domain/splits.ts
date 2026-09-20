import { invalidState } from '../lib/errors.js';

export const CONTRIBUTION_STATUSES = [
  'pending',
  'pulling',
  'pulled',
  'failed',
  'refunding',
  'refunded',
  'opted_out',
  'removed',
] as const;

export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export type ContributionRow = {
  userId: string;
  amountCents: number;
  status: ContributionStatus;
};

export type Share = { userId: string; amountCents: number };

/** Statuses that no longer owe anything towards the total. */
const EXCLUDED: ReadonlySet<ContributionStatus> = new Set<ContributionStatus>([
  'opted_out',
  'removed',
]);

/** Statuses whose amount is already committed at Visa and must not be rewritten. */
const COMMITTED: ReadonlySet<ContributionStatus> = new Set<ContributionStatus>([
  'pulling',
  'pulled',
  'refunding',
  'refunded',
]);

export function isExcluded(status: ContributionStatus): boolean {
  return EXCLUDED.has(status);
}

export function isCommitted(status: ContributionStatus): boolean {
  return COMMITTED.has(status);
}

/**
 * Even split in integer cents. Remainder cents go to the first `remainder` contributors
 * ordered by userId, so the same inputs always produce the same shares.
 */
export function evenSplit(totalCents: number, userIds: string[]): Share[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw invalidState(`total must be non-negative integer cents, got ${totalCents}`);
  }
  if (userIds.length === 0) {
    throw invalidState('cannot split between zero contributors');
  }

  const ordered = [...userIds].sort();
  const base = Math.floor(totalCents / ordered.length);
  const remainder = totalCents - base * ordered.length;

  return ordered.map((userId, i) => ({
    userId,
    amountCents: base + (i < remainder ? 1 : 0),
  }));
}

/**
 * Recompute shares after an opt-out or removal. Amounts already committed at Visa are left
 * alone (§7.4); only uncommitted rows absorb the difference.
 *
 * Known MVP limitation: if committed amounts already exceed the new total, the uncommitted
 * rows drop to zero rather than refunding the excess.
 */
export function recomputeSplit(totalCents: number, rows: ContributionRow[]): Share[] {
  const active = rows.filter((r) => !isExcluded(r.status));
  if (active.length === 0) {
    throw invalidState('cannot split between zero contributors');
  }

  const committed = active.filter((r) => isCommitted(r.status));
  const open = active.filter((r) => !isCommitted(r.status));

  const committedTotal = committed.reduce((sum, r) => sum + r.amountCents, 0);
  const remaining = Math.max(0, totalCents - committedTotal);

  if (open.length === 0) {
    return committed.map((r) => ({ userId: r.userId, amountCents: r.amountCents }));
  }

  const openShares = evenSplit(
    remaining,
    open.map((r) => r.userId),
  );

  return [
    ...committed.map((r) => ({ userId: r.userId, amountCents: r.amountCents })),
    ...openShares,
  ];
}

/** §7.4 invariant: shares must add up to the winning pick's price. */
export function assertSplitBalances(totalCents: number, shares: Share[]): void {
  const sum = shares.reduce((acc, s) => acc + s.amountCents, 0);
  if (sum !== totalCents) {
    throw invalidState(`shares sum to ${sum} but the total is ${totalCents}`);
  }
}

/** Opting out is only allowed while nobody has money in flight (§7.4). */
export function canOptOut(rows: ContributionRow[]): boolean {
  return !rows.some((r) => isCommitted(r.status));
}
