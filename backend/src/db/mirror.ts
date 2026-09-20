/**
 * Write-through mirror: pushes gift-flow mutations from the in-memory working set back into the
 * teammates' Supabase so their frontend (which reads Supabase directly) sees our state.
 *
 * Rules this file obeys without exception:
 *  - the in-memory `db` stays authoritative; Postgres is a projection of it;
 *  - nothing here ever throws into a request path - a dead database must not fail a Visa call;
 *  - nothing here ever DELETEs or TRUNCATEs - teammates are working against the same rows;
 *  - it is completely inert unless `DB_MODE=postgres`, so the test suite never opens a socket.
 *
 * Schema divergences handled here (the inverse of the mappings in `postgres.ts`):
 *  - their `gift_threads.state` CHECK has no `refunding`, so ours is written as `cancelled`
 *    until the reversals land and it becomes `refunded`;
 *  - their `gift_threads` has no `push_status`; it is derivable from `push_txn_id`;
 *  - their `contributions.status` CHECK has no `pulling`/`refunding`/`removed`, so those are
 *    written as `approved`/`pulled`/`opted_out`;
 *  - their `contributions.amount_cents` CHECK forbids 0, so an opted-out/removed share keeps
 *    whatever amount is already stored rather than dropping to zero;
 *  - our single `GiftPickRow.reason` goes into `behavior_reason`; `social_reason` is NOT NULL
 *    and gets an empty string;
 *  - our `citedItemIds` becomes their `evidence` jsonb;
 *  - their `gift_picks.rank` is the pick's index within the thread (our insertion order).
 */
import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { getPool } from './postgres.js';
import { db, newId, now } from './store.js';
import type { ContributionRow, GiftThreadRow } from './types.js';
import type { ContributionStatus } from '../domain/splits.js';
import type { ThreadState } from '../domain/threadStateMachine.js';
import type { TxnKind } from '../visa/types.js';

/* -------------------------------------------------------------------------- */
/* Plumbing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Runs one mirror unit of work on a pooled client and swallows every failure. The returned
 * promise never rejects, so call sites can `void` it without risking an unhandled rejection.
 */
async function mirror(
  label: string,
  fields: Record<string, unknown>,
  work: (client: PoolClient) => Promise<void>,
): Promise<void> {
  if (config.DB_MODE !== 'postgres') return;
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await work(client);
  } catch (error) {
    logger.error('mirror failed', { label, ...fields, error: (error as Error).message });
  } finally {
    client?.release();
  }
}

/** Their CHECK constraint has no `refunding`; a thread mid-reversal reads as cancelled. */
const THREAD_STATE: Record<ThreadState, string> = {
  picking: 'picking',
  voting: 'voting',
  collecting: 'collecting',
  funded: 'funded',
  bought: 'bought',
  revealed: 'revealed',
  refunding: 'cancelled',
  refunded: 'refunded',
};

/** Their CHECK constraint has no `pulling`, `refunding` or `removed`. */
const CONTRIBUTION_STATUS: Record<ContributionStatus, string> = {
  pending: 'pending',
  pulling: 'approved',
  pulled: 'pulled',
  failed: 'failed',
  // Money is still sitting at Visa until the reversal completes.
  refunding: 'pulled',
  refunded: 'refunded',
  opted_out: 'opted_out',
  removed: 'opted_out',
};

/** Our endpoint name is `reverse`; their `kind` CHECK spells it `reversal`. */
const VISA_KIND: Record<TxnKind, string> = {
  pull: 'pull',
  push: 'push',
  reverse: 'reversal',
};

const VISA_DIRECTION: Record<TxnKind, string> = {
  pull: 'aft',
  push: 'oct',
  reverse: 'reversal',
};

/** A share is approved from the moment it is claimed for a pull. */
const APPROVED: ReadonlySet<ContributionStatus> = new Set<ContributionStatus>([
  'pulling',
  'pulled',
  'refunding',
  'refunded',
]);

const PAN = /\b\d{13,19}\b/g;

/** Visa payloads carry PANs; never let one reach a table the whole team can read. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}).replace(PAN, (pan) => `****${pan.slice(-4)}`);
  } catch {
    return '{}';
  }
}

/* -------------------------------------------------------------------------- */
/* Per-table upserts (FK-ordered, called with a client already in hand)        */
/* -------------------------------------------------------------------------- */

/**
 * Upserts everything about a thread except `winning_pick_id`, which is an FK onto `gift_picks`
 * and therefore has to wait until the picks are in. Callers that need it use `mirrorThread`.
 */
