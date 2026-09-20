"use client";

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import { purchases as seedPurchases, seededReactions } from "@/data";
import { productsById } from "@/data/products";
import { backendGroupId, setActiveViewer, users } from "@/data/users";
import {
  addWishlistLink,
  createComment,
  deleteComment as deleteCommentRequest,
  getViewerId,
  listComments,
  listWishlist,
  removeReaction,
  resetDemo as resetDemoRequest,
  setViewer,
} from "@/lib/api";
import { DEFAULT_VIEWER_ID } from "@/lib/config";
import type { Comment, CommentTargetType } from "@/lib/apiTypes";
import type {
  ArtKind,
  PrivacySettings,
  Reaction,
  ReactionKind,
  SharingState,
  UserId,
} from "@/lib/types";
import { searchUrl } from "@/services/commerce";
import type { PurchaseOutcome } from "@/services/checkout";

/**
 * One thing the viewer wants. Catalogue saves carry a `productId`; links
 * pasted into the wishlist carry a `url` and whatever the scraper could read,
 * which is sometimes nothing but a hostname.
 */
export interface WishlistItem {
  id: string;
  source: "catalogue" | "link";
  /** Present only for catalogue saves — link items are not in `src/data`. */
  productId?: string;
  title: string;
  merchant: string;
  priceCents: number | null;
  /** Photo when we have one; `art` is the fallback illustration. */
  image?: string;
  art: ArtKind;
  bg: string;
  url?: string;
  addedAt: string;
  /** True while the link is still being read. */
  pending?: boolean;
  /** Set when the save never reached the server. */
  note?: string;
}

/** What the wishlist seam hands back — the backend's item shape. */
export interface WishlistLinkResult {
  id: string;
  name: string;
  merchant: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  url?: string | null;
}

export interface WishlistApi {
  addLink(url: string, priceCents?: number): Promise<WishlistLinkResult>;
  list(): Promise<WishlistLinkResult[]>;
  remove(itemId: string): Promise<void>;
}

/**
 * The real backend. `Item` already has the field names this seam wants, so the
 * response goes back verbatim. No fallback: an unreachable server throws, and
 * the reducer below keeps the optimistic row with a note rather than losing it.
 */
const backendWishlistApi: WishlistApi = {
  async addLink(url, priceCents) {
    const item = await addWishlistLink(priceCents === undefined ? { url } : { url, priceCents });
    return { ...item, url };
  },
  // The pasted link is not echoed back on a list, so `productUrl` is the only page there is.
  async list() {
    const items = await listWishlist();
    return items.map((item) => ({ ...item, url: item.productUrl }));
  },
  // A wishlist row *is* a `wishlist` reaction - `GET /wishlist` is just the items the viewer
  // starred - so dropping the reaction is the removal. There is no `DELETE /wishlist`.
  async remove(itemId) {
    await removeReaction({ itemId, type: "wishlist" });
  },
};

let wishlistApi: WishlistApi = backendWishlistApi;

/** THE API SEAM. Nothing else in the app talks to the wishlist endpoint. Tests inject here. */
export function setWishlistApi(api: WishlistApi): void {
  wishlistApi = api;
}

/** Whatever a comment hangs off. The backend treats `purchase` and `product` as one thing. */
export interface CommentTarget {
  targetType: CommentTargetType;
  targetId: string;
  /** Only `wrapped_card` uses it: with no row to look up, the group carries the permission. */
  groupId?: string;
}

/**
 * Wrapped cards and the seeded purchase tiles are client-side copy - their ids are strings like
 * `spot-esh`, not rows the server can resolve, and `comments.target_id` is a uuid column. So the
 * key is folded into a stable uuid here and authorised by group membership instead, which is what
 * the server's `wrapped_card` kind is for. Same key in, same uuid out, on every device.
 */
export function cardTarget(key: string): CommentTarget {
  return { targetType: "wrapped_card", targetId: keyToUuid(key), groupId: backendGroupId };
}

