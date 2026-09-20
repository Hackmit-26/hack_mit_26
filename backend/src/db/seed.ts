import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { evenSplit } from '../domain/splits.js';
import { db, now } from './store.js';
import type {
  ContributionRow,
  GiftPickRow,
  GiftThreadRow,
  ItemRow,
  MembershipRow,
  ReactionRow,
  UserRow,
} from './types.js';

/**
 * Deterministic ids so the frontend, the other agents' tests and the demo script can all hardcode
 * them. Auth in dev is `Authorization: Bearer dev:<userId>`, so these double as demo logins.
 */
export const DEMO_USER_IDS = {
  priya: 'user-priya',
  sam: 'user-sam',
  maya: 'user-maya',
  leo: 'user-leo',
} as const;

export const DEMO_GROUP_ID = 'group-demo';
export const DEMO_INVITE_CODE = 'HACKMIT';

/**
 * §15: Priya is the birthday recipient, so she must never be the account we present from.
 * Sam organises both threads and is the safe stage login.
 */
export const DEMO_RECIPIENT_ID = DEMO_USER_IDS.priya;
export const DEMO_ORGANISER_ID = DEMO_USER_IDS.sam;

/** The heart that makes the gift picker look inspired: Priya hearted Sam's refurbished SX-70. */
export const DEMO_STAR_ITEM_ID = 'item-sam-01';

export const DEMO_BIRTHDAY_THREAD_ID = 'thread-priya-birthday';
export const DEMO_REVERSAL_THREAD_ID = 'thread-maya-birthday';
export const DEMO_REVERSAL_PICK_ID = 'pick-maya-bike-computer';

/** Budget for the birthday thread. Chosen so the hearted SX-70 (329.00) sits at the top end. */
export const DEMO_BUDGET_MIN_CENTS = 15_000;
export const DEMO_BUDGET_MAX_CENTS = 36_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const personaItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  merchant: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().positive(),
  purchasedAt: z.string().regex(ISO_DATE).nullable(),
  visibility: z.enum(['private', 'shared', 'anonymous']),
});

const personasFileSchema = z.object({
  group: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    emoji: z.string().min(1),
    inviteCode: z.string().min(1),
  }),
  personas: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      avatarUrl: z.url(),
      birthday: z.string().regex(ISO_DATE),
      /** When set, the birthday is rewritten to this many days from today so nudges stay live. */
      birthdayInDays: z.number().int().min(0).optional(),
      visaCardRef: z.string().min(1),
      cardLast4: z.string().length(4),
      blurb: z.string().min(1),
      items: z.array(personaItemSchema).min(1),
    }),
  ),
  reactions: z.array(
    z.object({
      userId: z.string().min(1),
      itemId: z.string().min(1),
      type: z.enum(['heart', 'wishlist']),
    }),
  ),
});

export type PersonasFile = z.infer<typeof personasFileSchema>;

const CANDIDATE_PATHS = [
  fileURLToPath(new URL('../../fixtures/seed-personas.json', import.meta.url)),
  resolve(process.cwd(), 'fixtures/seed-personas.json'),
];

let cache: PersonasFile | undefined;

