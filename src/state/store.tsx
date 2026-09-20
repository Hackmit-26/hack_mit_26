"use client";

import {
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
import { addWishlistLink, listWishlist } from "@/lib/api";
import type {
  ArtKind,
  PrivacySettings,
  Reaction,
  ReactionKind,
  SharingState,
  UserId,
} from "@/lib/types";
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
  list: listWishlist,
};

let wishlistApi: WishlistApi = backendWishlistApi;

/** THE API SEAM. Nothing else in the app talks to the wishlist endpoint. Tests inject here. */
export function setWishlistApi(api: WishlistApi): void {
  wishlistApi = api;
}

/**
 * All demo state in one place: reactions, per-item privacy, the wishlist, and
 * the purchases made from inside the Wrapped. Everything a backend would own
 * is mutated only through these actions.
 */
interface AppState {
  reactions: Reaction[];
  privacy: PrivacySettings;
  wishlist: WishlistItem[];
  orders: PurchaseOutcome[];
  /** Group-gift invites the viewer has sent, keyed by recipient. */
  groupGiftStarted: UserId[];
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
  | { type: "record-order"; outcome: PurchaseOutcome }
  | { type: "start-group-gift"; userId: UserId }
  | { type: "hydrate"; state: AppState }
  | { type: "reset-demo" };

const VIEWER: UserId = "kristina";

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
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "toggle-reaction": {
      const existing = state.reactions.find(
        (r) =>
          r.targetId === action.targetId &&
          r.userId === VIEWER &&
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
            id: `r-local-${action.targetId}-${action.kind}`,
            targetId: action.targetId,
            userId: VIEWER,
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

    case "record-order":
      return { ...state, orders: [...state.orders, action.outcome] };

    case "start-group-gift":
      return state.groupGiftStarted.includes(action.userId)
        ? state
        : { ...state, groupGiftStarted: [...state.groupGiftStarted, action.userId] };

    case "hydrate":
      return action.state;

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
  viewerId: UserId;
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
  recordOrder: (outcome: PurchaseOutcome) => void;
  startGroupGift: (userId: UserId) => void;
  hasStartedGroupGift: (userId: UserId) => boolean;
  resetDemo: () => void;
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
      wishlist: migrated,
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
        (r) => r.targetId === targetId && r.userId === VIEWER && r.kind === kind,
      ),
    [state.reactions],
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

  const refreshWishlist = useCallback(async () => {
    try {
      const remote = await wishlistApi.list();
      dispatch({ type: "wishlist-merge", items: remote.map(itemFromResult) });
    } catch {
      // Offline is the expected case on conference wifi. Keep what we have.
    }
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
      viewerId: VIEWER,
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
      removeWishlistItem: (id) => dispatch({ type: "wishlist-remove", id }),
      refreshWishlist,
      recordOrder: (outcome) => dispatch({ type: "record-order", outcome }),
      startGroupGift: (userId) => dispatch({ type: "start-group-gift", userId }),
      hasStartedGroupGift: (userId) => state.groupGiftStarted.includes(userId),
      resetDemo: () => dispatch({ type: "reset-demo" }),
    }),
    [
      state,
      savedProductIds,
      toggleReaction,
      reactionsFor,
      viewerReacted,
      addWishlistLink,
      refreshWishlist,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
