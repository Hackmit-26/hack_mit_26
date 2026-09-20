import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { evenSplit } from '../domain/splits.js';
import { db, now } from './store.js';
import type {
  CommentRow,
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
  kristina: 'kristina',
  esh: 'esh',
  sabina: 'sabina',
  madhav: 'madhav',
} as const;

export const DEMO_GROUP_ID = 'tea-party';
export const DEMO_INVITE_CODE = 'TEAPARTY';

/**
 * §15: Sabina is the birthday recipient of the live `picking` thread, so she is never the account
 * the AI picks are presented from. Kristina organises both threads and is the stage login.
 */
export const DEMO_RECIPIENT_ID = DEMO_USER_IDS.sabina;
export const DEMO_ORGANISER_ID = DEMO_USER_IDS.kristina;

/** The heart that makes the gift picker look inspired: Sabina hearted Esh's refurbished SX-70. */
export const DEMO_STAR_ITEM_ID = 'item-esh-01';

/**
 * The item the seeded comment threads are loudest about. `GET /groups/:groupId/debate` ranks the
 * threads itself - this constant is only here so tests and the stage script can name the expected
 * winner without hardcoding it inside the ranking.
 */
export const DEMO_DEBATE_ITEM_ID = 'item-esh-06';

export const DEMO_BIRTHDAY_THREAD_ID = 'thread-sabina-birthday';
export const DEMO_REVERSAL_THREAD_ID = 'thread-esh-birthday';
export const DEMO_REVERSAL_PICK_ID = 'pick-esh-oscillator';

/** Budget for the birthday thread. Chosen so the hearted SX-70 (329.00) sits at the top end. */
export const DEMO_BUDGET_MIN_CENTS = 15_000;
export const DEMO_BUDGET_MAX_CENTS = 36_000;

/**
 * "I can put in $50" - the stage line. The collecting thread's pick is priced at exactly three of
 * these so `evenSplit` hands each of the three contributors a round $50.00 with no remainder.
 */
export const DEMO_SHARE_CENTS = 5_000;

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
 *  - a fresh `picking` thread for Sabina, so picks are generated live;
 *  - a pre-made `collecting` thread for Esh with two shares already pulled, which the organiser
 *    cancels to show Visa Direct reversals. Contribution rows are written directly with fake txn
 *    ids - nothing here calls Visa.
 * Idempotent, and a no-op if seedDemoData() has not run.
 */
export function seedDemoThreads(today = new Date()): void {
  if (!alreadySeeded()) return;
  if (db.giftThreads.find((t) => t.id === DEMO_BIRTHDAY_THREAD_ID)) return;

  const createdAt = now();
  const recipient = db.users.find((u) => u.id === DEMO_RECIPIENT_ID);
  const reversalRecipient = db.users.find((u) => u.id === DEMO_USER_IDS.esh);
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
    recipientId: DEMO_USER_IDS.esh,
    organiserId: DEMO_ORGANISER_ID,
    state: 'collecting',
    budgetMinCents: 12_000,
    budgetMaxCents: 18_000,
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
    productName: 'Dual Wavefolder Oscillator Module',
    productUrl: 'https://www.signalforge.com/products/dual-wavefolder-oscillator',
    imageUrl: 'https://picsum.photos/seed/p214/600/600',
    priceCents: DEMO_SHARE_CENTS * 3,
    merchant: 'Signal Forge',
    reason:
      'Esh has the room and the cabling and nothing to put in it - the Eurorack Skiff Case 84HP is two thirds empty and the Patch Cable Pack, 20 x 3.5mm is still half coiled - so one more voice is the obvious next thing.',
    citedItemIds: ['item-esh-04', 'item-esh-05'],
    source: 'ai',
    createdAt,
  };

  // Everyone except the recipient chips in (§7.4).
  const contributorIds = db.memberships
    .filter((m) => m.groupId === DEMO_GROUP_ID && m.userId !== DEMO_USER_IDS.esh)
    .map((m) => m.userId);

  /**
   * Every share starts `pending`. The stage script is one person hopping between Kristina, Sabina
   * and Madhav and approving each $50 share for real, so nothing may be pre-pulled: a pre-pulled
   * row cannot be approved again and would take that person's moment away. The reversal beat is
   * still reachable - approve one or two, then cancel as the organiser.
   */
  const contributions: ContributionRow[] = evenSplit(reversalPick.priceCents, contributorIds).map(
    (share) => ({
      id: `contrib-${DEMO_REVERSAL_THREAD_ID}-${share.userId}`,
      threadId: DEMO_REVERSAL_THREAD_ID,
      userId: share.userId,
      amountCents: share.amountCents,
      status: 'pending',
      pullTxnId: null,
      pullStan: null,
      pullRrn: null,
      pullApprovalCode: null,
      pullTransmissionDateTime: null,
      statusIdentifier: null,
      reversalTxnId: null,
      idempotencyKey: `contribution:contrib-${DEMO_REVERSAL_THREAD_ID}-${share.userId}:pull`,
      updatedAt: createdAt,
    }),
  );

  db.giftThreads.insertMany([birthdayThread, reversalThread]);
  db.giftPicks.insert(reversalPick);
  db.contributions.insertMany(contributions);
}