export function loadPersonas(): PersonasFile {
  if (cache) return cache;

  let raw: string | undefined;
  for (const path of CANDIDATE_PATHS) {
    try {
      raw = readFileSync(path, 'utf8');
      break;
    } catch {
      // try the next candidate
    }
  }
  if (raw === undefined) {
    throw new Error(`Could not read seed-personas.json (looked in ${CANDIDATE_PATHS.join(', ')})`);
  }

  cache = personasFileSchema.parse(JSON.parse(raw));
  return cache;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Keeps the fixture's birth year but moves the day to `inDays` from now, so the nudge fires. */
function birthdayFor(birthday: string, inDays: number | undefined, today: Date): string {
  if (inDays === undefined) return birthday;
  const year = birthday.slice(0, 4);
  const target = new Date(today.getTime() + inDays * 86_400_000);
  return `${year}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`;
}

/** §7.2: the deadline is the day before the birthday, 23:59 UTC. */
export function deadlineForBirthday(birthday: string, from = new Date()): string {
  const month = Number(birthday.slice(5, 7));
  const day = Number(birthday.slice(8, 10));
  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Malformed birthday "${birthday}"`);
  }

  let next = Date.UTC(from.getUTCFullYear(), month - 1, day, 23, 59, 0);
  if (next < from.getTime()) {
    next = Date.UTC(from.getUTCFullYear() + 1, month - 1, day, 23, 59, 0);
  }
  return new Date(next - 86_400_000).toISOString();
}

function alreadySeeded(): boolean {
  return db.groups.find((g) => g.id === DEMO_GROUP_ID) !== undefined;
}

/**
 * Loads the demo group, personas, items and reactions into the in-memory store.
 * Idempotent: calling it twice without resetDb() is a no-op.
 */
export function seedDemoData(today = new Date()): void {
  if (alreadySeeded()) return;

  const fixture = loadPersonas();
  const createdAt = now();

  const users: UserRow[] = fixture.personas.map((persona) => ({
    id: persona.id,
    name: persona.name,
    avatarUrl: persona.avatarUrl,
    birthday: birthdayFor(persona.birthday, persona.birthdayInDays, today),
    cardLast4: persona.cardLast4,
    visaCardRef: persona.visaCardRef,
  }));

  const memberships: MembershipRow[] = fixture.personas.map((persona) => ({
    groupId: fixture.group.id,
    userId: persona.id,
    joinedAt: createdAt,
  }));

  const items: ItemRow[] = fixture.personas.flatMap((persona) =>
    persona.items.map((item) => ({
      id: item.id,
      ownerId: persona.id,
      groupId: fixture.group.id,
      name: item.name,
      category: item.category,
      merchant: item.merchant,
      imageUrl: `https://picsum.photos/seed/${item.id}/600/600`,
      description: item.description,
      priceCents: item.priceCents,
      purchasedAt: item.purchasedAt,
      visibility: item.visibility,
      embedding: null,
      createdAt: createdAt,
    })),
  );

  const reactions: ReactionRow[] = fixture.reactions.map((reaction) => ({
    userId: reaction.userId,
    itemId: reaction.itemId,
    type: reaction.type,
    createdAt: createdAt,
  }));

  db.groups.insert({
    id: fixture.group.id,
    name: fixture.group.name,
    emoji: fixture.group.emoji,
    inviteCode: fixture.group.inviteCode,
    createdAt,
  });
  db.users.insertMany(users);
  db.memberships.insertMany(memberships);
  db.items.insertMany(items);
  db.reactions.insertMany(reactions);
}

/**
 * Convenience wrapper for scripts (`pnpm e2e:gift`): seeds and hands back the ids.
 * `userIds[0]` is the birthday recipient; the rest are the contributors.
 */
export function seed(today = new Date()): { groupId: string; userIds: string[] } {
  seedDemoData(today);
  return {
    groupId: DEMO_GROUP_ID,
    userIds: [
      DEMO_RECIPIENT_ID,
      ...db.memberships
        .filter((m) => m.groupId === DEMO_GROUP_ID && m.userId !== DEMO_RECIPIENT_ID)
        .map((m) => m.userId),
    ],
  };
}

/**
 * The two threads §15 needs on stage:
 *  - a fresh `picking` thread for Priya, so picks are generated live;
 *  - a pre-made `collecting` thread for Maya with two shares already pulled, which the organiser
 *    cancels to show Visa Direct reversals. Contribution rows are written directly with fake txn
 *    ids - nothing here calls Visa.
 * Idempotent, and a no-op if seedDemoData() has not run.
 */
