"use client";

/**
 * The live group feed. One fetch of `GET /groups/:id/finds` plus one of
 * `GET /groups/:id/wishlists`, held in a module-level cache so the grid and the
 * item modal read the same rows rather than each asking the server separately.
 *
 * The cache is stamped with the viewer it was fetched as. Switching person
 * remounts the tree (see `setViewerId` in `@/state/store`) but module state
 * survives that, and `iHearted` / `iWishlisted` / a stripped `ownerId` are all
 * viewer-relative — so a stamp mismatch reads as no cache at all.
 */

import { useCallback, useEffect, useState } from "react";

import {
  addReaction,
  getViewerId,
  listGroupFinds,
  listGroupWishlists,
  removeReaction,
} from "@/lib/api";
import type { FindItem, WishlistRoster } from "@/lib/apiTypes";
import { users } from "@/data/users";
import type { ArtKind, UserId } from "@/lib/types";
import type { CommentTarget } from "@/state/store";

export type RosterUser = WishlistRoster["users"][number];

export interface FindsApi {
  finds(groupId: string): Promise<FindItem[]>;
  wishlists(groupId: string): Promise<WishlistRoster[]>;
  heart(itemId: string, on: boolean): Promise<void>;
  wishlist(itemId: string, on: boolean): Promise<void>;
}

const backendFindsApi: FindsApi = {
  finds: listGroupFinds,
  wishlists: listGroupWishlists,
  heart: (itemId, on) =>
    on ? addReaction({ itemId, type: "heart" }) : removeReaction({ itemId, type: "heart" }),
  wishlist: (itemId, on) =>
    on ? addReaction({ itemId, type: "wishlist" }) : removeReaction({ itemId, type: "wishlist" }),
};

let findsApi: FindsApi = backendFindsApi;

/** THE API SEAM. Nothing else in the app talks to the finds endpoints. Tests inject here. */
export function setFindsApi(api: FindsApi): void {
  findsApi = api;
}

/* ------------------------------------------------------------------ cache */

interface Cache {
  viewerId: string | null;
  groupId: string;
  finds: FindItem[];
  rosters: Record<string, RosterUser[]>;
}

let cache: Cache | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** A cache fetched as somebody else is not stale, it is wrong. */
function live(groupId?: string): Cache | null {
  if (!cache) return null;
  if (cache.viewerId !== getViewerId()) return null;
  if (groupId !== undefined && cache.groupId !== groupId) return null;
  return cache;
}

export function getCachedFind(itemId: string): FindItem | null {
  return live()?.finds.find((f) => f.id === itemId) ?? null;
}

export function getCachedRoster(itemId: string): RosterUser[] {
  return live()?.rosters[itemId] ?? [];
}

/** Only for tests: drops the cache so the next mount fetches again. */
export function clearFindsCache(): void {
  cache = null;
  emit();
}

function patchFind(itemId: string, patch: Partial<FindItem>): void {
  const current = live();
  if (!current) return;
  cache = {
    ...current,
    finds: current.finds.map((f) => (f.id === itemId ? { ...f, ...patch } : f)),
  };
  emit();
}

/**
 * Optimistic: the badge moves on the click, and rolls back only if the server
 * refuses. `heartCount` is an anonymous aggregate — §1 rule 4 forbids ever
 * naming who hearted an item, so the count is all there is to move.
 */
export async function toggleFindHeart(itemId: string): Promise<void> {
  const find = getCachedFind(itemId);
  if (!find) return;

  const on = !find.iHearted;
  patchFind(itemId, {
    iHearted: on,
    heartCount: Math.max(0, find.heartCount + (on ? 1 : -1)),
  });

  try {
    await findsApi.heart(itemId, on);
  } catch {
    patchFind(itemId, { iHearted: find.iHearted, heartCount: find.heartCount });
  }
}

/**
 * One write, not two. The modal reads the roster inside a memo keyed on the *find*, so a
 * roster-only emit changes nothing it can see — the two have to move in the same emit.
 */
function patchStar(itemId: string, on: boolean, roster: RosterUser[]): void {
  const current = live();
  if (!current) return;
  cache = {
    ...current,
    finds: current.finds.map((f) => (f.id === itemId ? { ...f, iWishlisted: on } : f)),
    rosters: { ...current.rosters, [itemId]: roster },
  };
  emit();
}

/**
 * Starring a find is the same `wishlist` reaction that `GET /wishlist` reads back, so this one
 * click is what puts the item on the viewer's own list *and* their name into the "On a wishlist"
 * roster everyone else sees. Both move optimistically, and both roll back together.
 */
export async function toggleFindWishlist(itemId: string): Promise<void> {
  const find = getCachedFind(itemId);
  if (!find) return;

  const on = !find.iWishlisted;
  const before = getCachedRoster(itemId);
  const viewerId = getViewerId();
  // A viewer who is not one of the demo four has no name to show, so the roster is left alone.
  const me = viewerId ? users[viewerId as UserId] : undefined;
  const without = before.filter((u) => u.id !== viewerId);
  const next = !me
    ? before
    : on
      ? [...without, { id: me.id, name: me.name, avatarUrl: null }]
      : without;

  patchStar(itemId, on, next);

  try {
    await findsApi.wishlist(itemId, on);
  } catch {
    patchStar(itemId, find.iWishlisted, before);
  }
}