/* -------------------------------------------------------------------------- */
/* Comments: the group chat the "most argued about" card is computed from      */
/* -------------------------------------------------------------------------- */

type SeedComment = {
  /** Suffixed onto `comment-demo-` for a stable id a reply can point at. */
  key: string;
  userId: string;
  /** Whole days back from the seed's `today`; always >= 1 so nothing lands in the future. */
  daysAgo: number;
  /** UTC `HH:MM` on that day. */
  time: string;
  body: string;
  replyTo?: string;
};

const commentId = (key: string): string => `comment-demo-${key}`;

/** First message of the loudest thread; doubles as the idempotency probe. */
const DEMO_FIRST_COMMENT_ID = commentId('synth-01');

/**
 * Three real threads, not one, so "most discussed" is a comparison the endpoint has to win rather
 * than a single thread by default. The synth argument is the intended winner on message count;
 * the knife and the camera exist to be beaten.
 */
const DEMO_COMMENT_THREADS: { itemId: string; comments: SeedComment[] }[] = [
  {
    // Mother-25 Semi-Modular Synth (Esh). Three days, four people, five nested replies.
    itemId: DEMO_DEBATE_ITEM_ID,
    comments: [
      {
        key: 'synth-01',
        userId: DEMO_USER_IDS.sabina,
        daysAgo: 5,
        time: '10:02',
        body: 'esh your 84HP skiff is two thirds empty and you have bought a whole new instrument to not put in it',
      },
      {
        key: 'synth-02',
        userId: DEMO_USER_IDS.esh,
        daysAgo: 5,
        time: '10:09',
        replyTo: 'synth-01',
        body: 'the case is empty BECAUSE i was waiting for this. the skiff was a promise to my future self',
      },
      {
        key: 'synth-03',
        userId: DEMO_USER_IDS.madhav,
        daysAgo: 5,
        time: '10:21',
        body: 'semi-modular is a different argument. that ladder filter self-oscillates. it is a real instrument, not a module',
      },
      {
        key: 'synth-04',
        userId: DEMO_USER_IDS.kristina,
        daysAgo: 5,
        time: '10:40',
        body: 'i am neutral here. i am simply saying it is a beautiful object and the knobs look nice',
      },
      {
        key: 'synth-05',
        userId: DEMO_USER_IDS.sabina,
        daysAgo: 5,
        time: '11:02',
        replyTo: 'synth-03',
        body: 'madhav you would defend a hand-forged toothpick if it came in a wooden box. you are not neutral',
      },
      {
        key: 'synth-06',
        userId: DEMO_USER_IDS.esh,
        daysAgo: 4,
        time: '09:15',
        body: 'the patch cables are still half coiled in the bag. they have been WAITING. this is not impulse, it is overdue',
      },
      {
        key: 'synth-07',
        userId: DEMO_USER_IDS.kristina,
        daysAgo: 4,
        time: '09:31',
        replyTo: 'synth-06',
        body: 'he has bought from 12 different stores in 14 purchases. overdue is doing a lot of work in that sentence',
      },
      {
        key: 'synth-08',
        userId: DEMO_USER_IDS.kristina,
        daysAgo: 4,
        time: '09:36',
        body: 'correction: i am no longer neutral. i have now seen the purchase history',
      },
      {
        key: 'synth-09',
        userId: DEMO_USER_IDS.madhav,
        daysAgo: 4,
        time: '19:48',
        body: 'the 32 point patchbay is the point. you patch it into the case you already own. one instrument, two boxes',
      },
      {
        key: 'synth-10',
        userId: DEMO_USER_IDS.esh,
        daysAgo: 2,
        time: '11:58',
        body: 'i recorded something on it at 3am. sending it now. if you all hate it i will return the whole thing',
      },
      {
        key: 'synth-11',
        userId: DEMO_USER_IDS.sabina,
        daysAgo: 2,
        time: '12:06',
        replyTo: 'synth-10',
        body: 'ok that is genuinely gorgeous. i retract the skiff comment. keep it',
      },
      {
        key: 'synth-12',
        userId: DEMO_USER_IDS.kristina,
        daysAgo: 2,
        time: '12:12',
        body: 'madhav has had the signal forge tab open for six minutes and has gone very quiet',
      },
      {
        key: 'synth-13',
        userId: DEMO_USER_IDS.madhav,
        daysAgo: 2,
        time: '12:20',
        replyTo: 'synth-12',
        body: 'i am researching. for an article. that i am writing',
      },
    ],
  },
  {
    // Carbon Steel Gyuto 210mm (Madhav). Same day, so spanDays floors to 0 and clamps to 1.
    itemId: 'item-madhav-04',
    comments: [
      {
        key: 'gyuto-01',
        userId: DEMO_USER_IDS.esh,
        daysAgo: 7,
        time: '18:40',
        body: 'why does a knife need to rust. buy a victorinox like a normal person and stop performing',
      },
      {
        key: 'gyuto-02',
        userId: DEMO_USER_IDS.madhav,
        daysAgo: 7,
        time: '18:52',
        replyTo: 'gyuto-01',
        body: 'a victorinox is a fine knife for someone who does not care about the edge. i care about the edge',
      },
      {
        key: 'gyuto-03',
        userId: DEMO_USER_IDS.kristina,
        daysAgo: 7,
        time: '19:05',
        body: 'he hand dries it. i have watched him hand dry a knife. it took four minutes',
      },
      {
        key: 'gyuto-04',
        userId: DEMO_USER_IDS.sabina,
        daysAgo: 7,
        time: '19:20',
        body: 'blue 2 carbon is genuinely better steel though. the victorinox thing is a vibe, not a fact',
      },
      {
        key: 'gyuto-05',
        userId: DEMO_USER_IDS.esh,
        daysAgo: 7,
        time: '20:14',
        replyTo: 'gyuto-02',
        body: 'the edge you care about will be orange by october',
      },
      {
        key: 'gyuto-06',
        userId: DEMO_USER_IDS.madhav,
        daysAgo: 7,
        time: '20:30',
        body: 'it is called a patina and it is supposed to do that',
      },
    ],
  },
  {
    // Contax T2 (Kristina). Short and admiring - nobody is arguing.
    itemId: 'item-kristina-26',
    comments: [
      {
        key: 'contax-01',
        userId: DEMO_USER_IDS.sabina,
        daysAgo: 9,
        time: '15:02',
        body: 'the t2 is the correct grail. titanium, zeiss sonnar, no notes',
      },
      {
        key: 'contax-02',
        userId: DEMO_USER_IDS.madhav,
        daysAgo: 9,
        time: '15:11',
        body: 'every photo out of that thing looks like someone remembered it instead of taking it',
      },
      {
        key: 'contax-03',
        userId: DEMO_USER_IDS.kristina,
        daysAgo: 9,
        time: '15:30',
        replyTo: 'contax-02',
        body: 'madhav that is the nicest thing anyone has said about a camera i do not own yet',
      },
      {
        key: 'contax-04',
        userId: DEMO_USER_IDS.esh,
        daysAgo: 9,
        time: '15:44',
        body: 'saving up is a strong phrase for looking at it every day',
      },
    ],
  },
];

