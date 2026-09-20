/**
 * Supabase Postgres adapter.
 *
 * The teammate-owned schema diverges from handoff §6 (app_users/purchases/products, polymorphic
 * reactions, split behaviour+social gift reasons), so this file is the single translation layer:
 * it reads their tables and fills the in-memory working set in `db`, which every route and
 * service already runs against synchronously. Writes are mirrored back by `mirror.ts`.
 *
 * Nothing here ever deletes or truncates: teammates are working against the same database.
 */
import { Pool } from 'pg';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { db } from './store.js';
import type {
  CommentRow,
  CommentTargetType,
  ContributionRow,
  GiftPickRow,
  GiftThreadRow,
  GroupRow,
  ItemRow,
  MembershipRow,
  ReactionRow,
  UserRow,
  VoteRow,
  Visibility,
} from './types.js';
import { CONTRIBUTION_STATUSES } from '../domain/splits.js';
import { THREAD_STATES } from '../domain/threadStateMachine.js';
import type { ContributionStatus } from '../domain/splits.js';
import type { ThreadState } from '../domain/threadStateMachine.js';
import type { Product } from '../types/api.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!config.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      // Supabase's pooler terminates TLS with a cert we do not pin locally.
      ssl: { rejectUnauthorized: false },
      max: 8,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}

/* -------------------------------------------------------------------------- */
/* Column coercion                                                             */
/* -------------------------------------------------------------------------- */

const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? new Date().toISOString());

const isoOrNull = (value: unknown): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value);

/** `birthday` is a DATE; read it in UTC so it never drifts a day (§17 is timezone-naive). */
const dateOnly = (value: unknown): string | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const text = (value: unknown): string | null => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

/** avatar_key may be a storage key rather than a URL; only a real URL is usable by the client. */
const httpUrl = (value: unknown): string | null => {
  const trimmed = text(value);
  return trimmed?.startsWith('http') ? trimmed : null;
};

/** pgvector comes back as the literal "[0.1,0.2,...]". */
const vector = (value: unknown): number[] | null => {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(Number);
  const parsed: unknown = JSON.parse(String(value));
  return Array.isArray(parsed) ? parsed.map(Number) : null;
};

const VISIBILITIES = new Set<Visibility>(['private', 'shared', 'anonymous']);
const visibility = (value: unknown): Visibility => {
  const raw = String(value ?? 'private');
  return VISIBILITIES.has(raw as Visibility) ? (raw as Visibility) : 'private';
};

const threadState = (value: unknown): ThreadState => {
  const raw = String(value ?? 'picking');
  return (THREAD_STATES as readonly string[]).includes(raw) ? (raw as ThreadState) : 'picking';
};

const contributionStatus = (value: unknown): ContributionStatus => {
  const raw = String(value ?? 'pending');
  return (CONTRIBUTION_STATUSES as readonly string[]).includes(raw)
    ? (raw as ContributionStatus)
    : 'pending';
};

/** `evidence` is `[{ id, type }]`; only real purchase ids can satisfy the §1 rule 5 citation. */
function citedItemIds(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  const ids: string[] = [];
  for (const entry of evidence) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, type } = entry as { id?: unknown; type?: unknown };
    if (typeof id === 'string' && (type === 'purchase' || type === 'product')) ids.push(id);
  }
  return ids;
}

/* -------------------------------------------------------------------------- */
/* Hydration                                                                   */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

/**
 * Goes through the pool rather than a checked-out client so the hydration reads below can really
 * run in parallel. One client would serialise them and warn about overlapping queries.
 */
const query = async (sql: string): Promise<Row[]> => (await getPool().query(sql)).rows as Row[];

/**
 * Loads the whole working set into memory. Small by design: the demo group is four people and
 * a few dozen purchases. The 3k-row product catalogue is loaded separately by `catalogue.ts`.
 */