/* ------------------------------------------------------------------ hooks */

export type FindsState =
  | { status: "loading" }
  | { status: "ready"; finds: FindItem[] }
  | { status: "error" };

function snapshot(groupId: string): FindsState {
  const current = live(groupId);
  return current ? { status: "ready", finds: current.finds } : { status: "loading" };
}

/** The feed. Refetches on every mount, which is also every viewer switch. */
export function useGroupFinds(groupId: string): FindsState {
  const [state, setState] = useState<FindsState>(() => snapshot(groupId));

  useEffect(() => {
    let alive = true;
    const resync = () => {
      if (alive) setState(snapshot(groupId));
    };
    listeners.add(resync);

    void (async () => {
      try {
        // One await, not two: the rosters are useless without the finds to hang them off.
        const [finds, rosters] = await Promise.all([
          findsApi.finds(groupId),
          findsApi.wishlists(groupId),
        ]);
        if (!alive) return;
        cache = {
          viewerId: getViewerId(),
          groupId,
          finds,
          rosters: Object.fromEntries(rosters.map((r) => [r.itemId, r.users])),
        };
        emit();
      } catch {
        if (alive) setState({ status: "error" });
      }
    })();

    return () => {
      alive = false;
      listeners.delete(resync);
    };
  }, [groupId]);

  return state;
}

/** One row out of the cache, kept current while a heart is toggled. */
export function useCachedFind(itemId: string | null): FindItem | null {
  const read = useCallback(() => (itemId ? getCachedFind(itemId) : null), [itemId]);
  const [find, setFind] = useState<FindItem | null>(read);

  useEffect(() => {
    setFind(read());
    const resync = () => setFind(read());
    listeners.add(resync);
    return () => {
      listeners.delete(resync);
    };
  }, [read]);

  return find;
}

/* ----------------------------------------------------------- presentation */

/**
 * Real data has no illustration key, and on real Postgres only 15 of 217 items
 * carry a photo — so the fallback is the normal case, not the edge. The
 * category picks it, which keeps a tin of tea looking like a tin of tea.
 */
const ART_BY_CATEGORY: Record<string, ArtKind> = {
  accessories: "bag",
  art_crafts: "tin",
  beauty: "serum",
  books: "notebook",
  clothing: "knit",
  food_drink: "mug",
  games: "charm",
  home: "lamp",
  kitchen: "whisk",
  music: "film",
  shoes: "sneaker",
  sports_outdoors: "cabin",
  stationery: "planner",
  tech: "camera",
};

/** Anything the seed has not seen yet still gets the same illustration every time. */
const ART_FALLBACK: ArtKind[] = ["tote", "cardcase", "tin", "planner", "mug", "charm"];

export function artForFind(find: Pick<FindItem, "id" | "category">): ArtKind {
  const known = ART_BY_CATEGORY[find.category];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < find.id.length; i += 1) hash = (hash * 31 + find.id.charCodeAt(i)) >>> 0;
  return ART_FALLBACK[hash % ART_FALLBACK.length];
}

function isUserId(value: string | null): value is UserId {
  return value !== null && value in users;
}

/** The owner's colour, or cream when the item was shared anonymously. */
export function bgForFind(find: Pick<FindItem, "ownerId">): string {
  return isUserId(find.ownerId) ? users[find.ownerId].color : "#F5ECD9";
}

export function ownerOf(find: Pick<FindItem, "ownerId">): UserId | null {
  return isUserId(find.ownerId) ? find.ownerId : null;
}

/**
 * The comment key for a find.
 *
 * `item-*` ids are real rows, so this is a real server-side target rather than
 * the hashed `wrapped_card` key the fixture tiles used: the backend authorises
 * it with `assertItemVisibleTo`, and treats `purchase` and `product` as one
 * id-space. Both the tile and the item modal use this, so opening an item joins
 * the tile's conversation rather than starting a second one.
 */
export function findCommentTarget(itemId: string): CommentTarget {
  return { targetType: "purchase", targetId: itemId };
}

/**
 * The server orders finds by recency, which in the seeded month means twenty-odd
 * of one person's things before the next person appears. A group feed that only
 * shows one member is wrong, so take them in turn instead — server order within
 * each person, anonymous items as their own queue.
 */
export function feedOrder(finds: FindItem[], limit: number): FindItem[] {
  const queues = new Map<string, FindItem[]>();
  for (const find of finds) {
    const key = find.ownerId ?? "anonymous";
    const queue = queues.get(key);
    if (queue) queue.push(find);
    else queues.set(key, [find]);
  }

  const out: FindItem[] = [];
  const rounds = [...queues.values()];
  for (let depth = 0; out.length < limit; depth += 1) {
    const before = out.length;
    for (const queue of rounds) {
      const find = queue[depth];
      if (find) out.push(find);
      if (out.length === limit) return out;
    }
    if (out.length === before) break;
  }
  return out;
}