async function pushThread(client: PoolClient, thread: GiftThreadRow): Promise<void> {
  const terminalBuy = thread.state === 'bought' || thread.state === 'revealed';
  await client.query(
    `insert into gift_threads
       (id, group_id, recipient_id, organiser_id, state, budget_min_cents, budget_max_cents,
        deadline, push_txn_id, bought_at, revealed_at, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set
       state            = excluded.state,
       budget_min_cents = excluded.budget_min_cents,
       budget_max_cents = excluded.budget_max_cents,
       deadline         = excluded.deadline,
       push_txn_id      = coalesce(excluded.push_txn_id, gift_threads.push_txn_id),
       bought_at        = coalesce(gift_threads.bought_at, excluded.bought_at),
       revealed_at      = coalesce(gift_threads.revealed_at, excluded.revealed_at)`,
    [
      thread.id,
      thread.groupId,
      thread.recipientId,
      thread.organiserId,
      THREAD_STATE[thread.state],
      thread.budgetMinCents,
      thread.budgetMaxCents,
      thread.deadline,
      thread.pushTxnId,
      // No boughtAt in our store; the first mirror after the transition stamps it.
      terminalBuy ? now() : null,
      thread.revealAt,
      thread.createdAt,
    ],
  );
}

async function pushPicks(client: PoolClient, threadId: string): Promise<void> {
  // Insertion order is rank order - see the note on threadPicks in giftFlow.
  const picks = db.giftPicks.filter((p) => p.threadId === threadId);
  for (const [rank, pick] of picks.entries()) {
    await client.query(
      `insert into gift_picks
         (id, thread_id, product_name, product_url, image_url, merchant_name, price_cents,
          rank, source, behavior_reason, social_reason, evidence, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
       on conflict (id) do update set
         product_name    = excluded.product_name,
         product_url     = excluded.product_url,
         image_url       = excluded.image_url,
         merchant_name   = excluded.merchant_name,
         price_cents     = excluded.price_cents,
         rank            = excluded.rank,
         source          = excluded.source,
         behavior_reason = excluded.behavior_reason,
         social_reason   = excluded.social_reason,
         evidence        = excluded.evidence`,
      [
        pick.id,
        pick.threadId,
        pick.productName,
        pick.productUrl || null,
        pick.imageUrl,
        pick.merchant,
        pick.priceCents,
        rank,
        pick.source,
        // Our API exposes one reason line; theirs is split in two and both are NOT NULL.
        pick.reason,
        '',
        JSON.stringify(pick.citedItemIds.map((id) => ({ id, type: 'purchase' }))),
        pick.createdAt,
      ],
    );
  }
}

async function pushContribution(client: PoolClient, row: ContributionRow): Promise<void> {
  const approved = APPROVED.has(row.status) || row.pullTxnId !== null;
  await client.query(
    `insert into contributions
       (id, thread_id, user_id, amount_cents, status, approval_method, approval_ref,
        approved_at, pull_txn_id, reversal_txn_id, updated_at)
     values ($1,$2,$3,greatest($4::int, 1),$5,$6,$7,$8,$9,$10,$11)
     on conflict (id) do update set
       -- their CHECK forbids 0, so an opted-out share keeps the amount already stored
       amount_cents    = case when $4::int > 0 then $4::int else contributions.amount_cents end,
       status          = excluded.status,
       approval_method = coalesce(excluded.approval_method, contributions.approval_method),
       approval_ref    = coalesce(excluded.approval_ref, contributions.approval_ref),
       approved_at     = coalesce(contributions.approved_at, excluded.approved_at),
       pull_txn_id     = coalesce(excluded.pull_txn_id, contributions.pull_txn_id),
       reversal_txn_id = coalesce(excluded.reversal_txn_id, contributions.reversal_txn_id),
       updated_at      = excluded.updated_at`,
    [
      row.id,
      row.threadId,
      row.userId,
      row.amountCents,
      CONTRIBUTION_STATUS[row.status],
      // Their CHECK allows only 'passkey' | 'biometric'; both of our modes are the passkey flow.
      approved ? 'passkey' : null,
      approved ? row.pullTxnId ?? row.idempotencyKey : null,
      approved ? row.updatedAt : null,
      row.pullTxnId,
      row.reversalTxnId,
      row.updatedAt,
    ],
  );
}

/* -------------------------------------------------------------------------- */
/* Public surface - one re-callable function per entity                        */
/* -------------------------------------------------------------------------- */