/** FNV-1a over four seeds. Synchronous on purpose - `crypto.subtle.digest` is not. */
function keyToUuid(key: string): string {
  let hex = "";
  for (let seed = 0; seed < 4; seed += 1) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < key.length; i += 1) {
      h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
    }
    hex += h.toString(16).padStart(8, "0");
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/**
 * A comment as the UI holds it: the server's fields, plus the bookkeeping an
 * optimistic write needs. `mine` is the only thing the delete affordance reads,
 * so a 403 is never reachable from the interface.
 */
export interface StoredComment {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** The viewer wrote this. */
  mine: boolean;
  /** In flight. */
  pending?: boolean;
  /** Set when the comment never reached the server. */
  note?: string;
  /** True until the server has acknowledged it; survives a reload of the thread. */
  local?: boolean;
}

export interface CommentsApi {
  list(target: CommentTarget): Promise<Comment[]>;
  create(target: CommentTarget, body: string, parentId: string | null): Promise<Comment>;
  remove(commentId: string): Promise<void>;
  /** The bearer token's user, so a comment the server sends back is recognised as the viewer's. */
  viewerId(): string | null;
}

const backendCommentsApi: CommentsApi = {
  list: ({ targetType, targetId, groupId }) => listComments(targetType, targetId, groupId),
  create: ({ targetType, targetId, groupId }, body, parentId) =>
    createComment({ targetType, targetId, groupId, parentId, body }),
  remove: deleteCommentRequest,
  viewerId: getViewerId,
};

let commentsApi: CommentsApi = backendCommentsApi;

/** THE API SEAM. Nothing else in the app talks to /comments. Tests inject here. */
export function setCommentsApi(api: CommentsApi): void {
  commentsApi = api;
}

export function commentKey(target: CommentTarget): string {
  return `${target.targetType}:${target.targetId}`;
}

export interface CommentThreadState {
  items: StoredComment[];
  status: "idle" | "loading" | "ready";
}

const EMPTY_THREAD: CommentThreadState = { items: [], status: "idle" };

function storedFrom(comment: Comment, viewerId: string | null): StoredComment {
  return {
    id: comment.id,
    parentId: comment.parentId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
    mine: viewerId !== null && comment.authorId === viewerId,
  };
}

function byCreatedAt(a: StoredComment, b: StoredComment): number {
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * All demo state in one place: reactions, per-item privacy, the wishlist, and
 * the purchases made from inside the Wrapped. Everything a backend would own
 * is mutated only through these actions.
 */
interface AppState {
  /** Who the app is currently being used as. Changed only by the demo viewer switcher. */
  viewerId: UserId;
  reactions: Reaction[];
  privacy: PrivacySettings;
  wishlist: WishlistItem[];
  orders: PurchaseOutcome[];
  /** Group-gift invites the viewer has sent, keyed by recipient. */
  groupGiftStarted: UserId[];
  /** Comment threads keyed by `commentKey(target)`. */
  comments: Record<string, CommentThreadState>;
}

type Action =
  | { type: "toggle-reaction"; targetId: string; kind: ReactionKind }
  | { type: "set-sharing"; purchaseId: string; sharing: SharingState }
  | { type: "toggle-amounts" }
  | { type: "toggle-category"; category: string }
  | { type: "toggle-veto"; cardId: string }
  | { type: "toggle-saved"; productId: string }
  | { type: "wishlist-add"; item: WishlistItem }
  | { type: "wishlist-resolve"; id: string; patch: Partial<WishlistItem> }
  | { type: "wishlist-remove"; id: string }
  | { type: "wishlist-merge"; items: WishlistItem[] }
  | { type: "comments-loading"; key: string }
  | { type: "comments-loaded"; key: string; items: StoredComment[] }
  | { type: "comment-add"; key: string; comment: StoredComment }
  | { type: "comment-patch"; key: string; id: string; patch: Partial<StoredComment> }
  | { type: "comment-remove"; key: string; id: string }
  | { type: "record-order"; outcome: PurchaseOutcome }
  | { type: "start-group-gift"; userId: UserId }
  | { type: "hydrate"; state: AppState }
  | { type: "switch-viewer"; userId: UserId }
  | { type: "reset-demo" };

/**
 * The person the app is being used as. Lives in state, not as a constant, because the stage demo
 * is one operator driving a four-person group gift on their own.
 */
function isUserId(value: string | undefined): value is UserId {
  return value !== undefined && value in users;
}

function initialViewerId(): UserId {
  const fromEnv = process.env.NEXT_PUBLIC_DEV_USER_ID;
  return isUserId(fromEnv) ? fromEnv : (DEFAULT_VIEWER_ID as UserId);
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || "the link";
  }
}