export function seedDemoThreads(today = new Date()): void {
  if (!alreadySeeded()) return;
  if (db.giftThreads.find((t) => t.id === DEMO_BIRTHDAY_THREAD_ID)) return;

  const createdAt = now();
  const recipient = db.users.find((u) => u.id === DEMO_RECIPIENT_ID);
  const reversalRecipient = db.users.find((u) => u.id === DEMO_USER_IDS.maya);
  if (!recipient?.birthday || !reversalRecipient?.birthday) return;

  const birthdayThread: GiftThreadRow = {
    id: DEMO_BIRTHDAY_THREAD_ID,
    groupId: DEMO_GROUP_ID,
    recipientId: DEMO_RECIPIENT_ID,
    organiserId: DEMO_ORGANISER_ID,
    state: 'picking',
    budgetMinCents: DEMO_BUDGET_MIN_CENTS,
    budgetMaxCents: DEMO_BUDGET_MAX_CENTS,
    deadline: deadlineForBirthday(recipient.birthday, today),
    winningPickId: null,
    pushTxnId: null,
    pushStatus: null,
    revealAt: null,
    regenerations: 0,
    createdAt,
  };

  const reversalThread: GiftThreadRow = {
    id: DEMO_REVERSAL_THREAD_ID,
    groupId: DEMO_GROUP_ID,
    recipientId: DEMO_USER_IDS.maya,
    organiserId: DEMO_ORGANISER_ID,
    state: 'collecting',
    budgetMinCents: 20_000,
    budgetMaxCents: 30_000,
    deadline: deadlineForBirthday(reversalRecipient.birthday, today),
    winningPickId: DEMO_REVERSAL_PICK_ID,
    pushTxnId: null,
    pushStatus: null,
    revealAt: null,
    regenerations: 0,
    createdAt,
  };

  const reversalPick: GiftPickRow = {
    id: DEMO_REVERSAL_PICK_ID,
    threadId: DEMO_REVERSAL_THREAD_ID,
    productName: 'Smart Bike Computer',
    productUrl: 'https://www.kestrelrunning.com/products/smart-bike-computer',
    imageUrl: 'https://picsum.photos/seed/p107/600/600',
    priceCents: 27_900,
    merchant: 'Kestrel Running',
    reason:
      'Maya measures everything - the Pacer 5 GPS Multisport Watch and the Velo 3 Carbon Plate Racing Shoe say as much - but her cross-training rides are the one thing she has no data for.',
    citedItemIds: ['item-maya-04', 'item-maya-01'],
    source: 'ai',
    createdAt,
  };

  // Everyone except the recipient chips in (§7.4).
  const contributorIds = db.memberships
    .filter((m) => m.groupId === DEMO_GROUP_ID && m.userId !== DEMO_USER_IDS.maya)
    .map((m) => m.userId);

  // Two already pulled; the organiser's own share is still pending when he cancels on stage.
  const pulled = new Set(contributorIds.filter((id) => id !== DEMO_ORGANISER_ID));

  const contributions: ContributionRow[] = evenSplit(reversalPick.priceCents, contributorIds).map(
    (share, index) => {
      const isPulled = pulled.has(share.userId);
      return {
        id: `contrib-${DEMO_REVERSAL_THREAD_ID}-${share.userId}`,
        threadId: DEMO_REVERSAL_THREAD_ID,
        userId: share.userId,
        amountCents: share.amountCents,
        status: isPulled ? 'pulled' : 'pending',
        pullTxnId: isPulled ? `demo-pull-txn-${4_100_000_000_000 + index}` : null,
        pullStan: isPulled ? String(100_100 + index) : null,
        pullRrn: isPulled ? `62620${String(100_000 + index)}` : null,
        statusIdentifier: null,
        reversalTxnId: null,
        idempotencyKey: `contribution:contrib-${DEMO_REVERSAL_THREAD_ID}-${share.userId}:pull`,
        updatedAt: createdAt,
      };
    },
  );

  db.giftThreads.insertMany([birthdayThread, reversalThread]);
  db.giftPicks.insert(reversalPick);
  db.contributions.insertMany(contributions);
}