export async function hydrateFromPostgres(): Promise<void> {
  const [users, groups, memberships, purchases, reactions, threads, picks, votes, contributions] =
    await Promise.all([
      query(`select * from app_users`),
      query(`select * from groups`),
      query(`select * from memberships`),
      query(
        `select p.*, m.name as merchant_name, pr.product_url
           from purchases p
           left join merchants m on m.id = p.merchant_id
           left join products pr on pr.id = p.product_id
          where p.excluded = false`,
      ),
      query(`select * from reactions`),
      query(`select * from gift_threads`),
      query(`select * from gift_picks order by thread_id, rank`),
      query(`select * from gift_votes`),
      query(`select * from contributions`),
    ]);

  db.users.insertMany(
    users.map(
      (r): UserRow => ({
        id: String(r.id),
        name: String(r.display_name ?? r.handle ?? 'Someone'),
        avatarUrl: httpUrl(r.avatar_key),
        birthday: dateOnly(r.birthday),
        cardLast4: text(r.card_last4),
        visaCardRef: text(r.visa_card_ref),
      }),
    ),
  );

  db.groups.insertMany(
    groups.map(
      (r): GroupRow => ({
        id: String(r.id),
        name: String(r.name),
        emoji: String(r.emoji ?? '🎁'),
        inviteCode: String(r.invite_code),
        createdAt: iso(r.created_at),
      }),
    ),
  );

  db.memberships.insertMany(
    memberships.map(
      (r): MembershipRow => ({
        groupId: String(r.group_id),
        userId: String(r.user_id),
        joinedAt: iso(r.joined_at),
      }),
    ),
  );

  db.items.insertMany(
    purchases.map(
      (r): ItemRow => ({
        id: String(r.id),
        ownerId: String(r.owner_id),
        groupId: text(r.group_id),
        name: String(r.title),
        category: String(r.category ?? 'other'),
        merchant: text(r.merchant_name),
        imageUrl: httpUrl(r.image_url),
        // `purchases` has no description column; the title carries the whole signal.
        description: null,
        priceCents: r.price_cents == null ? null : Number(r.price_cents),
        purchasedAt: isoOrNull(r.purchased_at),
        visibility: visibility(r.visibility),
        embedding: vector(r.embedding),
        createdAt: iso(r.created_at),
        productUrl: text(r.product_url),
      }),
    ),
  );

  await hydrateReactions(reactions);

  db.giftThreads.insertMany(
    threads.map(
      (r): GiftThreadRow => ({
        id: String(r.id),
        groupId: String(r.group_id),
        recipientId: String(r.recipient_id),
        organiserId: String(r.organiser_id),
        state: threadState(r.state),
        budgetMinCents: Number(r.budget_min_cents ?? 0),
        budgetMaxCents: Number(r.budget_max_cents ?? 0),
        deadline: iso(r.deadline),
        winningPickId: text(r.winning_pick_id),
        pushTxnId: text(r.push_txn_id),
        pushStatus: r.push_txn_id ? 'succeeded' : null,
        revealAt: isoOrNull(r.revealed_at),
        regenerations: 0,
        createdAt: iso(r.created_at),
      }),
    ),
  );

  db.giftPicks.insertMany(
    picks.map(
      (r): GiftPickRow => ({
        id: String(r.id),
        threadId: String(r.thread_id),
        productName: String(r.product_name),
        productUrl: text(r.product_url),
        imageUrl: httpUrl(r.image_url),
        priceCents: Number(r.price_cents),
        merchant: text(r.merchant_name),
        // Their schema splits the reason in two; the API exposes one line.
        reason: [text(r.behavior_reason), text(r.social_reason)].filter(Boolean).join(' '),
        citedItemIds: citedItemIds(r.evidence),
        source: r.source === 'member' ? 'member' : 'ai',
        createdAt: iso(r.created_at),
      }),
    ),
  );

  db.votes.insertMany(
    votes.map(
      (r): VoteRow => ({
        threadId: String(r.thread_id),
        userId: String(r.user_id),
        pickId: String(r.pick_id),
      }),
    ),
  );

  db.contributions.insertMany(
    contributions.map(
      (r): ContributionRow => ({
        id: String(r.id),
        threadId: String(r.thread_id),
        userId: String(r.user_id),
        amountCents: Number(r.amount_cents),
        status: contributionStatus(r.status),
        pullTxnId: text(r.pull_txn_id),
        pullStan: null,
        pullRrn: null,
        statusIdentifier: null,
        reversalTxnId: text(r.reversal_txn_id),
        idempotencyKey: `contribution:${String(r.id)}`,
        updatedAt: iso(r.updated_at),
      }),
    ),
  );

  // Read last and on its own: comments are authorised against items, threads and picks, so it
  // can only decide what to keep once all three are in the working set.
  hydrateComments(await query(`select * from comments where deleted_at is null`));

  logger.info('hydrated from postgres', {
    users: db.users.all().length,
    groups: db.groups.all().length,
    items: db.items.all().length,
    reactions: db.reactions.all().length,
    comments: db.comments.all().length,
    threads: db.giftThreads.all().length,
    picks: db.giftPicks.all().length,
    contributions: db.contributions.all().length,
  });
}