/** `daysAgo` days before `today`, at that UTC wall clock. Always in the past for daysAgo >= 1. */
function commentTimestamp(today: Date, daysAgo: number, time: string): string {
  const day = new Date(today.getTime() - daysAgo * 86_400_000);
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      Number(time.slice(0, 2)),
      Number(time.slice(3, 5)),
    ),
  ).toISOString();
}

/**
 * Seeds the three §15 comment threads so the "most argued about" card has something real to
 * compute over. Every comment hangs off a `shared` item in the demo group, so `assertItemVisibleTo`
 * lets every member read the whole thread.
 * Idempotent, and a no-op if seedDemoData() has not run.
 */
export function seedDemoComments(today = new Date()): void {
  if (!alreadySeeded()) return;
  if (db.comments.find((c) => c.id === DEMO_FIRST_COMMENT_ID)) return;

  const rows: CommentRow[] = [];
  for (const thread of DEMO_COMMENT_THREADS) {
    const item = db.items.find((i) => i.id === thread.itemId);
    if (!item) continue;

    for (const comment of thread.comments) {
      rows.push({
        id: commentId(comment.key),
        userId: comment.userId,
        groupId: item.groupId,
        targetType: 'purchase',
        targetId: item.id,
        parentId: comment.replyTo ? commentId(comment.replyTo) : null,
        body: comment.body,
        createdAt: commentTimestamp(today, comment.daysAgo, comment.time),
        editedAt: null,
        deletedAt: null,
      });
    }
  }

  db.comments.insertMany(rows);
}
