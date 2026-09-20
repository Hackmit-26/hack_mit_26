import type {
  ArtKind,
  LoreCase,
  Spotlight,
  TasteMatch,
  UserId,
  WrappedCard,
} from "@/lib/types";

/** The story, in order. The generator would emit exactly this shape. */
export const wrappedCards: WrappedCard[] = [
  { id: "card-taste", chapter: "taste", index: 0 },
  { id: "card-spotlights", chapter: "spotlights", index: 1 },
  { id: "card-lore", chapter: "lore", index: 2 },
  { id: "card-gift", chapter: "gift", index: 3 },
  { id: "card-closing", chapter: "closing", index: 4 },
];

// ---------------------------------------------------------------------------
// Chapter 1 · Taste match
// ---------------------------------------------------------------------------

export const tasteMatch: TasteMatch = {
  pair: ["kristina", "esh"],
  tasteScore: 86,
  budgetScore: 73,
  chaosScore: 77,
  sharedTags: ["silver jewelry", "neutral basics", "skincare", "little drinks under $10"],
  lead: "You both gravitate toward silver jewelry, neutral basics, skincare, and little drinks under $10.",
  disagreement: [
    {
      userId: "esh",
      text: "Esh loves trying new stores. 12 stores in 14 purchases.",
    },
    {
      userId: "kristina",
      text: "Kristina is in a committed relationship with Sephora. 5 visits.",
    },
  ],
  footnote: "Compared 33 purchases, 7 shared style tags, 6 pairs.",
  otherPairs: [
    { pair: ["esh", "sabina"], score: 83 },
    { pair: ["kristina", "sabina"], score: 73 },
  ],
};

/** The little scribbles floating in each lens of the Venn diagram. */
export const tasteVennNotes = {
  left: { items: ["film", "tube"] as ArtKind[], note: "Sephora era" },
  right: { items: ["ring", "bag"] as ArtKind[], note: "12 stores deep" },
  middle: { top: "earrings" as ArtKind, bottom: "matcha" as ArtKind },
};

export const tasteStats = [
  { kicker: "Taste match", value: "86%", note: "same shelves", bg: "#F5ECD9" },
  { kicker: "Budget match", value: "73%", note: "same wallet energy", bg: "#A8DCC2" },
  { kicker: "Shopping chaos", value: "77%", note: "both peak after 8 PM", bg: "#F5E39B" },
];

// ---------------------------------------------------------------------------
// Chapter 2 · Spotlights — one system, four varied layouts
// ---------------------------------------------------------------------------

export const spotlights: Record<UserId, Spotlight> = {
  kristina: {
    userId: "kristina",
    title: "The Midnight",
    titleAccent: "Researcher",
    lead: "Buys like they've done twelve tabs of research, but somehow most of it happens after dark.",
    bg: "#E8806F",
    stats: [
      {
        kicker: "Night owl",
        headline: "68%",
        body: "of Kristina's purchases happened after 7 PM.",
        bg: "#141A47",
      },
      {
        kicker: "Emotional support store",
        headline: "Sephora",
        body: "5 visits. Basically a standing appointment.",
        art: "tube",
        bg: "#EBB5BD",
      },
      {
        kicker: "Plot twist",
        headline: "A camera sling bag",
        body: "Their biggest purchase wasn't fashion. Lensmith, 11:12 PM, obviously.",
        art: "camera",
        bg: "#BBA9E8",
      },
    ],
    evidence: "evidence: 13 of 19 buys after 7 · Sephora x5 · Sept 13",
  },
  esh: {
    userId: "esh",
    title: "The Store",
    titleAccent: "Collector",
    lead: "Zero loyalty, maximum curiosity. They don't shop, they do field research.",
    bg: "#BBA9E8",
    stats: [
      {
        kicker: "Most new stores",
        headline: "12",
        body: "different stores. Only two got a second visit.",
        art: "cafe",
        bg: "#EBB5BD",
      },
      {
        kicker: "Silver specialist",
        headline: "3 pieces",
        body: "A signet ring, a cuff, drop earrings. Three shops.",
        art: "ring",
        bg: "#A8DCC2",
      },
      {
        kicker: "After hours",
        headline: "5 carts",
        body: "checked out between 10 PM and 2 AM.",
        art: "lamp",
        bg: "#141A47",
      },
    ],
    evidence: "evidence: 12 stores / 14 buys · latest checkout 1:30 AM, Sept 18",
  },
  sabina: {
    userId: "sabina",
    title: "The Weekend",
    titleAccent: "Warrior",
    lead: "Weekdays are a rumor. By Saturday Sabina has a plan, a tote bag, and six stores to visit.",
    bg: "#A8DCC2",
    stats: [
      {
        kicker: "Weekend warrior",
        headline: "71%",
        body: "of their buys land on a Saturday or Sunday.",
        bg: "#F5E39B",
      },
      {
        kicker: "Most chaotic day",
        headline: "6 stores",
        body: "Matcha at 10 AM. A brooch by 6:45 PM.",
        art: "tote",
        bg: "#EBB5BD",
      },
      {
        kicker: "Biggest splurge",
        headline: "Labor Day Sambas",
        body: "The one big purchase. Everything else: thrift.",
        art: "sneaker",
        bg: "#BBA9E8",
      },
    ],
    evidence: "evidence: 12 of 17 buys on weekends · Sept 12 = 6 stores · Sambas Sept 7",
  },
  madhav: {
    userId: "madhav",
    title: "The",
    titleAccent: "Regular",
    lead: "Same café, same 8:10 AM, same oat latte. Madhav doesn't have a routine. The routine has Madhav.",
    bg: "#F5E39B",
    stats: [
      {
        kicker: "Coffee shop regular",
        headline: "9 visits",
        body: "Tue to Thu, 8:05 to 8:13 AM. Never a Monday.",
        art: "mug",
        bg: "#BBA9E8",
      },
      {
        kicker: "Small purchase specialist",
        headline: "11 of 17",
        body: "buys under $12. Small treats, big consistency.",
        art: "notebook",
        bg: "#A8DCC2",
      },
      {
        kicker: "Plot twist",
        headline: "Iced matcha?!",
        body: "Mori Tea House, Sept 14, 3:30 PM. Wildly off script.",
        art: "matcha",
        bg: "#EBB5BD",
      },
    ],
    evidence: "evidence: Grain & Co. x9 · 11 of 17 under $12 · Sept 14, 3:30 PM",
  },
};