/**
 * The 3k-row merchant catalogue the gift picker shops from. It is deliberately not part of the
 * working set in `db`: only `catalogue.ts` needs it, and only to rank candidates.
 *
 * Rows missing a usable image or price are dropped rather than patched — a pick with a broken
 * thumbnail is worse on screen than one fewer candidate, and there are thousands to spare.
 */
export async function catalogueFromPostgres(): Promise<Product[]> {
  const rows = await query(
    `select p.id, p.title, p.brand, p.product_url, p.image_url, p.price_cents,
            p.category, p.taxonomy, p.style_tags, m.name as merchant_name
       from products p
       left join merchants m on m.id = p.merchant_id`,
  );

  const products: Product[] = [];
  for (const r of rows) {
    const name = text(r.title);
    const imageUrl = httpUrl(r.image_url);
    const priceCents = r.price_cents == null ? 0 : Number(r.price_cents);
    if (!name || !imageUrl || !Number.isInteger(priceCents) || priceCents <= 0) continue;

    const tags = Array.isArray(r.style_tags) ? r.style_tags.map(String) : [];
    products.push({
      id: String(r.id),
      name,
      // Their feed has no product page; the API contract makes this nullable for that reason.
      url: httpUrl(r.product_url),
      imageUrl,
      priceCents,
      merchant: text(r.merchant_name) ?? 'Unknown',
      category: text(r.taxonomy) ?? text(r.category) ?? 'other',
      // `products` has no description. The search ranker reads this field, so give it the
      // leftover vocabulary (brand, sub-category, style tags) instead of an empty string.
      description:
        [text(r.brand), text(r.category), ...tags].filter(Boolean).join(' ') ||
        (text(r.taxonomy) ?? 'gift'),
    });
  }

  logger.info('loaded catalogue from postgres', {
    products: products.length,
    skipped: rows.length - products.length,
  });
  return products;
}

/**
 * `reactions` is polymorphic over a `target_kind` enum. Two kinds matter to gifting:
 *  - `purchase` targets map straight onto items;
 *  - `product` targets are wishlist saves against the 3k catalogue, which has no item row. Those
 *    become synthetic items owned by whoever saved them, so `signalItems` weights them 3x and the
 *    picker pins them first — exactly what a wishlist is supposed to do.
 * Reactions on wrapped cards, lore and spotlights are the frontend's concern, not gifting's.
 */
