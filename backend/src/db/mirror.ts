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
 *  - their `gift_picks.rank` is the pick's index within the thread (our insertion order);
 *  - our items are their `purchases`, and our free-text `merchant` is their `merchant_id` FK;
 *  - our `{userId, itemId, type}` reaction is their polymorphic `(target_type, target_id, kind)`.
 */
import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { getPool } from './postgres.js';
import { db, newId, now } from './store.js';
import type {
  CommentRow,
  ContributionRow,
  GiftThreadRow,
  ItemRow,
  ReactionRow,
  ReactionType,
} from './types.js';
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

/* -------------------------------------------------------------------------- */
/* Social layer - items and reactions                                          */
/* -------------------------------------------------------------------------- */

/**
 * Where a `reactions.target_id` points. Their table is polymorphic and carries no discriminator
 * we can derive offline, so the id's presence in each table is the only honest answer.
 */
export type ReactionTarget = 'purchase' | 'product';

/**
 * Pure half of the target resolution. `purchases` wins a tie: a real purchase is the richer
 * row, and hydration only manufactures a synthetic item when the id is *not* already an item.
 */
export function resolveTargetType(inPurchases: boolean, inProducts: boolean): ReactionTarget | null {
  if (inPurchases) return 'purchase';
  if (inProducts) return 'product';
  return null;
}

/** Asks Postgres which table owns the id. Null means neither, so there is no FK to point at. */
async function locateTarget(client: PoolClient, id: string): Promise<ReactionTarget | null> {
  const { rows } = await client.query<{ purchase: boolean; product: boolean }>(
    `select exists(select 1 from purchases where id = $1) as purchase,
            exists(select 1 from products  where id = $1) as product`,
    [id],
  );
  const row = rows[0];
  return resolveTargetType(row?.purchase ?? false, row?.product ?? false);
}

/**
 * Their `merchants` is a shared dimension table that the 3k-row product catalogue joins against,
 * and we do not know its full column set or its unique constraints. Inserting into it could
 * either trip a NOT NULL we cannot see (which would lose the purchase behind it) or duplicate a
 * brand and split the catalogue's join. So: look the name up, and leave the FK null when it is
 * not there. The cost is one lossy field - an unknown merchant reads back as null after a
 * restart - and the in-memory store, which is authoritative during the demo, still has the name.
 */
async function merchantId(client: PoolClient, name: string | null): Promise<string | null> {
  if (!name) return null;
  const { rows } = await client.query<{ id: string }>(
    `select id from merchants where lower(name) = lower($1) limit 1`,
    [name],
  );
  return rows[0]?.id ?? null;
}

export const PURCHASE_SQL = `
  insert into purchases
    (id, owner_id, group_id, title, category, merchant_id, image_url, price_cents,
     purchased_at, visibility, excluded, created_at)
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11)
  on conflict (id) do update set
    group_id     = excluded.group_id,
    title        = excluded.title,
    category     = excluded.category,
    merchant_id  = coalesce(excluded.merchant_id, purchases.merchant_id),
    image_url    = coalesce(excluded.image_url, purchases.image_url),
    price_cents  = coalesce(excluded.price_cents, purchases.price_cents),
    purchased_at = coalesce(excluded.purchased_at, purchases.purchased_at),
    visibility   = excluded.visibility`;

/**
 * Bind parameters for PURCHASE_SQL. Split out so the mapping is testable without a socket.
 *
 * Deliberately absent: `owner_id` is never updated on conflict (we do not reassign someone
 * else's row), `excluded` is only ever written as false on insert (un-hiding a row a teammate
 * hid is not ours to do), and `embedding` is not written at all - our vectors are 512-dim from
 * EMBED_DIM while their pgvector column is sized by their own pipeline, and a dimension
 * mismatch would fail the whole statement to save a column nothing renders.
 */
export function purchaseParams(item: ItemRow, merchant: string | null): unknown[] {
  return [
    item.id,
    item.ownerId,
    item.groupId,
    item.name,
    item.category,
    merchant,
    item.imageUrl,
    item.priceCents,
    item.purchasedAt,
    item.visibility,
    item.createdAt,
  ];
}

async function pushItem(client: PoolClient, item: ItemRow): Promise<void> {
  await client.query(PURCHASE_SQL, purchaseParams(item, await merchantId(client, item.merchant)));
}

/**
 * Their `kind` is free-form across every target type; hydration reads `heart` on purchases and
 * `heart`/`wishlist`/`save` on products, so writing our two types verbatim round-trips.
 */
const REACTION_KIND: Record<ReactionType, string> = {
  heart: 'heart',
  wishlist: 'wishlist',
};

export const REACTION_SQL = `
  insert into reactions (id, user_id, target_type, target_id, kind, group_id, created_at)
  values ($1,$2,$3,$4,$5,$6,$7)
  on conflict do nothing`;

/**
 * Bind parameters for REACTION_SQL. `on conflict do nothing` with no target because we do not
 * know which unique constraint they put on the tuple, and a reaction has nothing to update.
 */
export function reactionParams(
  id: string,
  row: ReactionRow,
  targetType: ReactionTarget,
  groupId: string | null,
): unknown[] {
  return [id, row.userId, targetType, row.itemId, REACTION_KIND[row.type], groupId, row.createdAt];
}