/** Link items get a stable illustration and tile colour from their host. */
const LINK_ARTS: ArtKind[] = ["tote", "cardcase", "tin", "planner", "mug", "film"];
const LINK_BGS = ["#BBA9E8", "#A8DCC2", "#F5E39B", "#EBB5BD"];

function hashOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** A wishlist row from the catalogue. */
function itemFromProduct(productId: string): WishlistItem {
  const p = productsById[productId];
  return {
    id: productId,
    source: "catalogue",
    productId,
    title: p?.title ?? productId,
    merchant: p?.merchant ?? "Unknown shop",
    priceCents: p?.priceCents ?? null,
    image: p?.image,
    art: p?.art ?? "tote",
    bg: p?.bg ?? "#BBA9E8",
    url: p ? searchUrl(p.title, p.merchant) : undefined,
    addedAt: new Date().toISOString(),
  };
}

/** What we show the second a link is pasted, before the scraper answers. */
export function draftFromUrl(url: string, priceCents?: number): WishlistItem {
  const host = hostnameOf(url);
  const h = hashOf(host);
  return {
    id: `wl-${nextId()}`,
    source: "link",
    title: `Reading ${host}…`,
    merchant: host,
    priceCents: priceCents ?? null,
    art: LINK_ARTS[h % LINK_ARTS.length],
    bg: LINK_BGS[h % LINK_BGS.length],
    url,
    addedAt: new Date().toISOString(),
    pending: true,
  };
}

function patchFromResult(result: WishlistLinkResult, url: string): Partial<WishlistItem> {
  return {
    title: result.name || `Saved from ${hostnameOf(url)}`,
    merchant: result.merchant ?? hostnameOf(url),
    priceCents: result.priceCents,
    image: result.imageUrl ?? undefined,
    pending: false,
    note: undefined,
  };
}

function itemFromResult(result: WishlistLinkResult): WishlistItem {
  const url = result.url ?? "";
  const host = result.merchant ?? hostnameOf(url);
  const h = hashOf(host);
  return {
    id: result.id,
    source: "link",
    title: result.name,
    merchant: host,
    priceCents: result.priceCents,
    image: result.imageUrl ?? undefined,
    art: LINK_ARTS[h % LINK_ARTS.length],
    bg: LINK_BGS[h % LINK_BGS.length],
    url: result.url ?? undefined,
    addedAt: new Date().toISOString(),
  };
}

function initialState(): AppState {
  return {
    viewerId: initialViewerId(),
    reactions: seededReactions,
    privacy: {
      showAmounts: false,
      excludedCategories: ["Health", "Pharmacy"],
      sharing: Object.fromEntries(
        seedPurchases.map((p) => [p.id, p.sharing]),
      ) as Record<string, SharingState>,
      vetoedCards: [],
    },
    wishlist: [],
    orders: [],
    groupGiftStarted: [],
    comments: {},
  };
}