async function hydrateReactions(reactions: Row[]): Promise<void> {
  const itemIds = new Set(db.items.all().map((i) => i.id));
  const wantedProductIds = new Set<string>();
  const rows: ReactionRow[] = [];

  for (const r of reactions) {
    const targetType = String(r.target_type);
    const targetId = String(r.target_id);
    const kind = String(r.kind);
    if (targetType === 'purchase') {
      if (kind === 'heart' && itemIds.has(targetId)) {
        rows.push({ userId: String(r.user_id), itemId: targetId, type: 'heart', createdAt: iso(r.created_at) });
      }
      continue;
    }
    if (targetType !== 'product') continue;
    if (kind !== 'wishlist' && kind !== 'save' && kind !== 'heart') continue;
    wantedProductIds.add(targetId);
    rows.push({
      userId: String(r.user_id),
      itemId: targetId,
      // A catalogue save is a wishlist however the frontend labelled it.
      type: kind === 'heart' ? 'heart' : 'wishlist',
      createdAt: iso(r.created_at),
    });
  }

  if (wantedProductIds.size > 0) {
    const ids = [...wantedProductIds].map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    const products = await query(
      `select p.*, m.name as merchant_name
         from products p left join merchants m on m.id = p.merchant_id
        where p.id in (${ids})`,
    );
    const byId = new Map(products.map((p) => [String(p.id), p]));
    const owners = new Map<string, string>();
    const groupOf = new Map<string, string | null>();
    for (const r of reactions) {
      if (String(r.target_type) !== 'product') continue;
      const targetId = String(r.target_id);
      if (!owners.has(targetId)) {
        owners.set(targetId, String(r.user_id));
        groupOf.set(targetId, text(r.group_id));
      }
    }

    for (const [id, product] of byId) {
      const ownerId = owners.get(id);
      if (!ownerId || itemIds.has(id)) continue;
      db.items.insert({
        id,
        ownerId,
        groupId: groupOf.get(id) ?? null,
        name: String(product.title),
        category: String(product.taxonomy ?? product.category ?? 'other'),
        merchant: text(product.merchant_name),
        imageUrl: httpUrl(product.image_url),
        description: null,
        priceCents: product.price_cents == null ? null : Number(product.price_cents),
        // Never bought - it is a wishlist entry, so it stays giftable.
        purchasedAt: null,
        visibility: 'shared',
        embedding: vector(product.embedding),
        createdAt: iso(product.created_at),
        productUrl: text(product.product_url),
      });
    }
  }

  // Drop reactions whose synthetic item could not be built, or grounding would cite a ghost.
  const live = new Set(db.items.all().map((i) => i.id));
  db.reactions.insertMany(rows.filter((r) => live.has(r.itemId)));
}

const COMMENT_TARGETS = new Set<CommentTargetType>([
  'purchase',
  'product',
  'gift_thread',
  'gift_pick',
]);

/**
 * `comments` is polymorphic over the same `target_kind` enum as `reactions`, and is filtered the
 * same way: a comment is only loaded if this backend owns the row it hangs off and can therefore
 * decide who may read it. `purchase`/`product` targets resolve to items, `gift_thread`/`gift_pick`
 * to a thread. Comments on wrapped cards, lore and spotlights are the frontend's concern - it
 * reads Supabase directly - and loading them here would mean serving rows we cannot authorise.
 *
 * Soft-deleted rows are excluded by the caller's query. A row whose target no longer resolves is
 * dropped rather than kept orphaned: an unresolvable target is one `assertTargetVisibleTo` would
 * 404 anyway, and keeping it only risks a future listing leaking it.
 */
function hydrateComments(comments: Row[]): void {
  const itemIds = new Set(db.items.all().map((i) => i.id));
  const threadIds = new Set(db.giftThreads.all().map((t) => t.id));
  const pickIds = new Set(db.giftPicks.all().map((p) => p.id));

  const resolves = (targetType: CommentTargetType, targetId: string): boolean => {
    if (targetType === 'gift_thread') return threadIds.has(targetId);
    if (targetType === 'gift_pick') return pickIds.has(targetId);
    return itemIds.has(targetId);
  };

  const rows: CommentRow[] = [];
  for (const r of comments) {
    const targetType = String(r.target_type) as CommentTargetType;
    if (!COMMENT_TARGETS.has(targetType)) continue;
    const targetId = String(r.target_id);
    if (!resolves(targetType, targetId)) continue;

    rows.push({
      id: String(r.id),
      userId: String(r.user_id),
      groupId: text(r.group_id),
      targetType,
      targetId,
      parentId: text(r.parent_id),
      body: String(r.body),
      createdAt: iso(r.created_at),
      editedAt: isoOrNull(r.edited_at),
      deletedAt: isoOrNull(r.deleted_at),
    });
  }

  // A reply whose parent was dropped (or soft-deleted) would dangle, so it is re-rooted rather
  // than discarded: the words are still someone's, and their table's own FK would allow neither.
  const kept = new Set(rows.map((c) => c.id));
  for (const row of rows) {
    if (row.parentId && !kept.has(row.parentId)) row.parentId = null;
  }

  db.comments.insertMany(rows);
}
