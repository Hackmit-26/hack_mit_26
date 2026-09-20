/**
 * `pnpm demo:seed` - puts the frontend's four real people (Kristina, Esh, Sabina, Madhav), their
 * group "The Tea Party", their September purchases and the reactions the gift picker needs into
 * the teammates' Supabase.
 *
 * Safety contract, because two other people are working against this database right now:
 *  - Additive only. Every row this writes carries a uuid derived from SEED_NAMESPACE (uuid v5), so
 *    re-running updates our own rows and never touches anybody else's.
 *  - No DELETE, no TRUNCATE, no DROP. Every UPDATE is the `do update` half of an upsert on a
 *    deterministic id, additionally fenced by a `where` clause that only passes for our own rows.
 *  - Dry run is the default. `--commit` is required to write, and it refuses to run when the
 *    database already looks seeded with these personas unless you also pass `--force`.
 *  - `--dry-run` opens a `begin read only` transaction, so the connection physically cannot write.
 *
 * Usage:
 *   pnpm demo:seed                     # dry run, prints every statement and the row counts
 *   pnpm demo:seed --commit            # writes (refuses if the personas already exist)
 *   pnpm demo:seed --commit --force    # writes anyway
 *   pnpm demo:seed --avatar-base=http://localhost:3000   # store absolute avatar URLs
 */
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { closePool, getPool } from '../src/db/postgres.js';

/* -------------------------------------------------------------------------- */
/* Deterministic ids                                                           */
/* -------------------------------------------------------------------------- */

/** Our own namespace, so nothing we mint can collide with the teammates' hand-written uuids. */
const SEED_NAMESPACE = '5eed0000-0000-4000-8000-5ea50f000000';