/** Mirrors the thread row, including `winning_pick_id` once its pick exists in their table. */
export function mirrorThread(threadId: string): Promise<void> {
  return mirror('thread', { threadId }, async (client) => {
    const thread = db.giftThreads.find((t) => t.id === threadId);
    if (!thread) return;
    await pushThread(client, thread);
    if (!thread.winningPickId) return;
    await pushPicks(client, threadId);
    await client.query(
      `update gift_threads set winning_pick_id = $2
        where id = $1 and winning_pick_id is distinct from $2`,
      [threadId, thread.winningPickId],
    );
  });
}

/** Mirrors every pick on a thread, re-stamping `rank` from the current insertion order. */
export function mirrorPicks(threadId: string): Promise<void> {
  return mirror('picks', { threadId }, async (client) => {
    const thread = db.giftThreads.find((t) => t.id === threadId);
    if (!thread) return;
    await pushThread(client, thread);
    await pushPicks(client, threadId);
  });
}

export function mirrorVote(threadId: string, userId: string): Promise<void> {
  return mirror('vote', { threadId, userId }, async (client) => {
    const vote = db.votes.find((v) => v.threadId === threadId && v.userId === userId);
    if (!vote) return;
    const thread = db.giftThreads.find((t) => t.id === threadId);
    if (thread) await pushThread(client, thread);
    // gift_votes.pick_id is an FK, and the pick may have been generated after the last mirror.
    await pushPicks(client, threadId);
    await client.query(
      `insert into gift_votes (thread_id, user_id, pick_id) values ($1,$2,$3)
       on conflict (thread_id, user_id) do update set pick_id = excluded.pick_id`,
      [vote.threadId, vote.userId, vote.pickId],
    );
  });
}

export function mirrorContribution(contributionId: string): Promise<void> {
  return mirror('contribution', { contributionId }, async (client) => {
    const row = db.contributions.find((c) => c.id === contributionId);
    if (!row) return;
    const thread = db.giftThreads.find((t) => t.id === row.threadId);
    if (thread) await pushThread(client, thread);
    await pushContribution(client, row);
  });
}

/** Bulk form for the split recompute and the initial lock, which touch every share at once. */
export function mirrorThreadContributions(threadId: string): Promise<void> {
  return mirror('contributions', { threadId }, async (client) => {
    const thread = db.giftThreads.find((t) => t.id === threadId);
    if (thread) await pushThread(client, thread);
    for (const row of db.contributions.filter((c) => c.threadId === threadId)) {
      await pushContribution(client, row);
    }
  });
}

export type VisaTxnMirror = {
  kind: TxnKind;
  threadId: string | null;
  contributionId: string | null;
  amountCents: number;
  /** `requested` means in flight: the POST timed out and a status query still owes us an answer. */
  status: 'requested' | 'succeeded' | 'failed';
  visaTxnId: string | null;
  idempotencyKey: string;
  errorCode: string | null;
  raw: unknown;
};

/**
 * Appends the audit row for one Visa call. Keyed on `idempotency_key` rather than `id` because
 * that key is stable across retries of the same logical transfer, which is exactly the row we
 * want to overwrite when a retry finally resolves.
 */
export function mirrorVisaTxn(input: VisaTxnMirror): Promise<void> {
  return mirror('visaTxn', { kind: input.kind, key: input.idempotencyKey }, async (client) => {
    const thread = input.threadId
      ? db.giftThreads.find((t) => t.id === input.threadId)
      : undefined;
    if (thread) await pushThread(client, thread);
    const contribution = input.contributionId
      ? db.contributions.find((c) => c.id === input.contributionId)
      : undefined;
    if (contribution) await pushContribution(client, contribution);

    await client.query(
      `insert into visa_transactions
         (id, thread_id, contribution_id, kind, direction, amount_cents, status,
          visa_txn_id, idempotency_key, error_code, raw)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       on conflict (idempotency_key) do update set
         thread_id       = coalesce(excluded.thread_id, visa_transactions.thread_id),
         contribution_id = coalesce(excluded.contribution_id, visa_transactions.contribution_id),
         status          = excluded.status,
         visa_txn_id     = coalesce(excluded.visa_txn_id, visa_transactions.visa_txn_id),
         error_code      = excluded.error_code,
         raw             = excluded.raw`,
      [
        newId(),
        thread ? thread.id : null,
        contribution ? contribution.id : null,
        VISA_KIND[input.kind],
        VISA_DIRECTION[input.kind],
        input.amountCents,
        input.status,
        input.visaTxnId,
        input.idempotencyKey,
        input.errorCode,
        safeJson(input.raw),
      ],
    );
  });
}