/** Mirrors one item into `purchases`, creating the row if it is new to them. */
export function mirrorItem(itemId: string): Promise<void> {
  return mirror('item', { itemId }, async (client) => {
    const item = db.items.find((i) => i.id === itemId);
    if (!item) return;
    // A synthetic wishlist item carries a `products` id, not a `purchases` id. Writing it into
    // `purchases` would invent a purchase that never happened.
    if ((await locateTarget(client, item.id)) === 'product') return;
    await pushItem(client, item);
  });
}

/** Bulk form for receipt ingest, which lands several rows behind one response. */
export function mirrorItems(itemIds: readonly string[]): Promise<void> {
  return mirror('items', { count: itemIds.length }, async (client) => {
    for (const id of itemIds) {
      const item = db.items.find((i) => i.id === id);
      if (!item) continue;
      if ((await locateTarget(client, item.id)) === 'product') continue;
      await pushItem(client, item);
    }
  });
}

/**
 * Mirrors one reaction, resolving `target_type` against the live tables first. If the id is in
 * neither table it is an item we created this session and have not pushed yet, so the purchase
 * goes in ahead of the reaction - the FK has to exist before the row that references it. This is
 * why `POST /wishlist/link` mirrors through here rather than firing an item and a reaction in
 * parallel: two `void`ed mirrors would race and the reaction could lose.
 */
export function mirrorReaction(userId: string, itemId: string, type: ReactionType): Promise<void> {
  return mirror('reaction', { userId, itemId, type }, async (client) => {
    const row = db.reactions.find(
      (r) => r.userId === userId && r.itemId === itemId && r.type === type,
    );
    if (!row) return;

    const item = db.items.find((i) => i.id === itemId);
    let target = await locateTarget(client, itemId);
    if (!target) {
      if (!item) return;
      await pushItem(client, item);
      target = 'purchase';
    }

    await client.query(REACTION_SQL, reactionParams(newId(), row, target, item?.groupId ?? null));
  });
}

/**
 * The only DELETE in this file. Un-hearting your own thing is the one case where removing a row
 * is the correct projection, so the predicate is pinned to exactly that row: the acting user,
 * that one target id, that one kind. Never widen it - every teammate's reactions, on every
 * target type they own, live in this same table.
 */
export function unmirrorReaction(
  userId: string,
  itemId: string,
  type: ReactionType,
): Promise<void> {
  return mirror('reaction.delete', { userId, itemId, type }, async (client) => {
    await client.query(
      `delete from reactions where user_id = $1 and target_id = $2 and kind = $3`,
      [userId, itemId, REACTION_KIND[type]],
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Comments                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * Their `comments` table soft-deletes via `deleted_at`, so retiring a comment is an UPDATE and
 * the no-DELETE rule above costs us nothing. Two more differences from the reaction mirror:
 * `target_id` carries no foreign key (the column is polymorphic), so there is nothing to push
 * ahead of a comment; but `group_id` IS a NOT NULL foreign key, so a comment on an ungrouped
 * private item is unmirrorable by construction and is skipped rather than forced.
 */

export const COMMENT_SQL = `
  insert into comments
    (id, user_id, group_id, target_type, target_id, parent_id, body, created_at, edited_at, deleted_at)
  values ($1,$2,$3,$4::target_kind,$5,$6,$7,$8,$9,$10)
  on conflict (id) do update set
    body       = excluded.body,
    edited_at  = excluded.edited_at,
    -- a retired comment stays retired; the mirror never resurrects one
    deleted_at = coalesce(comments.deleted_at, excluded.deleted_at)`;

export function commentParams(row: CommentRow): unknown[] {
  return [
    row.id,
    row.userId,
    row.groupId,
    row.targetType,
    row.targetId,
    row.parentId,
    row.body,
    row.createdAt,
    row.editedAt,
    row.deletedAt,
  ];
}

async function pushComment(client: PoolClient, row: CommentRow): Promise<void> {
  // Their `group_id` is NOT NULL and an FK; there is no honest value to invent for a comment on
  // an ungrouped private item, so it simply does not exist for the frontend.
  if (!row.groupId) {
    logger.info('comment not mirrored: no group', { commentId: row.id });
    return;
  }
  await client.query(COMMENT_SQL, commentParams(row));
}

/** Mirrors one comment, pushing its parent first so the self-FK is always satisfiable. */
export function mirrorComment(commentId: string): Promise<void> {
  return mirror('comment', { commentId }, async (client) => {
    const row = db.comments.find((c) => c.id === commentId);
    if (!row) return;

    if (row.parentId) {
      const parent = db.comments.find((c) => c.id === row.parentId);
      if (parent) await pushComment(client, parent);
    }
    await pushComment(client, row);
  });
}

/**
 * Retires a comment. This is an UPDATE, never a DELETE: their schema already models removal as
 * `deleted_at`, and the predicate is pinned to the single row the author actually deleted -
 * every teammate's comments, on every target type they own, live in this same table.
 */
export function unmirrorComment(commentId: string): Promise<void> {
  return mirror('comment.delete', { commentId }, async (client) => {
    const row = db.comments.find((c) => c.id === commentId);
    await client.query(
      `update comments set deleted_at = coalesce(deleted_at, $2) where id = $1`,
      [commentId, row?.deletedAt ?? now()],
    );
  });
}