/** RFC 4122 §4.3 name-based uuid (SHA-1). Same key in, same uuid out, forever. */
function uuid5(name: string, namespace = SEED_NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(ns).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* -------------------------------------------------------------------------- */
/* The four real people                                                        */
/* -------------------------------------------------------------------------- */

type PersonaKey = 'kristina' | 'esh' | 'sabina' | 'madhav';

type Persona = {
  key: PersonaKey;
  displayName: string;
  /**
   * Suffixed on purpose. `app_users.handle` is UNIQUE and the bare handles are already taken by
   * the placeholder rows this seeder is meant to sit beside, so we namespace ours.
   */
  handle: string;
  /**
   * Stored as a DATE; only month/day matter to `/groups/:id/birthdays`. Sabina's 10-02 is what
   * makes the frontend's hand-authored "Sabina's birthday is in 12 days" copy literally true on
   * 2026-09-20, which is the card the demo opens on.
   */
  birthday: string;
  cardLast4: string;
  /** Keys into `secrets/test-cards.json`; the Visa Direct sandbox pull needs a real card ref. */
  visaCardRef: string;
  role: 'member' | 'organiser';
};

/** Kristina is the viewer in `src/data/users.ts`, so she is the organiser. */
const PERSONAS: Persona[] = [
  {
    key: 'kristina',
    displayName: 'Kristina',
    handle: 'kristina.tea',
    birthday: '2001-04-18',
    cardLast4: '3304',
    visaCardRef: 'test-card-1',
    role: 'organiser',
  },
  {
    key: 'esh',
    displayName: 'Esh',
    handle: 'esh.tea',
    birthday: '2001-01-27',
    cardLast4: '0006',
    visaCardRef: 'test-card-2',
    role: 'member',
  },
  {
    key: 'sabina',
    displayName: 'Sabina',
    handle: 'sabina.tea',
    birthday: '2001-10-02',
    cardLast4: '7702',
    visaCardRef: 'test-card-3',
    role: 'member',
  },
  {
    key: 'madhav',
    displayName: 'Madhav',
    handle: 'madhav.tea',
    birthday: '2001-11-30',
    cardLast4: '3310',
    visaCardRef: 'test-card-4',
    role: 'member',
  },
];

const GROUP = {
  id: uuid5('group:tea-party'),
  name: 'The Tea Party',
  emoji: '🫖',
  /** Uppercase, matching `src/data/users.ts`. The placeholder group holds lowercase `teaparty`. */
  inviteCode: 'TEAPARTY',
};

const userId = (key: PersonaKey): string => uuid5(`user:${key}`);
const purchaseId = (frontendId: string): string => uuid5(`purchase:${frontendId}`);

/* -------------------------------------------------------------------------- */
/* Purchases, ported verbatim from src/data/purchases.ts                       */
/* -------------------------------------------------------------------------- */

/** [frontendId, owner, title, merchant, priceCents, frontendCategory, artKind, purchasedAt, sharing] */
type PurchaseTuple = [
  string,
  PersonaKey,
  string,
  string,
  number,
  string,
  string,
  string,
  'shared' | 'anonymous' | 'hidden',
];

/**
 * `date` + `time` are folded into one UTC timestamp. The backend is timezone-naive (§17) and the
 * Wrapped copy counts purchases "after 7 PM", so the wall-clock hour has to survive; treating it
 * as UTC is the only reading that keeps every number in `src/data/wrapped.ts` true.
 */
const PURCHASES: PurchaseTuple[] = [
  ['p-esh-1', 'esh', "Iced matcha", "Ichi Matcha", 680, "Food & drink", 'matcha', '2026-09-03T15:20:00Z', 'shared'],
  ['p-esh-2', 'esh', "Adidas Samba", "Adidas", 10000, "Shoes", 'sneaker', '2026-09-10T19:40:00Z', 'shared'],
  ['p-esh-3', 'esh', "Iced matcha", "Leaf Society", 720, "Food & drink", 'matcha', '2026-09-10T16:30:00Z', 'shared'],
  ['p-esh-4', 'esh', "Snail mucin essence", "Dewdrop Seoul", 3200, "Skincare", 'serum', '2026-09-11T23:52:00Z', 'shared'],
  ['p-esh-5', 'esh', "Sheet mask set", "Olive & Aloe", 1800, "Skincare", 'tube', '2026-09-12T18:15:00Z', 'shared'],
  ['p-esh-6', 'esh', "Linen tote", "Field Notes Market", 4200, "Bags", 'tote', '2026-09-13T13:10:00Z', 'shared'],
  ['p-esh-7', 'esh', "Silver drop earrings", "Silver & Sons Antiques", 5400, "Jewelry", 'earrings', '2026-09-15T14:05:00Z', 'shared'],
  ['p-esh-8', 'esh', "Signet ring", "Tin & Tulip", 3800, "Jewelry", 'ring', '2026-09-16T12:40:00Z', 'shared'],
  ['p-esh-9', 'esh', "Silver cuff", "Tin & Tulip", 4400, "Jewelry", 'ring', '2026-09-18T01:30:00Z', 'shared'],
  ['p-esh-10', 'esh', "Wool overshirt", "Threadbare Vintage", 6800, "Clothing", 'knit', '2026-09-06T15:15:00Z', 'shared'],
  ['p-esh-11', 'esh', "Vintage brass lamp", "Marlowe Vintage", 7400, "Home", 'lamp', '2026-09-08T17:50:00Z', 'anonymous'],
  ['p-esh-12', 'esh', "Iced hojicha", "Nook Café", 640, "Food & drink", 'matcha', '2026-09-19T10:20:00Z', 'shared'],
  ['p-esh-13', 'esh', "Claw clip, tortoise", "Kudo Bakery", 1200, "Accessories", 'claw', '2026-09-14T16:45:00Z', 'shared'],
  ['p-esh-14', 'esh', "Card case, tan leather", "Marlowe Vintage", 3600, "Accessories", 'cardcase', '2026-09-17T18:05:00Z', 'hidden'],
  ['p-sabina-1', 'sabina', "Adidas Samba", "Adidas", 10000, "Shoes", 'sneaker', '2026-09-07T11:30:00Z', 'shared'],
  ['p-sabina-2', 'sabina', "Iced matcha", "Kettle & Whisk", 700, "Food & drink", 'matcha', '2026-09-12T10:00:00Z', 'shared'],
  ['p-sabina-3', 'sabina', "Beaded bracelet", "Tide & Thread", 2200, "Jewelry", 'charm', '2026-09-12T11:20:00Z', 'shared'],
  ['p-sabina-4', 'sabina', "Cargo shorts", "Salt Flat Boutique", 4800, "Clothing", 'knit', '2026-09-12T13:05:00Z', 'shared'],
  ['p-sabina-5', 'sabina', "Lip tint", "Sephora", 2400, "Beauty", 'tube', '2026-09-12T14:30:00Z', 'shared'],
  ['p-sabina-6', 'sabina', "Iced hojicha", "Kudo Bakery", 620, "Food & drink", 'matcha', '2026-09-12T16:10:00Z', 'shared'],
  ['p-sabina-7', 'sabina', "Vintage brooch", "Pearl & Pine Antiques", 3400, "Jewelry", 'necklace', '2026-09-12T18:45:00Z', 'shared'],
  ['p-sabina-8', 'sabina', "Centella cream", "Olive & Aloe", 2600, "Skincare", 'tin', '2026-09-14T16:10:00Z', 'shared'],
  ['p-sabina-9', 'sabina', "Boxy band tee", "Rewind Vintage", 2800, "Clothing", 'knit', '2026-09-05T14:20:00Z', 'shared'],
  ['p-sabina-10', 'sabina', "Denim jacket", "Rewind Vintage", 5600, "Clothing", 'knit', '2026-09-13T15:40:00Z', 'shared'],
  ['p-sabina-11', 'sabina', "Bandana, faded red", "Rewind Vintage", 1200, "Accessories", 'knit', '2026-09-19T12:15:00Z', 'shared'],
  ['p-sabina-12', 'sabina', "Pinch pot", "Clay & Cloud", 2800, "Home", 'mug', '2026-09-05T17:10:00Z', 'shared'],
  ['p-sabina-13', 'sabina', "Adidas crew socks", "Adidas", 1400, "Clothing", 'knit', '2026-09-06T11:00:00Z', 'shared'],
  ['p-sabina-14', 'sabina', "Canvas weekender", "Field Notes Market", 4400, "Bags", 'tote', '2026-09-20T10:40:00Z', 'shared'],
  ['p-sabina-15', 'sabina', "Matcha whisk", "Kettle & Whisk", 2400, "Home", 'whisk', '2026-09-21T10:30:00Z', 'shared'],
  ['p-sabina-16', 'sabina', "Lug-sole boots", "Ridgeline Boots", 7800, "Shoes", 'boots', '2026-09-26T13:50:00Z', 'anonymous'],
  ['p-sabina-17', 'sabina', "Film, 2 packs", "Lensmith", 3200, "Tech", 'film', '2026-09-27T16:05:00Z', 'shared'],
  ['p-madhav-1', 'madhav', "Oat latte", "Grain & Co. Café", 520, "Food & drink", 'mug', '2026-09-01T08:10:00Z', 'shared'],
  ['p-madhav-2', 'madhav', "Oat latte", "Grain & Co. Café", 520, "Food & drink", 'mug', '2026-09-02T08:05:00Z', 'shared'],
  ['p-madhav-3', 'madhav', "Cortado", "Grain & Co. Café", 480, "Food & drink", 'mug', '2026-09-03T08:13:00Z', 'shared'],
  ['p-madhav-4', 'madhav', "Oat latte", "Grain & Co. Café", 520, "Food & drink", 'mug', '2026-09-08T08:09:00Z', 'shared'],
  ['p-madhav-5', 'madhav', "Cortado", "Grain & Co. Café", 480, "Food & drink", 'mug', '2026-09-09T08:11:00Z', 'shared'],
  ['p-madhav-6', 'madhav', "Oat latte", "Grain & Co. Café", 520, "Food & drink", 'mug', '2026-09-10T08:07:00Z', 'shared'],
  ['p-madhav-7', 'madhav', "Cortado", "Grain & Co. Café", 480, "Food & drink", 'mug', '2026-09-15T08:12:00Z', 'shared'],
  ['p-madhav-8', 'madhav', "Oat latte", "Grain & Co. Café", 520, "Food & drink", 'mug', '2026-09-16T08:06:00Z', 'shared'],
  ['p-madhav-9', 'madhav', "Cortado", "Grain & Co. Café", 480, "Food & drink", 'mug', '2026-09-17T08:10:00Z', 'shared'],
  ['p-madhav-10', 'madhav', "Iced matcha", "Mori Tea House", 700, "Food & drink", 'matcha', '2026-09-14T15:30:00Z', 'shared'],
  ['p-madhav-11', 'madhav', "Pocket notebook trio", "Sundry Paper Co.", 1200, "Stationery", 'notebook', '2026-09-05T18:20:00Z', 'shared'],
  ['p-madhav-12', 'madhav', "Braided USB-C cable", "Volta Supply", 1800, "Tech", 'cardcase', '2026-09-04T21:15:00Z', 'shared'],
  ['p-madhav-13', 'madhav', "Mechanical keyboard", "Volta Supply", 9200, "Tech", 'planner', '2026-09-11T22:05:00Z', 'shared'],
  ['p-madhav-14', 'madhav', "Ceramic dripper", "Clay & Cloud", 3400, "Home", 'cafe', '2026-09-18T19:30:00Z', 'shared'],
  ['p-madhav-15', 'madhav', "Tiny succulent", "Field Notes Market", 900, "Home", 'cabin', '2026-09-12T14:00:00Z', 'shared'],
  ['p-madhav-16', 'madhav', "Desk planner", "Sundry Paper Co.", 1600, "Stationery", 'planner', '2026-09-22T18:45:00Z', 'shared'],
  ['p-madhav-17', 'madhav', "Hojicha tin", "Mori Tea House", 1800, "Food & drink", 'tin', '2026-09-24T17:15:00Z', 'hidden'],
  ['p-kristina-1', 'kristina', "Hydrating toner", "Sephora", 2800, "Skincare", 'tube', '2026-09-12T21:20:00Z', 'shared'],
  ['p-kristina-2', 'kristina', "Camera sling bag", "Lensmith", 11200, "Tech", 'camera', '2026-09-13T23:12:00Z', 'shared'],
  ['p-kristina-3', 'kristina', "Cream blush", "Sephora", 2600, "Beauty", 'tube', '2026-09-02T20:40:00Z', 'shared'],
  ['p-kristina-4', 'kristina', "Lash serum", "Sephora", 4200, "Beauty", 'serum', '2026-09-09T22:15:00Z', 'shared'],
  ['p-kristina-5', 'kristina', "Setting spray", "Sephora", 3200, "Beauty", 'tube', '2026-09-19T21:05:00Z', 'shared'],
  ['p-kristina-6', 'kristina', "Night cream", "Sephora", 3800, "Skincare", 'tin', '2026-09-23T23:40:00Z', 'shared'],
  ['p-kristina-7', 'kristina', "Iced matcha", "Verde Café", 680, "Food & drink", 'matcha', '2026-09-08T14:10:00Z', 'shared'],
  ['p-kristina-8', 'kristina', "Iced matcha", "Sunday Matcha Bar", 720, "Food & drink", 'matcha', '2026-09-16T12:15:00Z', 'shared'],
  ['p-kristina-9', 'kristina', "Adidas Gazelle", "Adidas", 10000, "Shoes", 'sneaker2', '2026-09-17T20:30:00Z', 'shared'],
  ['p-kristina-10', 'kristina', "Silver hoops", "Tin & Tulip", 3400, "Jewelry", 'earrings', '2026-09-04T22:50:00Z', 'shared'],
  ['p-kristina-11', 'kristina', "Stacking rings", "Tin & Tulip", 2400, "Jewelry", 'ring', '2026-09-11T23:30:00Z', 'shared'],
  ['p-kristina-12', 'kristina', "Charm necklace", "Tin & Tulip", 4600, "Jewelry", 'charm', '2026-09-25T21:55:00Z', 'shared'],
  ['p-kristina-13', 'kristina', "Vintage leather bag", "Marlowe Vintage", 7800, "Bags", 'bag', '2026-09-11T19:20:00Z', 'shared'],
  ['p-kristina-14', 'kristina', "Pocket notebook", "Sundry Paper Co.", 600, "Stationery", 'notebook', '2026-09-06T13:20:00Z', 'shared'],
  ['p-kristina-15', 'kristina', "Oat cashmere scarf", "Threadbare Vintage", 6400, "Clothing", 'knit', '2026-09-21T20:15:00Z', 'shared'],
  ['p-kristina-16', 'kristina', "Desk lamp, brass", "Marlowe Vintage", 5200, "Home", 'lamp', '2026-09-24T22:35:00Z', 'shared'],
  ['p-kristina-17', 'kristina', "Espresso cup", "Clay & Cloud", 3000, "Home", 'mug', '2026-09-26T21:10:00Z', 'shared'],
  ['p-kristina-18', 'kristina', "Claw clip", "Kudo Bakery", 1400, "Accessories", 'claw', '2026-09-28T19:45:00Z', 'anonymous'],
  ['p-kristina-19', 'kristina', "Film camera strap", "Lensmith", 2800, "Tech", 'film', '2026-09-29T23:05:00Z', 'hidden'],
];

/**
 * `SharingState` -> `Visibility`. Their column is a CHECK over private/shared/anonymous and has no
 * notion of "hidden", so a hidden purchase becomes private: still ingested, never group-visible.
 */
const VISIBILITY: Record<PurchaseTuple[8], 'private' | 'shared' | 'anonymous'> = {
  shared: 'shared',
  anonymous: 'anonymous',
  hidden: 'private',
};

/**
 * The frontend's display categories -> the lowercase vocabulary the `products` catalogue uses in
 * `taxonomy`. The picker embeds `name + category + merchant`, so matching their words directly is
 * worth more than preserving ours. The original label is kept in `style_tags`.
 */
const CATEGORY: Record<string, string> = {
  'Food & drink': 'drinks',
  Shoes: 'shoes',
  Skincare: 'skincare',
  Beauty: 'skincare',
  Bags: 'apparel',
  Jewelry: 'jewelry',
  Clothing: 'apparel',
  Accessories: 'apparel',
  Home: 'home',
  Tech: 'tech',
  Stationery: 'stationery',
};

/* -------------------------------------------------------------------------- */
/* Reactions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Wishlist saves, resolved against the real `products` table at run time.
 *
 * `signalItems` weights a wishlist 3x and the picker pins it above everything else, so these are
 * the rows the gift demo actually turns on. Each one is anchored to something the person really
 * bought, and each is resolved by scoring `products` on keyword hits inside a price band rather
 * than by a hardcoded id - the catalogue is the teammates' table and their ids are not ours to
 * guess.
 */
type WishlistSpec = {
  owner: PersonaKey;
  /** The purchase in PURCHASES this save is meant to rhyme with; printed in the dry run. */
  anchor: string;
  keywords: string[];
  taxonomy: string | null;
  minCents: number;
  maxCents: number;
  targetCents: number;
};

const WISHLIST: WishlistSpec[] = [
  {
    owner: 'esh',
    anchor: 'p-esh-4 Snail mucin essence',
    keywords: ['serum', 'essence', 'hydration', 'face'],
    taxonomy: 'skincare',
    minCents: 3000,
    maxCents: 7500,
    targetCents: 4800,
  },
  {
    owner: 'esh',
    anchor: 'p-esh-6 Linen tote',
    keywords: ['tote', 'market', 'canvas', 'bag'],
    taxonomy: null,
    minCents: 1500,
    maxCents: 9000,
    targetCents: 4200,
  },
  {
    owner: 'esh',
    anchor: 'p-esh-1 Iced matcha',
    keywords: ['whisk', 'matcha', 'green tea', 'tea'],
    taxonomy: null,
    minCents: 1000,
    maxCents: 11000,
    targetCents: 2400,
  },
  {
    owner: 'sabina',
    anchor: 'p-sabina-17 Film, 2 packs',
    keywords: ['camera', 'film', 'instant', 'analog'],
    taxonomy: null,
    minCents: 4000,
    maxCents: 15000,
    targetCents: 12000,
  },
  {
    owner: 'sabina',
    anchor: 'p-sabina-1 Adidas Samba',
    keywords: ['sneaker', 'runner', 'cruiser', 'dasher', 'shoe'],
    taxonomy: 'shoes',
    minCents: 6000,
    maxCents: 14000,
    targetCents: 10000,
  },
  {
    owner: 'sabina',
    anchor: 'p-sabina-14 Canvas weekender',
    keywords: ['weekender', 'duffle', 'utility', 'bag'],
    taxonomy: null,
    minCents: 2000,
    maxCents: 9000,
    targetCents: 4400,
  },
  {
    owner: 'madhav',
    anchor: 'p-madhav-11 Pocket notebook trio',
    keywords: ['pocket notebook', 'notebook', 'set of 3'],
    taxonomy: 'stationery',
    minCents: 800,
    maxCents: 3000,
    targetCents: 1200,
  },
  {
    owner: 'madhav',
    anchor: 'p-madhav-1 Oat latte',
    keywords: ['coffee', 'roast', 'espresso', 'single-origin'],
    taxonomy: 'drinks',
    minCents: 1200,
    maxCents: 4000,
    targetCents: 2000,
  },
  {
    owner: 'madhav',
    anchor: 'p-madhav-12 Braided USB-C cable',
    keywords: ['cable', 'usb', 'charger'],
    taxonomy: 'tech',
    minCents: 1500,
    maxCents: 5000,
    targetCents: 2500,
  },
  {
    owner: 'kristina',
    anchor: 'p-kristina-6 Night cream',
    keywords: ['cream', 'night', 'hydration', 'face'],
    taxonomy: 'skincare',
    minCents: 2500,
    maxCents: 7000,
    targetCents: 4000,
  },
  {
    owner: 'kristina',
    anchor: 'p-kristina-17 Espresso cup',
    keywords: ['mug', 'porcelain', 'ceramic', 'diner'],
    taxonomy: null,
    minCents: 1500,
    maxCents: 5000,
    targetCents: 3000,
  },
  {
    owner: 'kristina',
    anchor: 'p-kristina-15 Oat cashmere scarf',
    keywords: ['scarf', 'merino', 'wool', 'cashmere'],
    taxonomy: 'apparel',
    minCents: 4000,
    maxCents: 10000,
    targetCents: 6400,
  },
];

/** [who hearts it, which frontend purchase id]. Never your own, never a `hidden` purchase. */
const HEARTS: [PersonaKey, string][] = [
  ['kristina', 'p-esh-2'],
  ['kristina', 'p-esh-7'],
  ['kristina', 'p-sabina-8'],
  ['kristina', 'p-madhav-14'],
  ['esh', 'p-kristina-9'],
  ['esh', 'p-kristina-11'],
  ['esh', 'p-sabina-15'],
  ['esh', 'p-madhav-10'],
  ['sabina', 'p-esh-6'],
  ['sabina', 'p-esh-1'],
  ['sabina', 'p-kristina-2'],
  ['sabina', 'p-madhav-13'],
  ['madhav', 'p-kristina-17'],
  ['madhav', 'p-sabina-12'],
  ['madhav', 'p-esh-12'],
  ['madhav', 'p-sabina-17'],
];

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

type Statement = { sql: string; params: unknown[] };
type Step = { label: string; table: string; statements: Statement[] };

const MERCHANT_SQL = `insert into merchants (id, name, is_visa_merchant)
values ($1, $2, false)
on conflict (name) do nothing`;

const USER_SQL = `insert into app_users (id, handle, display_name, avatar_key, birthday, card_last4, visa_card_ref)
values ($1, $2, $3, $4, $5::date, $6, $7)
on conflict (id) do update set
  handle = excluded.handle,
  display_name = excluded.display_name,
  avatar_key = excluded.avatar_key,
  birthday = excluded.birthday,
  card_last4 = excluded.card_last4,
  visa_card_ref = excluded.visa_card_ref
where app_users.handle = excluded.handle`;

const GROUP_SQL = `insert into groups (id, name, emoji, invite_code, created_by)
values ($1, $2, $3, $4, $5)
on conflict (id) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  invite_code = excluded.invite_code,
  created_by = excluded.created_by
where groups.invite_code = excluded.invite_code`;

const MEMBERSHIP_SQL = `insert into memberships (group_id, user_id, role)
values ($1, $2, $3)
on conflict (group_id, user_id) do update set role = excluded.role
where memberships.group_id = excluded.group_id`;

const PURCHASE_SQL = `insert into purchases
  (id, owner_id, group_id, merchant_id, title, category, style_tags, art_kind,
   price_cents, purchased_at, visibility, excluded, source)
values ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10::timestamptz, $11, false, 'seed')
on conflict (id) do update set
  owner_id = excluded.owner_id,
  merchant_id = excluded.merchant_id,
  title = excluded.title,
  category = excluded.category,
  style_tags = excluded.style_tags,
  art_kind = excluded.art_kind,
  price_cents = excluded.price_cents,
  purchased_at = excluded.purchased_at,
  visibility = excluded.visibility
where purchases.group_id = excluded.group_id`;

const REACTION_SQL = `insert into reactions (id, user_id, group_id, target_type, target_id, kind)
values ($1, $2, $3, $4::target_kind, $5, $6)
on conflict (user_id, target_type, target_id, kind) do nothing`;

/** The whole scoring rule lives here so the dry run can show you exactly how a save was chosen. */
const PRODUCT_MATCH_SQL = `select id, title, price_cents, merchant, score from (
  select p.id, p.title, p.price_cents, coalesce(m.name, '(none)') as merchant,
         (select count(*) from unnest($1::text[]) k where p.title ilike '%' || k || '%') * 3
       + (select count(*) from unnest($1::text[]) k
           where coalesce(p.category, '') || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.taxonomy, '')
                 ilike '%' || k || '%') as score
    from products p
    left join merchants m on m.id = p.merchant_id
   where p.price_cents between $2 and $3
     and p.image_url is not null
     and ($4::text is null or p.taxonomy = $4::text)
     and p.id <> all($5::uuid[])
     and not exists (
       select 1 from reactions r where r.target_type = 'product' and r.target_id = p.id
     )
) ranked
where score > 0
order by score desc, abs(price_cents - $6) asc, id asc
limit 1`;

type ResolvedWishlist = WishlistSpec & {
  productId: string;
  productTitle: string;
  productPriceCents: number;
  productMerchant: string;
  score: number;
};

async function buildPlan(
  client: PoolClient,
  avatarBase: string,
): Promise<{ steps: Step[]; wishlist: ResolvedWishlist[]; unmatched: WishlistSpec[] }> {
  const steps: Step[] = [];

  /* Merchants: reuse the teammates' rows wherever the name already exists, mint only what is
     missing. `merchants.name` is UNIQUE, so `on conflict (name) do nothing` can never clobber a
     row we did not create. */
  const names = [...new Set(PURCHASES.map((p) => p[3]))].sort();
  const existing = await client.query<{ id: string; name: string }>(
    `select id, name from merchants where name = any($1::text[])`,
    [names],
  );
  const merchantIds = new Map(existing.rows.map((r) => [r.name, r.id]));
  const missing = names.filter((n) => !merchantIds.has(n));
  for (const name of missing) merchantIds.set(name, uuid5(`merchant:${name}`));

  steps.push({
    label: `merchants (${existing.rowCount ?? 0} reused, ${missing.length} new)`,
    table: 'merchants',
    statements: missing.map((name) => ({
      sql: MERCHANT_SQL,
      params: [merchantIds.get(name), name],
    })),
  });

  steps.push({
    label: 'app_users',
    table: 'app_users',
    statements: PERSONAS.map((p) => ({
      sql: USER_SQL,
      params: [
        userId(p.key),
        p.handle,
        p.displayName,
        `${avatarBase}/people/${p.key}.jpg`,
        p.birthday,
        p.cardLast4,
        p.visaCardRef,
      ],
    })),
  });

  steps.push({
    label: 'groups',
    table: 'groups',
    statements: [
      {
        sql: GROUP_SQL,
        params: [GROUP.id, GROUP.name, GROUP.emoji, GROUP.inviteCode, userId('kristina')],
      },
    ],
  });

  steps.push({
    label: 'memberships',
    table: 'memberships',
    statements: PERSONAS.map((p) => ({
      sql: MEMBERSHIP_SQL,
      params: [GROUP.id, userId(p.key), p.role],
    })),
  });

  steps.push({
    label: 'purchases',
    table: 'purchases',
    statements: PURCHASES.map((t) => {
      const [fid, owner, title, merchant, cents, category, art, at, sharing] = t;
      return {
        sql: PURCHASE_SQL,
        params: [
          purchaseId(fid),
          userId(owner),
          GROUP.id,
          merchantIds.get(merchant),
          title,
          CATEGORY[category] ?? 'other',
          [art, category.toLowerCase()],
          art,
          cents,
          at,
          VISIBILITY[sharing],
        ],
      };
    }),
  });

  /* Wishlist saves. Resolved one at a time so each pick can be excluded from the next query -
     two people saving the same product would collapse into one synthetic item in
     `hydrateReactions`, and whichever reaction the unordered read happened to see first would
     decide its owner. */
  const wishlist: ResolvedWishlist[] = [];
  const unmatched: WishlistSpec[] = [];
  const taken: string[] = [];
  for (const spec of WISHLIST) {
    const match = await client.query<{
      id: string;
      title: string;
      price_cents: number;
      merchant: string;
      score: string;
    }>(PRODUCT_MATCH_SQL, [
      spec.keywords,
      spec.minCents,
      spec.maxCents,
      spec.taxonomy,
      taken,
      spec.targetCents,
    ]);
    const row = match.rows[0];
    if (!row) {
      unmatched.push(spec);
      continue;
    }
    taken.push(row.id);
    wishlist.push({
      ...spec,
      productId: row.id,
      productTitle: row.title,
      productPriceCents: Number(row.price_cents),
      productMerchant: row.merchant,
      score: Number(row.score),
    });
  }

  steps.push({
    label: `reactions - wishlist saves (${wishlist.length}/${WISHLIST.length} matched)`,
    table: 'reactions',
    statements: wishlist.map((w) => ({
      sql: REACTION_SQL,
      params: [
        uuid5(`reaction:wishlist:${w.owner}:${w.productId}`),
        userId(w.owner),
        GROUP.id,
        'product',
        w.productId,
        'wishlist',
      ],
    })),
  });

  steps.push({
    label: 'reactions - hearts on group purchases',
    table: 'reactions',
    statements: HEARTS.map(([who, target]) => ({
      sql: REACTION_SQL,
      params: [
        uuid5(`reaction:heart:${who}:${target}`),
        userId(who),
        GROUP.id,
        'purchase',
        purchaseId(target),
        'heart',
      ],
    })),
  });

  return { steps, wishlist, unmatched };
}

/* -------------------------------------------------------------------------- */
/* Preflight                                                                   */
/* -------------------------------------------------------------------------- */

type Preflight = {
  handleClashes: string[];
  inviteCodeOwner: string | null;
  lookAlikeUsers: { id: string; handle: string; display_name: string }[];
  lookAlikeGroups: { id: string; name: string; invite_code: string }[];
  ourRows: Record<string, number>;
};

async function preflight(client: PoolClient): Promise<Preflight> {
  const handles = PERSONAS.map((p) => p.handle);
  const clashes = await client.query<{ handle: string }>(
    `select handle from app_users where handle = any($1::text[]) and id <> all($2::uuid[])`,
    [handles, PERSONAS.map((p) => userId(p.key))],
  );

  const invite = await client.query<{ id: string }>(
    `select id from groups where invite_code = $1`,
    [GROUP.inviteCode],
  );

  const lookAlikeUsers = await client.query<{ id: string; handle: string; display_name: string }>(
    `select id, handle, display_name from app_users
      where display_name = any($1::text[]) and id <> all($2::uuid[])
      order by display_name`,
    [PERSONAS.map((p) => p.displayName), PERSONAS.map((p) => userId(p.key))],
  );

  const lookAlikeGroups = await client.query<{ id: string; name: string; invite_code: string }>(
    `select id, name, invite_code from groups where name = $1 and id <> $2`,
    [GROUP.name, GROUP.id],
  );

  const counts = await client.query<Record<string, string>>(
    `select
       (select count(*) from app_users where id = any($1::uuid[])) as app_users,
       (select count(*) from groups where id = $2) as groups,
       (select count(*) from memberships where group_id = $2) as memberships,
       (select count(*) from purchases where group_id = $2) as purchases,
       (select count(*) from reactions where group_id = $2) as reactions`,
    [PERSONAS.map((p) => userId(p.key)), GROUP.id],
  );

  const ourRows: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts.rows[0] ?? {})) ourRows[k] = Number(v);

  return {
    handleClashes: clashes.rows.map((r) => r.handle),
    inviteCodeOwner: invite.rows[0]?.id ?? null,
    lookAlikeUsers: lookAlikeUsers.rows,
    lookAlikeGroups: lookAlikeGroups.rows,
    ourRows,
  };
}

