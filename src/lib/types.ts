/**
 * Domain types for Unwrap.
 *
 * Everything the UI renders comes through these shapes. The `src/data`
 * modules are the only place mock values live, so swapping in real API or
 * database responses means replacing those modules, not touching components.
 */

export type UserId = "kristina" | "esh" | "sabina" | "madhav";

/** The flat illustrations in the `Art` component. */
export type ArtKind =
  | "bag"
  | "matcha"
  | "earrings"
  | "notebook"
  | "charm"
  | "boots"
  | "lamp"
  | "cafe"
  | "camera"
  | "cabin"
  | "tin"
  | "cardcase"
  | "claw"
  | "whisk"
  | "tote"
  | "planner"
  | "knit"
  | "serum"
  | "ring"
  | "sneaker"
  | "sneaker2"
  | "tube"
  | "film"
  | "mug"
  | "necklace"
  | "filmroll"
  | "frame"
  | "book"
  | "denim"
  | "perfume"
  | "synth"
  | "eurorack"
  | "cable"
  | "pedal"
  | "keyboard"
  | "solder"
  | "headphones"
  | "turntable"
  | "arcade"
  | "watch"
  | "socks"
  | "flask"
  | "sunglasses"
  | "tent"
  | "yogamat"
  | "headlamp"
  | "skillet"
  | "pot"
  | "knife"
  | "bottle"
  | "plant"
  | "bread"
  | "mokapot"
  | "jeans"
  | "tee"
  | "groovebox"
  | "keycap"
  | "switch"
  | "roller"
  | "massager"
  | "sandal"
  | "poles"
  | "plate"
  | "grinder"
  | "instant"
  | "wok";

export interface User {
  id: UserId;
  name: string;
  /** Shown in the group roster / gift picker. */
  persona: string;
  /** The friend's own colour, used for avatar and their tile on every card. */
  color: string;
  isViewer: boolean;
}

export interface Group {
  id: string;
  name: string;
  period: string;
  memberIds: UserId[];
  inviteCode: string;
}

export interface Purchase {
  id: string;
  userId: UserId;
  item: string;
  merchant: string;
  /** Kept in cents so no float arithmetic reaches the UI. */
  amountCents: number;
  category: string;
  art: ArtKind;
  /** Real product photo in `public/products`; falls back to `art` when absent. */
  image?: string;
  /**
   * The page this item lives on. Absent for anything bought in person — a
   * café matcha has no product page — and `ItemLink` renders those as plain
   * text rather than a dead link.
   */
  url?: string;
  /** ISO date, so real receipts can drop straight in. */
  date: string;
  time: string;
  /** Per-item privacy — nothing is shared by default. */
  sharing: SharingState;
}

export type SharingState = "shared" | "anonymous" | "hidden";

export interface Reaction {
  id: string;
  /** A wrapped card id, or a purchase id. */
  targetId: string;
  userId: UserId;
  kind: ReactionKind;
}

export type ReactionKind = "accurate" | "called-out" | "need-this" | "send-link";

export interface Product {
  id: string;
  title: string;
  merchant: string;
  priceCents: number;
  art: ArtKind;
  /** Real product photo in `public/products`; falls back to `art` when absent. */
  image?: string;
  /**
   * The product page to open. Optional: the real catalogue has a
   * `product_url` on only a fraction of its rows, so the UI must survive
   * without one.
   */
  url?: string;
  /** Tile background behind the illustration. */
  bg: string;
  /** True when the merchant is new to the recipient. */
  isNew: boolean;
  isVisaMerchant: boolean;
}

export interface Recommendation {
  id: string;
  productId: string;
  /** Who the gift is for. */
  forUserId: UserId;
  budget: BudgetKey;
  /** "What {name} does" — the behavioural signal. */
  behavior: string;
  /** "What the group knows" — the social signal. */
  signal: string;
}

export type BudgetKey = "u25" | "u50" | "u100" | "group";

export interface GroupGift {
  forUserId: UserId;
  productId: string;
  banner: string;
  bannerBg: string;
  why: string;
  splitWays: number;
}

export interface GiftProfile {
  userId: UserId;
  /** How many purchases the AI read. */
  purchaseCount: number;
  tags: string[];
}

export type ChapterId = "taste" | "spotlights" | "lore" | "gift" | "debate" | "closing";

export interface Chapter {
  id: ChapterId;
  /** Top-bar label in the desktop shell. */
  name: string;
  /** Small-caps kicker printed on the card itself. */
  kicker: string;
  /** The question this chapter answers, from the design system artboard. */
  question: string;
  bg: string;
  fg: string;
}

export interface TasteMatch {
  pair: [UserId, UserId];
  tasteScore: number;
  budgetScore: number;
  chaosScore: number;
  sharedTags: string[];
  lead: string;
  disagreement: { userId: UserId; text: string }[];
  footnote: string;
  otherPairs: { pair: [UserId, UserId]; score: number }[];
}

export interface SpotlightStat {
  kicker: string;
  headline: string;
  body: string;
  art?: ArtKind;
  /** Background of the stat's medallion. */
  bg: string;
}

export interface Spotlight {
  userId: UserId;
  title: string;
  /** The word set in italic inside the title. */
  titleAccent: string;
  lead: string;
  stats: SpotlightStat[];
  evidence: string;
  bg: string;
}

export interface LoreCase {
  id: string;
  index: string;
  tab: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  verdictLabel: string;
  verdict: string;
  evidence: string;
}

export interface WrappedCard {
  id: string;
  chapter: ChapterId;
  /** Order in the story. */
  index: number;
}

export interface PrivacySettings {
  /** Amounts are hidden unless the buyer turns them on. */
  showAmounts: boolean;
  /** Categories never ingested. */
  excludedCategories: string[];
  /** Per-purchase overrides, keyed by purchase id. */
  sharing: Record<string, SharingState>;
  /** Cards the member has vetoed before publishing. */
  vetoedCards: string[];
}