export const spotlightOrder: UserId[] = ["kristina", "esh", "sabina", "madhav"];

/** Esh's layout: the store names that rain down either side of their portrait. */
export const eshStoreChips = {
  left: [
    "Ichi Matcha",
    "Marlowe Vintage",
    "Tin & Tulip",
    "Threadbare Vintage",
    "Adidas",
    "Leaf Society",
  ],
  right: [
    "Dewdrop Seoul",
    "Olive & Aloe",
    "Field Notes Market",
    "Kudo Bakery",
    "Silver & Sons",
    "Nook Café",
  ],
};

/** Sabina's layout: purchases by day of week, and the Sept 12 receipt. */
export const sabinaWeek = {
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  counts: [2, 1, 1, 1, 0, 8, 4],
};

export const sabinaReceipt = {
  header: "Sat · Sept 12",
  subtitle: "6 stores. 8 hours. one tote.",
  rows: [
    { time: "10:00 AM", store: "Kettle & Whisk", item: "Iced matcha" },
    { time: "11:20 AM", store: "Tide & Thread", item: "Beaded bracelet" },
    { time: "1:05 PM", store: "Salt Flat Boutique", item: "Cargo shorts" },
    { time: "2:30 PM", store: "Sephora", item: "Lip tint" },
    { time: "4:10 PM", store: "Kudo Bakery", item: "Iced hojicha" },
    { time: "6:45 PM", store: "Pearl & Pine Antiques", item: "Vintage brooch" },
  ],
  total: "(private, obviously)",
};

/** Madhav's layout: the Grain & Co. loyalty card. */
export const madhavStamps = {
  merchant: "Grain & Co. Café",
  dates: [
    "Sept 1",
    "Sept 2",
    "Sept 3",
    "Sept 8",
    "Sept 9",
    "Sept 10",
    "Sept 15",
    "Sept 16",
    "Sept 17",
  ],
  footer: "9 stamps. One more and the cortado's free.",
};

// ---------------------------------------------------------------------------
// Chapter 3 · Group lore
// ---------------------------------------------------------------------------

export const loreCases: LoreCase[] = [
  {
    id: "matcha",
    index: "01",
    tab: "Matcha Incident",
    title: "The Matcha",
    titleAccent: "Incident",
    subtitle: "Four friends. Seven cafés. One completely unnecessary obsession.",
    verdictLabel: "Status",
    verdict: "Ongoing",
    evidence: "evidence: 7 matcha purchases · 7 different cafés · 4 of 4 friends",
  },
  {
    id: "skin",
    index: "02",
    tab: "Skincare Sync",
    title: "Skincare",
    titleAccent: "Synchronization",
    subtitle: "3 of 4 friends. Same 72-hour window. Allegedly.",
    verdictLabel: "Verdict",
    verdict: "In sync",
    evidence: "evidence: 3 skincare buys in 64 hours · 3 different shops",
  },
  {
    id: "chain",
    index: "03",
    tab: "Chain Reaction",
    title: "Sabina Caused a",
    titleAccent: "Chain Reaction",
    subtitle: "One pair of Sambas. Three friends. Eleven days.",
    verdictLabel: "Sabina influence score",
    verdict: "Dangerous.",
    evidence: "evidence: Samba x2 · Gazelle x1 · crew socks x1 · 11 days apart",
  },
];