function patchThread(
  state: AppState,
  key: string,
  change: (thread: CommentThreadState) => CommentThreadState,
): AppState {
  const thread = state.comments[key] ?? EMPTY_THREAD;
  return { ...state, comments: { ...state.comments, [key]: change(thread) } };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "toggle-reaction": {
      const existing = state.reactions.find(
        (r) =>
          r.targetId === action.targetId &&
          r.userId === state.viewerId &&
          r.kind === action.kind,
      );
      if (existing) {
        return {
          ...state,
          reactions: state.reactions.filter((r) => r.id !== existing.id),
        };
      }
      return {
        ...state,
        reactions: [
          ...state.reactions,
          {
            id: `r-local-${state.viewerId}-${action.targetId}-${action.kind}`,
            targetId: action.targetId,
            userId: state.viewerId,
            kind: action.kind,
          },
        ],
      };
    }

    case "set-sharing":
      return {
        ...state,
        privacy: {
          ...state.privacy,
          sharing: {
            ...state.privacy.sharing,
            [action.purchaseId]: action.sharing,
          },
        },
      };

    case "toggle-amounts":
      return {
        ...state,
        privacy: { ...state.privacy, showAmounts: !state.privacy.showAmounts },
      };

    case "toggle-category": {
      const has = state.privacy.excludedCategories.includes(action.category);
      return {
        ...state,
        privacy: {
          ...state.privacy,
          excludedCategories: has
            ? state.privacy.excludedCategories.filter((c) => c !== action.category)
            : [...state.privacy.excludedCategories, action.category],
        },
      };
    }

    case "toggle-veto": {
      const has = state.privacy.vetoedCards.includes(action.cardId);
      return {
        ...state,
        privacy: {
          ...state.privacy,
          vetoedCards: has
            ? state.privacy.vetoedCards.filter((c) => c !== action.cardId)
            : [...state.privacy.vetoedCards, action.cardId],
        },
      };
    }

    case "toggle-saved": {
      const has = state.wishlist.some((w) => w.productId === action.productId);
      return {
        ...state,
        wishlist: has
          ? state.wishlist.filter((w) => w.productId !== action.productId)
          : [itemFromProduct(action.productId), ...state.wishlist],
      };
    }

    case "wishlist-add":
      // Saving the same link twice is a mis-click, not an intent to have two.
      return state.wishlist.some(
        (w) => w.url && action.item.url && w.url === action.item.url,
      )
        ? state
        : { ...state, wishlist: [action.item, ...state.wishlist] };

    case "wishlist-resolve":
      return {
        ...state,
        wishlist: state.wishlist.map((w) =>
          w.id === action.id ? { ...w, ...action.patch } : w,
        ),
      };

    case "wishlist-remove":
      return { ...state, wishlist: state.wishlist.filter((w) => w.id !== action.id) };

    case "wishlist-merge": {
      const known = new Set(state.wishlist.map((w) => w.id));
      const fresh = action.items.filter((i) => !known.has(i.id));
      return fresh.length === 0
        ? state
        : { ...state, wishlist: [...state.wishlist, ...fresh] };
    }

    case "comments-loading":
      return patchThread(state, action.key, (t) => ({ ...t, status: "loading" }));

    case "comments-loaded":
      // Anything the server has never acknowledged is kept: a failed write is not a lost one.
      return patchThread(state, action.key, (t) => ({
        status: "ready",
        items: [...t.items.filter((c) => c.local), ...action.items].sort(byCreatedAt),
      }));

    case "comment-add":
      return patchThread(state, action.key, (t) => ({
        ...t,
        items: [...t.items, action.comment].sort(byCreatedAt),
      }));

    case "comment-patch":
      return patchThread(state, action.key, (t) => ({
        ...t,
        items: t.items
          .map((c) => (c.id === action.id ? { ...c, ...action.patch } : c))
          .sort(byCreatedAt),
      }));

    case "comment-remove":
      // Replies are left standing, exactly as the server's soft delete leaves them.
      return patchThread(state, action.key, (t) => ({
        ...t,
        items: t.items.filter((c) => c.id !== action.id),
      }));

    case "record-order":
      return { ...state, orders: [...state.orders, action.outcome] };

    case "start-group-gift":
      return state.groupGiftStarted.includes(action.userId)
        ? state
        : { ...state, groupGiftStarted: [...state.groupGiftStarted, action.userId] };

    case "hydrate":
      return action.state;

    /**
     * Everything the server scopes to the bearer token is dropped so it reloads as the new person:
     * the wishlist is theirs alone, and every comment carries a `mine` flag computed against the
     * old token. Reactions, privacy and orders are group-level demo state and survive the hop.
     */
    case "switch-viewer":
      return action.userId === state.viewerId
        ? state
        : { ...state, viewerId: action.userId, wishlist: [], comments: {} };

    case "reset-demo": {
      const fresh = initialState();
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // nothing to clear
      }
      return fresh;
    }

    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  /** Demo control: become another member of the group. Re-points the API token and remounts. */
  setViewerId: (userId: UserId) => void;
  /** Catalogue saves only, so callers can keep looking ids up in `src/data`. */
  savedProductIds: string[];
  toggleReaction: (targetId: string, kind: ReactionKind) => void;
  reactionsFor: (targetId: string) => Reaction[];
  viewerReacted: (targetId: string, kind: ReactionKind) => boolean;
  setSharing: (purchaseId: string, sharing: SharingState) => void;
  toggleAmounts: () => void;
  toggleCategory: (category: string) => void;
  toggleVeto: (cardId: string) => void;
  isVetoed: (cardId: string) => boolean;
  toggleSaved: (productId: string) => void;
  isSaved: (productId: string) => boolean;
  /** Optimistic: the item appears immediately, pending, and never rolls back. */
  addWishlistLink: (url: string, priceCents?: number) => Promise<void>;
  removeWishlistItem: (id: string) => void;
  /** Pulls the server's list in, if there is a server. Never throws. */
  refreshWishlist: () => Promise<void>;
  /** Oldest first, replies included — the UI does the grouping. */
  commentsFor: (target: CommentTarget) => StoredComment[];
  commentCount: (target: CommentTarget) => number;
  commentsStatus: (target: CommentTarget) => CommentThreadState["status"];
  /** A 404 means "you cannot see this target": an empty thread, never an error. Never throws. */
  loadComments: (target: CommentTarget) => Promise<void>;
  /** Optimistic: the comment appears immediately and is never rolled back. Never throws. */
  postComment: (
    target: CommentTarget,
    body: string,
    parentId?: string | null,
  ) => Promise<void>;
  /** Author-only; the UI must not offer it on anyone else's comment. Never throws. */
  deleteComment: (target: CommentTarget, commentId: string) => Promise<void>;
  recordOrder: (outcome: PurchaseOutcome) => void;
  startGroupGift: (userId: UserId) => void;
  hasStartedGroupGift: (userId: UserId) => boolean;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * The demo survives a reload. A stray refresh mid-pitch would otherwise drop
 * the reactions, purchases and privacy choices made on stage.
 */
