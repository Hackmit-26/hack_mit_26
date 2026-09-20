import type { Reaction, ReactionKind } from "@/lib/types";

/**
 * Reaction vocabulary from the design system: custom glyphs, no stock emoji.
 * Selected chips invert to navy.
 */
export const reactionKinds: { kind: ReactionKind; label: string }[] = [
  { kind: "accurate", label: "accurate" },
  { kind: "called-out", label: "called out" },
  { kind: "need-this", label: "need this" },
  { kind: "send-link", label: "send link" },
];

/** What the group had already reacted to when the Wrapped was generated. */
export const seededReactions: Reaction[] = [
  { id: "r-1", targetId: "card-taste", userId: "esh", kind: "accurate" },
  { id: "r-2", targetId: "card-taste", userId: "sabina", kind: "accurate" },
  { id: "r-3", targetId: "card-taste", userId: "madhav", kind: "called-out" },

  { id: "r-4", targetId: "spot-kristina", userId: "esh", kind: "called-out" },
  { id: "r-5", targetId: "spot-kristina", userId: "sabina", kind: "accurate" },
  { id: "r-6", targetId: "spot-esh", userId: "kristina", kind: "accurate" },
  { id: "r-7", targetId: "spot-esh", userId: "sabina", kind: "accurate" },
  { id: "r-8", targetId: "spot-sabina", userId: "esh", kind: "need-this" },
  { id: "r-9", targetId: "spot-madhav", userId: "kristina", kind: "called-out" },

  { id: "r-10", targetId: "lore-matcha", userId: "kristina", kind: "called-out" },
  { id: "r-11", targetId: "lore-matcha", userId: "esh", kind: "accurate" },
  { id: "r-12", targetId: "lore-matcha", userId: "sabina", kind: "accurate" },
  { id: "r-13", targetId: "lore-skin", userId: "madhav", kind: "called-out" },
  { id: "r-14", targetId: "lore-chain", userId: "sabina", kind: "accurate" },
  { id: "r-15", targetId: "lore-chain", userId: "madhav", kind: "accurate" },

  { id: "r-16", targetId: "p-esh-7", userId: "kristina", kind: "need-this" },
  { id: "r-17", targetId: "p-sabina-1", userId: "esh", kind: "send-link" },
  { id: "r-18", targetId: "p-sabina-3", userId: "esh", kind: "accurate" },
];