/** Case 01: the matcha timeline, alternating sides down a dashed spine. */
export const matchaTimeline: {
  userId: UserId;
  store: string;
  item: string;
  time: string;
  date: string;
  note: string;
}[] = [
  { userId: "esh", store: "Ichi Matcha", item: "Iced matcha", time: "3:20 PM", date: "Sept 3", note: "the first sip" },
  { userId: "sabina", store: "Nook Matcha", item: "Iced matcha", time: "11:15 AM", date: "Sept 5", note: "joins in" },
  { userId: "kristina", store: "Verde Café", item: "Iced matcha", time: "2:10 PM", date: "Sept 8", note: "a “one-off”" },
  { userId: "esh", store: "Leaf Society", item: "Iced matcha", time: "4:30 PM", date: "Sept 10", note: "second helping" },
  { userId: "sabina", store: "Kettle & Whisk", item: "Iced matcha", time: "10:00 AM", date: "Sept 12", note: "hojicha by 4 PM" },
  { userId: "madhav", store: "Mori Tea House", item: "Iced matcha", time: "3:30 PM", date: "Sept 14", note: "the plot twist" },
  { userId: "kristina", store: "Sunday Matcha Bar", item: "Iced matcha", time: "12:15 PM", date: "Sept 16", note: "a “one-off” again" },
];

/** Case 02: three purchases inside one 72-hour window. */
export const skincareSync: {
  userId: UserId;
  item: string;
  merchant: string;
  when: string;
  art: ArtKind;
  bg: string;
}[] = [
  { userId: "esh", item: "Snail mucin essence", merchant: "Dewdrop Seoul", when: "Fri, 11:52 PM", art: "serum", bg: "#BBA9E8" },
  { userId: "kristina", item: "Hydrating toner", merchant: "Sephora", when: "Sat, 9:20 PM", art: "tube", bg: "#EBB5BD" },
  { userId: "sabina", item: "Centella cream", merchant: "Olive & Aloe", when: "Mon, 4:10 PM", art: "tin", bg: "#A8DCC2" },
];

export const skincareAbstainer = {
  userId: "madhav" as UserId,
  text: "Madhav abstained. Alibi on file: one tiny succulent, Sept 12.",
  aside: "+ Esh doubled down: sheet mask, Sat 6:15 PM",
};

/** Case 03: the Samba chain, patient zero to crew socks. */
export const chainReaction: {
  userId: UserId;
  kicker: string;
  title: string;
  when: string;
  art: ArtKind | "socks";
  bg: string;
  gap: string;
}[] = [
  { userId: "sabina", kicker: "Patient zero", title: "Adidas Samba", when: "Sabina · Mon, Sept 7 · Labor Day", art: "sneaker", bg: "#EBB5BD", gap: "+3 days" },
  { userId: "esh", kicker: "Same shoe", title: "Adidas Samba", when: "Esh · Thu, Sept 10", art: "sneaker", bg: "#BBA9E8", gap: "+7 days" },
  { userId: "kristina", kicker: "Cousin model", title: "Adidas Gazelle", when: "Kristina · Thu, Sept 17", art: "sneaker2", bg: "#A8DCC2", gap: "+1 day" },
  { userId: "madhav", kicker: "Committed. Barely.", title: "Adidas crew socks", when: "Madhav · Fri, Sept 18", art: "socks", bg: "#F5E39B", gap: "" },
];

export const chainFootnote = "4 of 4 friends bought Adidas this month.";

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

export const closingTiles = [
  { n: "1 · Taste match", title: "Taste twins", bg: "#EBB5BD", fg: "#141A47", label: "Kristina + Esh, 86%" },
  { n: "2 · Spotlights", title: "Four covers", bg: "#E8806F", fg: "#141A47", label: "The Midnight Researcher and friends" },
  { n: "3 · Group lore", title: "The Matcha Incident", bg: "#141A47", fg: "#F5ECD9", label: "The Matcha Incident" },
  { n: "4 · Gift mode", title: "Gift mode", bg: "#F5E39B", fg: "#141A47", label: "Gift mode for Esh" },
];