const STORAGE_KEY = "shop-wrapped-demo";

function loadState(): AppState {
  const base = initialState();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<AppState> & {
      savedProductIds?: string[];
    };
    // A session stored before the wishlist existed still has a bare id array.
    const migrated =
      saved.wishlist ??
      (saved.savedProductIds ?? []).map((id) => itemFromProduct(id));
    return {
      ...base,
      ...saved,
      // A session stored before the switcher existed, or by an older id scheme, has no usable one.
      viewerId: isUserId(saved.viewerId) ? saved.viewerId : base.viewerId,
      wishlist: migrated,
      comments: saved.comments ?? base.comments,
      privacy: { ...base.privacy, ...(saved.privacy ?? {}) },
    };
  } catch {
    return base;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate after mount so the server and first client render agree.
  useEffect(() => {
    const saved = loadState();
    dispatch({ type: "hydrate", state: saved });
    setHydrated(true);
  }, []);

  /**
   * The two things outside React that have to agree with `state.viewerId`: the bearer token every
   * request is signed with, and the module-level `viewer` that `displayName()` reads to decide who
   * gets called "You". Done during render, not in an effect, because children render before a
   * parent's effects run - in an effect the first frame after a switch would still say "Kristina".
   * Both writes are idempotent assignments to module state, so re-running them is free.
   */
  setActiveViewer(state.viewerId);
  setViewer(state.viewerId);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing or blocked storage: the demo still works in memory.
    }
  }, [state, hydrated]);

  const toggleReaction = useCallback(
    (targetId: string, kind: ReactionKind) =>
      dispatch({ type: "toggle-reaction", targetId, kind }),
    [],
  );

  const reactionsFor = useCallback(
    (targetId: string) => state.reactions.filter((r) => r.targetId === targetId),
    [state.reactions],
  );

  const viewerReacted = useCallback(
    (targetId: string, kind: ReactionKind) =>
      state.reactions.some(
        (r) => r.targetId === targetId && r.userId === state.viewerId && r.kind === kind,
      ),
    [state.reactions, state.viewerId],
  );

  /**
   * Paste-a-link. The row lands in the list before the request leaves, and it
   * stays there whatever the network does — a dead backend downgrades the row
   * to a hostname, it never deletes it.
   */
  const addWishlistLink = useCallback(async (url: string, priceCents?: number) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const draft = draftFromUrl(trimmed, priceCents);
    dispatch({ type: "wishlist-add", item: draft });
    try {
      const result = await wishlistApi.addLink(trimmed, priceCents);
      dispatch({
        type: "wishlist-resolve",
        id: draft.id,
        patch: patchFromResult(result, trimmed),
      });
    } catch {
      dispatch({
        type: "wishlist-resolve",
        id: draft.id,
        patch: {
          title: `Saved from ${hostnameOf(trimmed)}`,
          pending: false,
          note: "Saved on this device. We couldn’t reach the server.",
        },
      });
    }
  }, []);

  /**
   * The screen promises "remove an item and it stops counting as a signal immediately", so this
   * has to reach the server: a local-only removal came back on the next refresh. Optimistic, and
   * deliberately not rolled back — a row the user deleted must not reappear under their cursor.
   */
  const removeWishlistItem = useCallback((id: string) => {
    dispatch({ type: "wishlist-remove", id });
    // A local draft id matches no reaction, so the delete is a harmless 204 no-op — no guard needed.
    void wishlistApi.remove(id).catch((err) => {
      console.error("wishlist removal failed", err);
    });
  }, []);

  /**
   * The stage recovery button. Clearing local state alone left every hidden item hidden and
   * every removed wishlist row gone, because all of that now lives on the server — so this has
   * to reseed the backend too, then reload to drop the per-viewer finds and comment caches.
   */
  const resetDemo = useCallback(async () => {
    try {
      await resetDemoRequest();
    } catch (err) {
      // Worth seeing: in `postgres` mode the route is disabled, and the operator needs to know
      // the button did nothing rather than assume the seed is clean.
      console.error("demo reset failed", err);
    }
    dispatch({ type: "reset-demo" });
    window.location.reload();
  }, []);

  const refreshWishlist = useCallback(async () => {
    try {
      const remote = await wishlistApi.list();
      dispatch({ type: "wishlist-merge", items: remote.map(itemFromResult) });
    } catch {
      // Offline is the expected case on conference wifi. Keep what we have.
    }
  }, []);

  /**
   * A 404 from the list is the recipient of a gift thread being told nothing,
   * which is the point. It reads the same as an unreachable server here: keep
   * whatever is local, show an empty thread, never an error.
   */
  const loadComments = useCallback(async (target: CommentTarget) => {
    const key = commentKey(target);
    dispatch({ type: "comments-loading", key });
    try {
      const remote = await commentsApi.list(target);
      const viewerId = commentsApi.viewerId();
      dispatch({
        type: "comments-loaded",
        key,
        items: remote.map((c) => storedFrom(c, viewerId)),
      });
    } catch {
      dispatch({ type: "comments-loaded", key, items: [] });
    }
  }, []);

  const postComment = useCallback(
    async (target: CommentTarget, body: string, parentId: string | null = null) => {
      const text = body.trim();
      if (!text) return;
      const key = commentKey(target);
      const draft: StoredComment = {
        id: `c-local-${nextId()}`,
        parentId,
        authorId: state.viewerId,
        authorName: users[state.viewerId].name,
        body: text,
        createdAt: new Date().toISOString(),
        mine: true,
        pending: true,
        local: true,
      };
      dispatch({ type: "comment-add", key, comment: draft });
      try {
        const saved = await commentsApi.create(target, text, parentId);
        dispatch({
          type: "comment-patch",
          key,
          id: draft.id,
          patch: {
            id: saved.id,
            parentId: saved.parentId,
            authorId: saved.authorId,
            authorName: saved.authorName,
            body: saved.body,
            createdAt: saved.createdAt,
            pending: false,
            local: false,
            note: undefined,
          },
        });
      } catch {
        dispatch({
          type: "comment-patch",
          key,
          id: draft.id,
          patch: { pending: false, note: "Only on this device — we couldn’t reach the server." },
        });
      }
    },
    [state.viewerId],
  );

  const deleteComment = useCallback(async (target: CommentTarget, commentId: string) => {
    dispatch({ type: "comment-remove", key: commentKey(target), id: commentId });
    // A comment that never reached the server has no id there to delete.
    if (commentId.startsWith("c-local-")) return;
    try {
      await commentsApi.remove(commentId);
    } catch {
      // It is gone from this device either way; a dead server must not resurrect it.
    }
  }, []);

  const commentsFor = useCallback(
    (target: CommentTarget) => state.comments[commentKey(target)]?.items ?? [],
    [state.comments],
  );

  /**
   * Become somebody else. The token and `viewer` are re-pointed here as well as during render so
   * that anything fired in this same tick is already signed as the new person, the reducer drops
   * the data that belonged to the old one, and the `key` below throws the whole tree away so every
   * `useEffect(..., [])` that fetched something fetches it again.
   */
  const setViewerId = useCallback((userId: UserId) => {
    setActiveViewer(userId);
    setViewer(userId);
    dispatch({ type: "switch-viewer", userId });
  }, []);

  const savedProductIds = useMemo(
    () =>
      state.wishlist
        .filter((w) => w.productId && productsById[w.productId])
        .map((w) => w.productId as string),
    [state.wishlist],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      savedProductIds,
      setViewerId,
      toggleReaction,
      reactionsFor,
      viewerReacted,
      setSharing: (purchaseId, sharing) =>
        dispatch({ type: "set-sharing", purchaseId, sharing }),
      toggleAmounts: () => dispatch({ type: "toggle-amounts" }),
      toggleCategory: (category) => dispatch({ type: "toggle-category", category }),
      toggleVeto: (cardId) => dispatch({ type: "toggle-veto", cardId }),
      isVetoed: (cardId) => state.privacy.vetoedCards.includes(cardId),
      toggleSaved: (productId) => dispatch({ type: "toggle-saved", productId }),
      isSaved: (productId) => state.wishlist.some((w) => w.productId === productId),
      addWishlistLink,
      removeWishlistItem,
      refreshWishlist,
      commentsFor,
      commentCount: (target) => (state.comments[commentKey(target)]?.items ?? []).length,
      commentsStatus: (target) => state.comments[commentKey(target)]?.status ?? "idle",
      loadComments,
      postComment,
      deleteComment,
      recordOrder: (outcome) => dispatch({ type: "record-order", outcome }),
      startGroupGift: (userId) => dispatch({ type: "start-group-gift", userId }),
      hasStartedGroupGift: (userId) => state.groupGiftStarted.includes(userId),
      resetDemo,
    }),
    [
      state,
      savedProductIds,
      setViewerId,
      toggleReaction,
      reactionsFor,
      viewerReacted,
      addWishlistLink,
      refreshWishlist,
      commentsFor,
      loadComments,
      postComment,
      deleteComment,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {/*
        Keyed on the viewer: switching person unmounts and remounts the whole app, which is the
        only way to guarantee that every mount-time fetch re-runs as the new token and that the
        components which read `viewer`/`displayName()` straight off the module (rather than through
        this context) redraw. It is exactly what signing out and back in would do.
      */}
      <Fragment key={state.viewerId}>{children}</Fragment>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