/* -------------------------------------------------------------------------- */
/* Run                                                                         */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const force = argv.includes('--force');
const verbose = !argv.includes('--quiet');
const avatarBase = (argv.find((a) => a.startsWith('--avatar-base='))?.slice(14) ?? '').replace(
  /\/$/,
  '',
);

const rule = (title: string): void => console.log(`\n${'-'.repeat(78)}\n${title}\n`);
const show = (value: unknown): string =>
  typeof value === 'string'
    ? `'${value.replace(/'/g, "''")}'`
    : Array.isArray(value)
      ? `'{${value.map(String).join(',')}}'`
      : String(value);

async function main(): Promise<void> {
  const client = await getPool().connect();
  let open = false;
  try {
    // Dry runs physically cannot write: postgres rejects any INSERT inside a read-only transaction.
    await client.query(commit ? 'begin' : 'begin read only');
    open = true;

    const checks = await preflight(client);
    const { steps, wishlist, unmatched } = await buildPlan(client, avatarBase);

    rule(`seedDemoPersonas - ${commit ? 'COMMIT' : 'DRY RUN (read-only transaction)'}`);
    console.log(`  namespace    ${SEED_NAMESPACE}`);
    console.log(`  group        ${GROUP.id}  "${GROUP.name}" invite=${GROUP.inviteCode}`);
    for (const p of PERSONAS) {
      console.log(
        `  user         ${userId(p.key)}  ${p.displayName.padEnd(9)} handle=${p.handle.padEnd(13)} birthday=${p.birthday} card=${p.cardLast4}`,
      );
    }
    console.log(
      `  avatar_key   ${avatarBase || '(relative)'}/people/<name>.jpg` +
        (avatarBase.startsWith('http')
          ? ''
          : '   NOTE: postgres.ts nulls any avatar_key that is not an http URL'),
    );

    rule('PREFLIGHT');
    console.log(`  rows already owned by this seeder: ${JSON.stringify(checks.ourRows)}`);
    if (checks.handleClashes.length > 0) {
      console.log(`  FATAL: handles already taken by rows we do not own: ${checks.handleClashes.join(', ')}`);
    }
    if (checks.inviteCodeOwner && checks.inviteCodeOwner !== GROUP.id) {
      console.log(`  FATAL: invite_code '${GROUP.inviteCode}' already belongs to group ${checks.inviteCodeOwner}`);
    }
    for (const g of checks.lookAlikeGroups) {
      console.log(`  WARNING: another group is already called "${g.name}" (${g.id}, invite=${g.invite_code})`);
    }
    for (const u of checks.lookAlikeUsers) {
      console.log(`  WARNING: "${u.display_name}" already exists as ${u.id} (handle=${u.handle})`);
    }
    if (checks.lookAlikeUsers.length >= PERSONAS.length) {
      console.log(
        `\n  >>> All four personas already exist under other uuids. Committing would create a\n` +
          `  >>> SECOND cast of Kristina/Esh/Sabina/Madhav and a second "The Tea Party".\n` +
          `  >>> Reconcile with whoever seeded them before using --commit --force.`,
      );
    }

    for (const spec of unmatched) {
      console.log(
        `  WARNING: no product matched wishlist spec ${spec.owner} / ${spec.anchor} ` +
          `[${spec.keywords.join(', ')}] ${spec.minCents}-${spec.maxCents}c`,
      );
    }

    rule('WISHLIST MATCHES (resolved against the live products table)');
    for (const w of wishlist) {
      console.log(
        `  ${w.owner.padEnd(9)} ${String(w.productPriceCents).padStart(6)}c  ${w.productTitle}`,
      );
      console.log(
        `  ${' '.repeat(9)} ${w.productMerchant} | score=${w.score} | anchor=${w.anchor} | ${w.productId}`,
      );
    }

    if (verbose) {
      rule('STATEMENTS');
      for (const step of steps) {
        console.log(`\n### ${step.label} - ${step.statements.length} statement(s)\n`);
        const first = step.statements[0];
        if (!first) {
          console.log('  (nothing to do)');
          continue;
        }
        console.log(first.sql.replace(/^/gm, '  '));
        console.log('');
        step.statements.forEach((s, i) => {
          console.log(`  [${String(i + 1).padStart(3)}] ${s.params.map(show).join(', ')}`);
        });
      }
    }

    rule('ROW COUNTS');
    const totals = new Map<string, number>();
    for (const step of steps) {
      totals.set(step.table, (totals.get(step.table) ?? 0) + step.statements.length);
    }
    let total = 0;
    for (const [table, count] of [...totals].sort()) {
      console.log(`  ${table.padEnd(14)} ${String(count).padStart(4)}`);
      total += count;
    }
    console.log(`  ${'TOTAL'.padEnd(14)} ${String(total).padStart(4)}`);
    console.log(
      `\n  No DELETE, TRUNCATE, DROP or unqualified UPDATE is planned. Every write is an upsert on\n` +
        `  a uuid5(${SEED_NAMESPACE}) id, fenced so it can only ever touch a row this seeder made.`,
    );

    if (!commit) {
      await client.query('rollback');
      open = false;
      rule('DRY RUN - nothing was written. Re-run with --commit to apply.');
      return;
    }

    const blocked =
      checks.handleClashes.length > 0 ||
      (checks.inviteCodeOwner !== null && checks.inviteCodeOwner !== GROUP.id) ||
      checks.lookAlikeUsers.length >= PERSONAS.length ||
      unmatched.length > 0;

    if (blocked && !force) {
      await client.query('rollback');
      open = false;
      rule('REFUSING TO COMMIT - see the FATAL/WARNING lines above. Pass --force to override.');
      process.exitCode = 1;
      return;
    }

    for (const step of steps) {
      for (const s of step.statements) await client.query(s.sql, s.params);
      console.log(`  applied ${step.label}`);
    }
    await client.query('commit');
    open = false;
    rule(`COMMITTED ${total} row(s).`);
  } catch (error) {
    if (open) await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

await main();
