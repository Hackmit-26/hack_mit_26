import { generatePicks } from '../ai/giftPicker.js';
import { db, newId, now } from '../db/index.js';
import {
  mirrorContribution,
  mirrorPicks,
  mirrorThread,
  mirrorThreadContributions,
  mirrorVisaTxn,
  mirrorVote,
} from '../db/mirror.js';
import type { ContributionRow, GiftPickRow, GiftThreadRow, UserRow } from '../db/types.js';
import { groupMemberIds, loadVisibleThread } from '../domain/permissions.js';
import {
  canOptOut,
  evenSplit,
  isExcluded,
  recomputeSplit,
  type ContributionStatus,
} from '../domain/splits.js';
import { transition } from '../domain/threadStateMachine.js';
import { AppError, invalidState, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { Contribution, GiftPick, Reveal, Thread } from '../types/api.js';
import { visa } from '../visa/index.js';
import type { TxnKind, VisaTxnResult } from '../visa/types.js';

const DAY_MS = 86_400_000;
const END_OF_DAY_MS = (23 * 60 + 59) * 60_000;

export const pullKey = (contributionId: string): string => `contribution:${contributionId}:pull`;
export const pushKey = (threadId: string): string => `thread:${threadId}:push`;
export const reverseKey = (contributionId: string): string =>
  `contribution:${contributionId}:reverse`;

/**
 * Appends one row to the teammates' `visa_transactions` audit table. Fire-and-forget: the mirror
 * never rejects, so a database hiccup can never turn a settled transfer into a failed request.
 */
function recordVisaTxn(
  kind: TxnKind,
  ids: { threadId: string | null; contributionId: string | null },
  amountCents: number,
  idempotencyKey: string,
  result: VisaTxnResult,
): void {
  void mirrorVisaTxn({
    kind,
    threadId: ids.threadId,
    contributionId: ids.contributionId,
    amountCents,
    // A statusIdentifier means the POST timed out and the transfer is still in flight.
    status: result.ok ? 'succeeded' : result.statusIdentifier ? 'requested' : 'failed',
    visaTxnId: result.txnId ?? null,
    idempotencyKey,
    errorCode: result.ok ? null : result.actionCode ?? result.error ?? null,
    raw: result.raw,
  });
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function getThread(threadId: string): GiftThreadRow {
  const thread = db.giftThreads.find((t) => t.id === threadId);
  if (!thread) throw notFound('Thread not found');
  return thread;
}

function getUser(userId: string): UserRow {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw notFound('User not found');
  return user;
}

function userName(userId: string): string {
  return db.users.find((u) => u.id === userId)?.name ?? 'Unknown';
}

function threadContributions(threadId: string): ContributionRow[] {
  return db.contributions.filter((c) => c.threadId === threadId);
}

/**
 * Insertion order, which is the picker's rank order. Sorting on createdAt broke that: all three
 * AI picks are inserted in the same millisecond, so the tiebreak on a random uuid shuffled the
 * best pick out of first place. Porting this to Postgres needs an explicit rank column.
 */
function threadPicks(threadId: string): GiftPickRow[] {
  return db.giftPicks.filter((p) => p.threadId === threadId);
}

function winningPriceCents(thread: GiftThreadRow): number {
  const pick = db.giftPicks.find((p) => p.id === thread.winningPickId);
  if (!pick) throw invalidState('Thread has no winning pick');
  return pick.priceCents;
}

function setState(thread: GiftThreadRow, next: GiftThreadRow['state']): GiftThreadRow {
  db.giftThreads.update((t) => t.id === thread.id, { state: next });
  void mirrorThread(thread.id);
  return getThread(thread.id);
}

// ---------------------------------------------------------------------------
// Serialisers (§10 response shapes)
// ---------------------------------------------------------------------------

function toPick(pick: GiftPickRow, voteCount: number): GiftPick {
  return {
    id: pick.id,
    productName: pick.productName,
    productUrl: pick.productUrl,
    imageUrl: pick.imageUrl,
    priceCents: pick.priceCents,
    merchant: pick.merchant,
    reason: pick.reason,
    citedItemIds: pick.citedItemIds,
    source: pick.source,
    voteCount,
  };
}

function toContribution(row: ContributionRow): Contribution {
  return {
    userId: row.userId,
    name: userName(row.userId),
    status: row.status,
    amountCents: row.amountCents,
    visaTxnId: row.pullTxnId,
  };
}

/** Never called with the recipient as viewer - every caller goes through loadVisibleThread first. */
export function toThread(thread: GiftThreadRow, viewerId: string): Thread {
  const votes = db.votes.filter((v) => v.threadId === thread.id);
  return {
    id: thread.id,
    groupId: thread.groupId,
    recipientId: thread.recipientId,
    recipientName: userName(thread.recipientId),
    organiserId: thread.organiserId,
    state: thread.state,
    budgetMinCents: thread.budgetMinCents,
    budgetMaxCents: thread.budgetMaxCents,
    deadline: thread.deadline,
    winningPickId: thread.winningPickId,
    pushStatus: thread.pushStatus,
    regenerations: thread.regenerations,
    picks: threadPicks(thread.id).map((p) =>
      toPick(p, votes.filter((v) => v.pickId === p.id).length),
    ),
    myVotePickId: votes.find((v) => v.userId === viewerId)?.pickId ?? null,
    contributions: threadContributions(thread.id).map(toContribution),
  };
}

export function toGiftPicks(threadId: string): GiftPick[] {
  const votes = db.votes.filter((v) => v.threadId === threadId);
  return threadPicks(threadId).map((p) =>
    toPick(p, votes.filter((v) => v.pickId === p.id).length),
  );
}

// ---------------------------------------------------------------------------
// §7.2 Creating a thread
// ---------------------------------------------------------------------------

/** Next occurrence of a MM-DD birthday, at midnight UTC. Timezone-naive by design (§17). */
export function nextBirthday(birthday: string, from = new Date()): Date {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!parts) throw invalidState('Recipient has no usable birthday');
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const thisYear = Date.UTC(from.getUTCFullYear(), month - 1, day);
  return new Date(
    thisYear >= today ? thisYear : Date.UTC(from.getUTCFullYear() + 1, month - 1, day),
  );
}

/** Deadline is the day before the birthday at 23:59 UTC (§7.2). */
export function deadlineForBirthday(birthday: string, from = new Date()): string {
  return new Date(nextBirthday(birthday, from).getTime() - DAY_MS + END_OF_DAY_MS).toISOString();
}

/** The birthday a deadline was derived from, used to spot a duplicate thread for the same year. */
function birthdayYearOf(deadline: string): number {
  return new Date(new Date(deadline).getTime() + DAY_MS).getUTCFullYear();
}

const ACTIVE_STATES: ReadonlySet<GiftThreadRow['state']> = new Set<GiftThreadRow['state']>([
  'picking',
  'voting',
  'collecting',
  'funded',
  'bought',
  'refunding',
]);

export function isActiveThread(thread: GiftThreadRow): boolean {
  return ACTIVE_STATES.has(thread.state);
}

export type CreateThreadInput = {
  groupId: string;
  recipientId: string;
  budgetMinCents: number;
  budgetMaxCents: number;
};

/** §7.2: one active thread per (group, recipient, birthday year). */
export function findDuplicateThread(groupId: string, recipientId: string): GiftThreadRow | null {
  const recipient = db.users.find((u) => u.id === recipientId);
  if (!recipient?.birthday) return null;
  const year = birthdayYearOf(deadlineForBirthday(recipient.birthday));
  return (
    db.giftThreads.find(
      (t) =>
        t.groupId === groupId &&
        t.recipientId === recipientId &&
        isActiveThread(t) &&
        birthdayYearOf(t.deadline) === year,
    ) ?? null
  );
}

export function createThread(organiserId: string, input: CreateThreadInput): GiftThreadRow {
  if (input.recipientId === organiserId) {
    throw invalidState('You cannot organise your own gift');
  }
  if (input.budgetMaxCents < input.budgetMinCents) {
    throw new AppError('VALIDATION_ERROR', 400, 'budgetMaxCents must be >= budgetMinCents');
  }
  if (!db.memberships.find((m) => m.groupId === input.groupId && m.userId === organiserId)) {
    throw new AppError('NOT_MEMBER', 403, 'You are not a member of this group');
  }
  if (!db.memberships.find((m) => m.groupId === input.groupId && m.userId === input.recipientId)) {
    throw notFound('Recipient is not in this group');
  }

  const recipient = getUser(input.recipientId);
  if (!recipient.birthday) throw invalidState('Recipient has no birthday set');

  const deadline = deadlineForBirthday(recipient.birthday);

  const existing = findDuplicateThread(input.groupId, input.recipientId);
  if (existing) {
    throw new AppError(
      'INVALID_STATE',
      409,
      `A gift thread already exists for this birthday: ${existing.id}`,
    );
  }

  const thread: GiftThreadRow = {
    id: newId(),
    groupId: input.groupId,
    recipientId: input.recipientId,
    organiserId,
    state: 'picking',
    budgetMinCents: input.budgetMinCents,
    budgetMaxCents: input.budgetMaxCents,
    deadline,
    winningPickId: null,
    pushTxnId: null,
    pushStatus: null,
    revealAt: null,
    regenerations: 0,
    createdAt: now(),
  };
  db.giftThreads.insert(thread);
  void mirrorThread(thread.id);
  logger.info('thread created', { threadId: thread.id, groupId: thread.groupId });
  return thread;
}

// ---------------------------------------------------------------------------
// §8.5 Picks
// ---------------------------------------------------------------------------

const MAX_REGENERATIONS = 3;

/** Generate or regenerate the AI picks for a thread (§8.5), capped at 3 regenerations. */
export async function generatePicksFor(threadId: string): Promise<GiftPick[]> {
  const thread = getThread(threadId);
  if (thread.state !== 'picking' && thread.state !== 'voting') {
    throw invalidState(`Cannot generate picks for a thread in state "${thread.state}"`);
  }
  if (threadPicks(threadId).length > 0) {
    if (thread.regenerations >= MAX_REGENERATIONS) {
      throw invalidState(`No regenerations left (max ${MAX_REGENERATIONS})`);
    }
    db.giftThreads.update((t) => t.id === threadId, {
      regenerations: thread.regenerations + 1,
    });
  }
  return absorbPicks(threadId, await generatePicks(threadId));
}

/** Persists anything the picker handed back that it did not store itself, then opens voting. */
export function absorbPicks(threadId: string, generated: GiftPickRow[]): GiftPick[] {
  for (const row of generated) {
    if (!db.giftPicks.find((p) => p.id === row.id)) db.giftPicks.insert(row);
  }
  const thread = getThread(threadId);
  if (thread.state === 'picking' && threadPicks(threadId).length > 0) {
    setState(thread, transition(thread.state, 'picks_generated', { isOrganiser: false }));
  }
  void mirrorPicks(threadId);
  return toGiftPicks(threadId);
}

export function addMemberPick(
  threadId: string,
  userId: string,
  input: { url: string; priceCents: number; productName?: string; imageUrl?: string; merchant?: string },
): GiftPickRow {
  const thread = getThread(threadId);
  if (thread.state !== 'picking' && thread.state !== 'voting') {
    throw invalidState(`Cannot add a pick to a thread in state "${thread.state}"`);
  }
  const pick: GiftPickRow = {
    id: newId(),
    threadId,
    productName: input.productName ?? input.url,
    productUrl: input.url,
    imageUrl: input.imageUrl ?? null,
    priceCents: input.priceCents,
    merchant: input.merchant ?? null,
    reason: `Added by ${userName(userId)}`,
    citedItemIds: [],
    source: 'member',
    createdAt: now(),
  };
  db.giftPicks.insert(pick);
  if (thread.state === 'picking') {
    setState(thread, transition(thread.state, 'picks_generated', { isOrganiser: false }));
  }
  void mirrorPicks(threadId);
  return pick;
}

// ---------------------------------------------------------------------------
// §7.3 Voting and locking
// ---------------------------------------------------------------------------

export function castVote(threadId: string, userId: string, pickId: string): void {
  const thread = getThread(threadId);
  if (thread.state !== 'voting') {
    throw invalidState(`Cannot vote on a thread in state "${thread.state}"`);
  }
  if (!db.giftPicks.find((p) => p.id === pickId && p.threadId === threadId)) {
    throw notFound('Pick not found');
  }
  const updated = db.votes.update(
    (v) => v.threadId === threadId && v.userId === userId,
    { pickId },
  );
  if (!updated) db.votes.insert({ threadId, userId, pickId });
  void mirrorVote(threadId, userId);
}

/** Winner = most votes; tie goes to the organiser's vote, else the cheapest tied pick (§7.3). */
export function pickWinner(threadId: string, organiserId: string): GiftPickRow {
  const picks = threadPicks(threadId);
  if (picks.length === 0) throw invalidState('Thread has no picks to lock');

  const votes = db.votes.filter((v) => v.threadId === threadId);
  const counts = new Map<string, number>(picks.map((p) => [p.id, 0]));
  for (const vote of votes) {
    counts.set(vote.pickId, (counts.get(vote.pickId) ?? 0) + 1);
  }

  const best = Math.max(...picks.map((p) => counts.get(p.id) ?? 0));
  const tied = picks.filter((p) => (counts.get(p.id) ?? 0) === best);
  if (tied.length === 1) return tied[0] as GiftPickRow;

  const organiserVote = votes.find((v) => v.userId === organiserId);
  const organiserPick = tied.find((p) => p.id === organiserVote?.pickId);
  if (organiserPick) return organiserPick;

  return [...tied].sort((a, b) =>
    a.priceCents === b.priceCents ? a.id.localeCompare(b.id) : a.priceCents - b.priceCents,
  )[0] as GiftPickRow;
}

export function lockThread(threadId: string, userId: string): GiftThreadRow {
  const thread = getThread(threadId);
  const next = transition(thread.state, 'lock', { isOrganiser: thread.organiserId === userId });

  const winner = pickWinner(threadId, thread.organiserId);
  const contributors = groupMemberIds(thread.groupId).filter((id) => id !== thread.recipientId);
  if (contributors.length === 0) throw invalidState('Nobody is left to chip in');

  for (const share of evenSplit(winner.priceCents, contributors)) {
    const id = newId();
    db.contributions.insert({
      id,
      threadId,
      userId: share.userId,
      amountCents: share.amountCents,
      status: 'pending',
      pullTxnId: null,
      pullStan: null,
      pullRrn: null,
      statusIdentifier: null,
      reversalTxnId: null,
      idempotencyKey: pullKey(id),
      updatedAt: now(),
    });
  }

  db.giftThreads.update((t) => t.id === threadId, { state: next, winningPickId: winner.id });
  void mirrorThread(threadId);
  void mirrorThreadContributions(threadId);
  logger.info('thread locked', { threadId, winningPickId: winner.id, contributors: contributors.length });
  return getThread(threadId);
}

// ---------------------------------------------------------------------------
// §7.4 Opt-out and removal
// ---------------------------------------------------------------------------

function applyRecompute(thread: GiftThreadRow): void {
  const rows = threadContributions(thread.id);
  if (rows.every((r) => isExcluded(r.status))) return;
  for (const share of recomputeSplit(winningPriceCents(thread), rows)) {
    db.contributions.update(
      (c) => c.threadId === thread.id && c.userId === share.userId,
      { amountCents: share.amountCents, updatedAt: now() },
    );
  }
  void mirrorThreadContributions(thread.id);
}

function myContribution(threadId: string, userId: string): ContributionRow {
  const row = db.contributions.find((c) => c.threadId === threadId && c.userId === userId);
  if (!row) throw notFound('You have no share on this thread');
  return row;
}

export function optOut(threadId: string, userId: string): GiftThreadRow {
  const thread = getThread(threadId);
  if (thread.state !== 'collecting') {
    throw invalidState(`Cannot opt out of a thread in state "${thread.state}"`);
  }
  const row = myContribution(threadId, userId);
  if (isExcluded(row.status)) throw invalidState('You are already out of this gift');
  if (!canOptOut(threadContributions(threadId))) {
    throw invalidState('Someone has already paid; ask the organiser to remove you instead');
  }
  db.contributions.update((c) => c.id === row.id, {
    status: 'opted_out',
    amountCents: 0,
    updatedAt: now(),
  });
  void mirrorContribution(row.id);
  applyRecompute(thread);
  return getThread(threadId);
}

export async function removeContributor(
  threadId: string,
  targetUserId: string,
): Promise<GiftThreadRow> {
  const thread = getThread(threadId);
  if (thread.state !== 'collecting') {
    throw invalidState(`Cannot remove a contributor from a thread in state "${thread.state}"`);
  }
  const row = myContribution(threadId, targetUserId);
  if (row.status !== 'pending' && row.status !== 'failed') {
    throw invalidState('Only unpaid contributors can be removed');
  }
  db.contributions.update((c) => c.id === row.id, {
    status: 'removed',
    amountCents: 0,
    updatedAt: now(),
  });
  void mirrorContribution(row.id);
  applyRecompute(thread);
  // Removing the last non-payer can complete the pot.
  await settleIfFunded(threadId);
  return getThread(threadId);
}

// ---------------------------------------------------------------------------
// §7.5 Approve share -> Visa pull
// ---------------------------------------------------------------------------

export type ApprovalProof = { confirm?: boolean; passkeyAssertion?: { credentialId: string } };

export function passkeyMode(): 'webauthn' | 'confirm' {
  return process.env.PASSKEY_MODE === 'webauthn' ? 'webauthn' : 'confirm';
}

/** §7.6: real assertions when WebAuthn is on, a confirm tap otherwise (the demo default). */
export function verifyApproval(userId: string, proof: ApprovalProof): void {
  if (passkeyMode() === 'confirm') {
    if (proof.confirm !== true) {
      throw new AppError('VALIDATION_ERROR', 400, 'confirm is required to approve your share');
    }
    return;
  }
  const assertion = proof.passkeyAssertion;
  if (!assertion?.credentialId) {
    throw new AppError('VALIDATION_ERROR', 400, 'passkeyAssertion is required');
  }
  const credential = db.passkeys.find(
    (p) => p.userId === userId && p.credentialId === assertion.credentialId,
  );
  if (!credential) {
    throw new AppError('UNAUTHENTICATED', 401, 'Unknown passkey');
  }
  db.passkeys.update((p) => p.userId === userId && p.credentialId === assertion.credentialId, {
    counter: credential.counter + 1,
  });
}

export async function approveShare(
  threadId: string,
  userId: string,
  proof: ApprovalProof,
): Promise<Contribution> {
  const thread = getThread(threadId);
  if (thread.state !== 'collecting') {
    throw invalidState(`Cannot chip in to a thread in state "${thread.state}"`);
  }

  const row = myContribution(threadId, userId);
  // Idempotency (§12): a completed pull is never repeated, whatever the caller does.
  if (row.pullTxnId) return toContribution(row);
  if (row.status !== 'pending' && row.status !== 'failed') {
    throw invalidState(`Your share is already ${row.status}`);
  }

  verifyApproval(userId, proof);

  const cardRef = getUser(userId).visaCardRef;
  if (!cardRef) throw invalidState('Add a card before chipping in');

  // Conditional claim (§12): whoever flips pending/failed -> pulling owns the Visa call.
  const claim = db.contributions.claim(
    (c) => c.id === row.id,
    (c) => c.status === 'pending' || c.status === 'failed',
    { status: 'pulling', updatedAt: now() },
  );
  if (!claim.claimed) throw invalidState('Your share is already being collected');
  void mirrorContribution(row.id);

  const result = await visa.pullFunds({
    cardRef,
    amountCents: row.amountCents,
    idempotencyKey: row.idempotencyKey,
  });

  let status: ContributionStatus;
  if (result.ok) {
    status = 'pulled';
  } else if (result.statusIdentifier) {
    // Timed out: the money may or may not have moved, so it stays in flight for the job (§12).
    status = 'pulling';
  } else {
    status = 'failed';
  }

  db.contributions.update((c) => c.id === row.id, {
    status,
    pullTxnId: result.txnId ?? null,
    pullStan: result.stan,
    pullRrn: result.rrn,
    statusIdentifier: result.statusIdentifier ?? null,
    updatedAt: now(),
  });
  void mirrorContribution(row.id);
  recordVisaTxn('pull', { threadId, contributionId: row.id }, row.amountCents, row.idempotencyKey, result);
  logger.info('pull attempted', { threadId, userId, status, actionCode: result.actionCode });

  await settleIfFunded(threadId);

  return toContribution(myContribution(threadId, userId));
}

/** Resolves pulls left in flight by a timeout, so no contribution is silently lost. */
export async function resolvePendingPulls(threadId: string): Promise<void> {
  for (const row of threadContributions(threadId)) {
    if (row.status !== 'pulling' || !row.statusIdentifier || row.pullTxnId) continue;
    const result = await visa.queryStatus({
      statusIdentifier: row.statusIdentifier,
      kind: 'pull',
    });
    if (result.ok) {
      db.contributions.update((c) => c.id === row.id, {
        status: 'pulled',
        pullTxnId: result.txnId ?? row.pullTxnId,
        pullStan: result.stan ?? row.pullStan,
        pullRrn: result.rrn ?? row.pullRrn,
        updatedAt: now(),
      });
    } else if (result.actionCode && result.actionCode !== '00') {
      db.contributions.update((c) => c.id === row.id, {
        status: 'failed',
        statusIdentifier: null,
        updatedAt: now(),
      });
    }
    void mirrorContribution(row.id);
    recordVisaTxn('pull', { threadId, contributionId: row.id }, row.amountCents, row.idempotencyKey, result);
  }
}

function owedContributions(threadId: string): ContributionRow[] {
  return threadContributions(threadId).filter((c) => !isExcluded(c.status));
}

/** §7.5 step 6: every share in means funded, which immediately triggers the push. */
export async function settleIfFunded(threadId: string): Promise<void> {
  const thread = getThread(threadId);
  if (thread.state !== 'collecting') return;
  const owed = owedContributions(threadId);
  if (owed.length === 0 || !owed.every((c) => c.status === 'pulled')) return;

  setState(thread, transition(thread.state, 'all_pulled', { isOrganiser: false }));
  await pushToOrganiser(threadId);
}

// ---------------------------------------------------------------------------
// §7.7 Push to organiser
// ---------------------------------------------------------------------------

export async function pushToOrganiser(threadId: string): Promise<void> {
  const thread = getThread(threadId);
  if (thread.pushTxnId) return;
  if (thread.state !== 'funded') return;

  const pulled = threadContributions(threadId).filter((c) => c.status === 'pulled');
  const amountCents = pulled.reduce((sum, c) => sum + c.amountCents, 0);
  if (amountCents <= 0) return;

  const organiser = getUser(thread.organiserId);
  if (!organiser.visaCardRef) {
    db.giftThreads.update((t) => t.id === threadId, { pushStatus: 'failed' });
    logger.error('push blocked: organiser has no card', { threadId });
    return;
  }

  const onlyPull = pulled.length === 1 ? pulled[0]?.pullTxnId ?? undefined : undefined;
  const result = await visa.pushFunds({
    cardRef: organiser.visaCardRef,
    amountCents,
    idempotencyKey: pushKey(threadId),
    originalPullTxnId: onlyPull,
  });

  db.giftThreads.update((t) => t.id === threadId, {
    pushTxnId: result.ok ? result.txnId ?? null : null,
    pushStatus: result.ok ? 'succeeded' : 'failed',
  });
  void mirrorThread(threadId);
  recordVisaTxn('push', { threadId, contributionId: null }, amountCents, pushKey(threadId), result);
  logger.info('push attempted', { threadId, amountCents, ok: result.ok });
}

// ---------------------------------------------------------------------------
// §7.8 Cancel / deadline -> reversals
// ---------------------------------------------------------------------------

export async function cancelThread(threadId: string, userId: string): Promise<GiftThreadRow> {
  const thread = getThread(threadId);
  const next = transition(thread.state, 'cancel', { isOrganiser: thread.organiserId === userId });
  setState(thread, next);
  logger.info('thread cancelled', { threadId, next });
  if (next === 'refunding') await runReversals(threadId);
  return getThread(threadId);
}

export async function expireThread(threadId: string): Promise<GiftThreadRow> {
  const thread = getThread(threadId);
  setState(thread, transition(thread.state, 'deadline_missed', { isOrganiser: false }));
  logger.info('thread deadline missed', { threadId });
  await runReversals(threadId);
  return getThread(threadId);
}

/**
 * Reverses every completed pull (§1 rule 6). Idempotent: re-running only touches rows that
 * still owe a reversal, and a stored reversalTxnId is never re-sent to Visa.
 */
export async function runReversals(threadId: string): Promise<void> {
  const thread = getThread(threadId);
  if (thread.state !== 'refunding') return;

  // A pull that timed out may have taken money; find out before declaring the thread settled.
  await resolvePendingPulls(threadId);

  for (const row of threadContributions(threadId)) {
    if (row.status === 'pulled') {
      db.contributions.claim(
        (c) => c.id === row.id,
        (c) => c.status === 'pulled',
        { status: 'refunding', updatedAt: now() },
      );
    }
    const current = db.contributions.find((c) => c.id === row.id);
    if (!current || current.status !== 'refunding') continue;

    if (current.reversalTxnId) {
      db.contributions.update((c) => c.id === current.id, {
        status: 'refunded',
        updatedAt: now(),
      });
      void mirrorContribution(current.id);
      continue;
    }

    const result = await visa.reverseFunds({
      originalPull: {
        stan: current.pullStan ?? '',
        rrn: current.pullRrn ?? '',
        txnId: current.pullTxnId ?? undefined,
        amountCents: current.amountCents,
        cardRef: getUser(current.userId).visaCardRef ?? '',
      },
      idempotencyKey: reverseKey(current.id),
    });

    if (result.ok) {
      db.contributions.update((c) => c.id === current.id, {
        status: 'refunded',
        reversalTxnId: result.txnId ?? null,
        updatedAt: now(),
      });
    } else {
      logger.error('reversal failed, will retry', { threadId, contributionId: current.id });
    }
    void mirrorContribution(current.id);
    recordVisaTxn('reverse', { threadId, contributionId: current.id }, current.amountCents, reverseKey(current.id), result);
  }

  finishRefundIfSettled(threadId);
}

/** §7.8: nothing left in pulled/refunding (or in-flight pulling) means fully refunded. */
export function finishRefundIfSettled(threadId: string): void {
  const thread = getThread(threadId);
  if (thread.state !== 'refunding') return;
  const outstanding = threadContributions(threadId).some(
    (c) => c.status === 'pulled' || c.status === 'refunding' || c.status === 'pulling',
  );
  if (outstanding) return;
  setState(thread, transition(thread.state, 'all_reversed', { isOrganiser: false }));
  logger.info('thread fully refunded', { threadId });
}

// ---------------------------------------------------------------------------
// §7.9 Bought and reveal
// ---------------------------------------------------------------------------

export function markBought(threadId: string, userId: string): GiftThreadRow {
  const thread = getThread(threadId);
  return setState(
    thread,
    transition(thread.state, 'mark_bought', { isOrganiser: thread.organiserId === userId }),
  );
}

export function revealThread(threadId: string, userId: string): GiftThreadRow {
  const thread = getThread(threadId);
  const next = transition(thread.state, 'reveal', { isOrganiser: thread.organiserId === userId });
  db.giftThreads.update((t) => t.id === threadId, {
    state: next,
    revealAt: now().slice(0, 10),
  });
  void mirrorThread(threadId);
  return getThread(threadId);
}

/**
 * The only thread data the recipient may ever read, and only once revealed (§7.9).
 * Names of the people who chipped in - never amounts, votes or the other picks.
 */
export function buildReveal(threadId: string, userId: string): Reveal {
  const thread = db.giftThreads.find((t) => t.id === threadId);
  if (!thread || thread.state !== 'revealed') throw notFound('Reveal not found');

  const isRecipient = thread.recipientId === userId;
  const isMember = Boolean(
    db.memberships.find((m) => m.groupId === thread.groupId && m.userId === userId),
  );
  if (!isRecipient && !isMember) throw notFound('Reveal not found');

  const pick = db.giftPicks.find((p) => p.id === thread.winningPickId);
  if (!pick) throw notFound('Reveal not found');

  const contributors = threadContributions(threadId)
    .filter((c) => c.status === 'pulled')
    .map((c) => userName(c.userId))
    .sort();

  return { giftName: pick.productName, imageUrl: pick.imageUrl, contributors };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export function visibleGroupThreads(groupId: string, userId: string): Thread[] {
  return db.giftThreads
    .filter((t) => t.groupId === groupId && t.recipientId !== userId && isActiveThread(t))
    .map((t) => toThread(t, userId));
}

export { loadVisibleThread };
