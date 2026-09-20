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
import type {
  PrivacySettings,
  Reaction,
  ReactionKind,
  SharingState,
  UserId,
} from "@/lib/types";
import type { PurchaseOutcome } from "@/services/checkout";

/**
 * All demo state in one place: reactions, per-item privacy, saved gifts, and
 * the purchases made from inside the Wrapped. Everything a backend would own
 * is mutated only through these actions.
 */
interface AppState {
  reactions: Reaction[];
  privacy: PrivacySettings;
  savedProductIds: string[];
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
  | { type: "record-order"; outcome: PurchaseOutcome }
  | { type: "start-group-gift"; userId: UserId }
  | { type: "hydrate"; state: AppState }
  | { type: "reset-demo" };

const VIEWER: UserId = "kristina";

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
    savedProductIds: [],
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
      const has = state.savedProductIds.includes(action.productId);
      return {
        ...state,
        savedProductIds: has
          ? state.savedProductIds.filter((p) => p !== action.productId)
          : [...state.savedProductIds, action.productId],
      };
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
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...base,
      ...saved,
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

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
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
      isSaved: (productId) => state.savedProductIds.includes(productId),
      recordOrder: (outcome) => dispatch({ type: "record-order", outcome }),
      startGroupGift: (userId) => dispatch({ type: "start-group-gift", userId }),
      hasStartedGroupGift: (userId) => state.groupGiftStarted.includes(userId),
      resetDemo: () => dispatch({ type: "reset-demo" }),
    }),
    [state, toggleReaction, reactionsFor, viewerReacted],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
