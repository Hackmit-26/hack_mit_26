import type { GiftProfile, GroupGift, Product, Recommendation, UserId } from "@/lib/types";
import { users } from "./users";

/**
 * The sourced catalogue.
 *
 * In production this is whatever the product-search service returns for a
 * friend's item. Here it is pre-cached so every buy button works offline,
 * exactly as the hackathon data strategy calls for.
 */
export const products: Product[] = [
  // ---- for Esh -------------------------------------------------------
  {
    id: "prod-esh-rings",
    title: "Silver stacking rings, set of 3",
    merchant: "Tin & Tulip",
    priceCents: 2400,
    art: "ring",
    image: "/products/prod-esh-rings.jpg",
    url: "https://www.etsy.com/c/jewelry/rings",
    bg: "#BBA9E8",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-esh-mask",
    title: "Rice-bran sheet mask, 5-pack",
    merchant: "Olive & Aloe",
    priceCents: 1800,
    art: "tube",
    image: "/products/prod-esh-mask.jpg",
    url: "https://sokoglam.com/collections/sheet-face-mask",
    bg: "#A8DCC2",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-esh-clip",
    title: "Vintage silver scarf clip",
    merchant: "Pearl & Pine Antiques",
    priceCents: 3400,
    art: "necklace",
    image: "/products/prod-esh-clip.jpg",
    url: "https://www.1stdibs.com/jewelry/",
    bg: "#EBB5BD",
    isNew: true,
    isVisaMerchant: true,
  },
  {
    id: "prod-esh-balm",
    title: "Ceramide night balm, mini",
    merchant: "Dewdrop Seoul",
    priceCents: 3600,
    art: "serum",
    image: "/products/prod-esh-balm.jpg",
    url: "https://sokoglam.com/collections/moisturizers",
    bg: "#BBA9E8",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-esh-bag",
    title: "Vintage leather shoulder bag",
    merchant: "Marlowe Vintage",
    priceCents: 7800,
    art: "bag",
    image: "/products/prod-esh-bag.jpg",
    url: "https://www.1stdibs.com/fashion/handbags-purses-bags/",
    bg: "#F5E39B",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-esh-scarf",
    title: "Oat cashmere-blend scarf",
    merchant: "Threadbare Vintage",
    priceCents: 6400,
    art: "knit",
    image: "/products/prod-esh-scarf.jpg",
    url: "https://www.nordstrom.com/browse/women/accessories/scarves-wraps",
    bg: "#EBB5BD",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-esh-vanity",
    title: "Vintage silver vanity set",
    merchant: "Silver & Sons Antiques",
    priceCents: 15000,
    art: "bag",
    image: "/products/prod-esh-vanity.jpg",
    url: "https://www.1stdibs.com/furniture/dining-entertaining/sterling-silver/",
    bg: "#BBA9E8",
    isNew: false,
    isVisaMerchant: true,
  },

  // ---- for Sabina -----------------------------------------------------
  {
    id: "prod-sabina-bracelet",
    title: "Beaded bracelet stack, 3 pieces",
    merchant: "Tide & Thread",
    priceCents: 2200,
    art: "charm",
    image: "/products/prod-sabina-bracelet.jpg",
    url: "https://www.etsy.com/c/jewelry/bracelets",
    bg: "#EBB5BD",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-sabina-whisk",
    title: "Matcha whisk & bowl set",
    merchant: "Kettle & Whisk",
    priceCents: 2400,
    art: "whisk",
    image: "/products/prod-sabina-whisk.jpg",
    url: "https://ippodotea.com/collections/utensils",
    bg: "#A8DCC2",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-sabina-tee",
    title: "Boxy vintage band tee",
    merchant: "Rewind Vintage",
    priceCents: 2800,
    art: "knit",
    image: "/products/prod-sabina-tee.jpg",
    url: "https://www.nordstrom.com/browse/women/clothing/t-shirts",
    bg: "#A8DCC2",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-sabina-tote",
    title: "Weekender tote, washed canvas",
    merchant: "Field Notes Market",
    priceCents: 4400,
    art: "tote",
    image: "/products/prod-sabina-tote.jpg",
    url: "https://www.baggu.com/collections/totes",
    bg: "#F5E39B",
    isNew: true,
    isVisaMerchant: true,
  },
  {
    id: "prod-sabina-campus",
    title: "Adidas Campus 00s",
    merchant: "Adidas",
    priceCents: 9500,
    art: "sneaker2",
    image: "/products/prod-sabina-campus.jpg",
    url: "https://www.adidas.com/us/campus",
    bg: "#BBA9E8",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-sabina-boots",
    title: "Lug-sole ankle boots",
    merchant: "Ridgeline Boots",
    priceCents: 7800,
    art: "boots",
    image: "/products/prod-sabina-boots.jpg",
    url: "https://www.nordstrom.com/browse/women/shoes/boots-booties",
    bg: "#EBB5BD",
    isNew: true,
    isVisaMerchant: true,
  },
  {
    id: "prod-sabina-camera",
    title: "Instant camera & film bundle",
    merchant: "Lensmith",
    priceCents: 12000,
    art: "camera",
    image: "/products/prod-sabina-camera.jpg",
    url: "https://www.instax.com/mini_12/en/",
    bg: "#EBB5BD",
    isNew: false,
    isVisaMerchant: true,
  },

  // ---- for Madhav -----------------------------------------------------
  {
    id: "prod-madhav-hojicha",
    title: "Hojicha starter tin",
    merchant: "Mori Tea House",
    priceCents: 1800,
    art: "tin",
    image: "/products/prod-madhav-hojicha.jpg",
    url: "https://ippodotea.com/collections/green-tea",
    bg: "#F5E39B",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-madhav-notebook",
    title: "Pocket notebook, refill pack",
    merchant: "Sundry Paper Co.",
    priceCents: 1200,
    art: "notebook",
    image: "/products/prod-madhav-notebook.jpg",
    url: "https://www.muji.us/collections/notebook",
    bg: "#BBA9E8",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-madhav-cup",
    title: "Hand-thrown espresso cup",
    merchant: "Clay & Cloud",
    priceCents: 3000,
    art: "mug",
    image: "/products/prod-madhav-cup.jpg",
    url: "https://www.etsy.com/c/home-and-living/kitchen-and-dining",
    bg: "#EBB5BD",
    isNew: true,
    isVisaMerchant: true,
  },
  {
    id: "prod-madhav-cables",
    title: "Braided cable organizer kit",
    merchant: "Volta Supply",
    priceCents: 2800,
    art: "cardcase",
    image: "/products/prod-madhav-cables.jpg",
    url: "https://www.anker.com/collections/cables",
    bg: "#A8DCC2",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-madhav-kettle",
    title: "Gooseneck pour-over kettle",
    merchant: "Grain & Co. Café",
    priceCents: 6400,
    art: "cafe",
    image: "/products/prod-madhav-kettle.jpg",
    url: "https://fellowproducts.com/products/stagg-ekg-electric-pour-over-kettle",
    bg: "#F5E39B",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-madhav-wrist",
    title: "Walnut keyboard wrist rest",
    merchant: "Volta Supply",
    priceCents: 5800,
    art: "planner",
    image: "/products/prod-madhav-wrist.jpg",
    url: "https://www.keychron.com/collections/palm-rests",
    bg: "#BBA9E8",
    isNew: false,
    isVisaMerchant: true,
  },
  {
    id: "prod-madhav-grinder",
    title: "Hand-crank coffee grinder",
    merchant: "Grain & Co. Café",
    priceCents: 9000,
    art: "cafe",
    image: "/products/prod-madhav-grinder.jpg",
    url: "https://fellowproducts.com/collections/grinder",
    bg: "#F5E39B",
    isNew: false,
    isVisaMerchant: true,
  },
];

export const productsById: Record<string, Product> = Object.fromEntries(
  products.map((p) => [p.id, p]),
);

export function getProduct(id: string): Product {
  const found = productsById[id];
  if (!found) throw new Error(`Unknown product: ${id}`);
  return found;
}

// ---- Birthdays -------------------------------------------------------
/**
 * The four birthdays, same dates the backend seeds into `users.birthday`.
 * They live here because the gift chapter is the only thing that reads them;
 * move them onto `User` once the profile screen needs them too.
 */
export const birthdays: Record<UserId, string> = {
  kristina: "1999-03-07",
  esh: "1997-11-15",
  sabina: "1998-10-02",
  madhav: "1999-06-27",
};

/** The backend's nudge window — past this, a gift is a just-because gift. */
const BIRTHDAY_HORIZON_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Days until the next time this MM-DD comes round, counted in UTC and rolling
 * into next year once the day has passed. Same arithmetic as the backend's
 * `nextOccurrence`, so a card and the API never disagree by a day.
 */
export function daysUntilBirthday(userId: UserId, today = new Date()): number {
  const [, month, day] = birthdays[userId].split("-").map(Number);
  const startOfToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  let next = Date.UTC(today.getUTCFullYear(), month - 1, day);
  if (next < startOfToday) {
    next = Date.UTC(today.getUTCFullYear() + 1, month - 1, day);
  }
  return Math.round((next - startOfToday) / DAY_MS);
}

export function birthdayIsSoon(userId: UserId): boolean {
  return daysUntilBirthday(userId) <= BIRTHDAY_HORIZON_DAYS;
}

/**
 * The countdown chip on the gift profile. Exported so a card can highlight it
 * by comparing against this rather than against a hardcoded string.
 */
export function birthdayTag(userId: UserId): string {
  return `Birthday in ${daysUntilBirthday(userId)} days`;
}

/** "Sabina's birthday is in 12 days", or the just-because line when it isn't. */
function birthdayBanner(userId: UserId): string {
  const days = daysUntilBirthday(userId);
  if (days > BIRTHDAY_HORIZON_DAYS) return "No birthday soon. Just-because gift.";
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return `${users[userId].name}'s birthday is ${when}`;
}

/**
 * Gift profiles: what the AI boiled each friend's month down to.
 * `purchaseCount` is the number quoted on the card.
 */
export const giftProfiles: Record<string, GiftProfile> = {
  kristina: {
    userId: "kristina",
    purchaseCount: 19,
    tags: [
      "Skincare, mostly after 9 PM",
      "Silver from small shops",
      "Vintage & antique",
      "Café matcha under $10",
      "One late splurge a month",
    ],
  },
  esh: {
    userId: "esh",
    purchaseCount: 14,
    tags: [
      "Silver jewelry",
      "Skincare, $20 to $50",
      "Vintage stores",
      "Neutral palette",
      "Rarely over $80",
    ],
  },
  sabina: {
    userId: "sabina",
    purchaseCount: 17,
    tags: [
      birthdayTag("sabina"),
      "Thrifted denim & tees",
      "Beaded jewelry",
      "Sneaker splurges",
      "Usually under $40",
    ],
  },
  madhav: {
    userId: "madhav",
    purchaseCount: 17,
    tags: [
      "Coffee rituals",
      "Small useful things",
      "Desk & tech",
      "Loyal to few shops",
      "Under $40, mostly",
    ],
  },
};

export const budgets: { key: "u25" | "u50" | "u100" | "group"; label: string }[] = [
  { key: "u25", label: "Under $25" },
  { key: "u50", label: "$25 to $50" },
  { key: "u100", label: "$50 to $100" },
  { key: "group", label: "Group gift" },
];

/**
 * Every line here names a behavioural or social signal, never "popular right
 * now" — the why-we-think rule from the design system.
 */
export const recommendations: Recommendation[] = [
  // Kristina
  {
    id: "rec-19",
    productId: "prod-esh-mask",
    forUserId: "kristina",
    budget: "u25",
    behavior: "Five skincare runs in September, three of them after 9 PM.",
    signal: "Sabina bought the centella cream at Olive & Aloe on Sept 14.",
  },
  {
    id: "rec-20",
    productId: "prod-madhav-notebook",
    forUserId: "kristina",
    budget: "u25",
    behavior: "Bought the Sundry pocket notebook on Sept 6. It is nearly full.",
    signal: "Madhav bought the trio a day earlier, on Sept 5.",
  },
  {
    id: "rec-21",
    productId: "prod-sabina-tote",
    forUserId: "kristina",
    budget: "u50",
    behavior: "Two bags this month: a $112 camera sling and a vintage leather shoulder bag.",
    signal: "Esh bought a linen tote there on Sept 13.",
  },
  {
    id: "rec-22",
    productId: "prod-esh-clip",
    forUserId: "kristina",
    budget: "u50",
    behavior: "Silver three times at Tin & Tulip, plus a brass lamp from Marlowe Vintage.",
    signal: "Sabina found a brooch at Pearl & Pine on Sept 12.",
  },
  {
    id: "rec-23",
    productId: "prod-madhav-kettle",
    forUserId: "kristina",
    budget: "u100",
    behavior: "Matcha twice in September and a hand-thrown espresso cup on Sept 26.",
    signal: "Madhav bought the ceramic dripper at Clay & Cloud on Sept 18.",
  },
  {
    id: "rec-24",
    productId: "prod-sabina-boots",
    forUserId: "kristina",
    budget: "u100",
    behavior: "Neutral, leather, and she has bought exactly one pair of shoes all month.",
    signal: "Esh rated these five out of five.",
  },

  // Esh
  {
    id: "rec-1",
    productId: "prod-esh-rings",
    forUserId: "esh",
    budget: "u25",
    behavior: "3 silver pieces this month, all from small shops.",
    signal: "Kristina bought rings and hoops from Tin & Tulip 3 times in September.",
  },
  {
    id: "rec-2",
    productId: "prod-esh-mask",
    forUserId: "esh",
    budget: "u25",
    behavior: "Skincare is their most repeated category: essence, mask, night cream.",
    signal: "Sabina bought the same centella cream at Olive & Aloe on Sept 14.",
  },
  {
    id: "rec-3",
    productId: "prod-esh-clip",
    forUserId: "esh",
    budget: "u50",
    behavior: "4 of their 14 buys were vintage or antique. Their natural habitat.",
    signal: "Sabina found a brooch at Pearl & Pine on Sept 12.",
  },
  {
    id: "rec-4",
    productId: "prod-esh-balm",
    forUserId: "esh",
    budget: "u50",
    behavior: "Essence first, then a night cream at 1:30 AM. They have a routine.",
    signal: "Three of you shopped skincare inside the same 72 hours.",
  },
  {
    id: "rec-5",
    productId: "prod-esh-bag",
    forUserId: "esh",
    budget: "u100",
    behavior:
      "Neutrals, leather, silver. And they rarely go over $80, so this stays under.",
    signal: "Kristina bought the same bag at Marlowe on Sept 11.",
  },
  {
    id: "rec-6",
    productId: "prod-esh-scarf",
    forUserId: "esh",
    budget: "u100",
    behavior: "Bought a wool overshirt here. Warm neutrals, bought early.",
    signal: "Sabina saved the same scarf last week.",
  },

  // Sabina
  {
    id: "rec-7",
    productId: "prod-sabina-bracelet",
    forUserId: "sabina",
    budget: "u25",
    behavior: "Bought a beaded bracelet on their big Saturday, Sept 12.",
    signal: "Esh reacted to Sabina's bracelet twice.",
  },
  {
    id: "rec-8",
    productId: "prod-sabina-whisk",
    forUserId: "sabina",
    budget: "u25",
    behavior: "Two matchas and a hojicha this month.",
    signal: "The Matcha Incident: all four of you are in it.",
  },
  {
    id: "rec-9",
    productId: "prod-sabina-tee",
    forUserId: "sabina",
    budget: "u50",
    behavior: "Three Rewind Vintage trips this month: tee, jacket, bandana.",
    signal: "Esh reacted to the denim jacket twice.",
  },
  {
    id: "rec-10",
    productId: "prod-sabina-tote",
    forUserId: "sabina",
    budget: "u50",
    behavior: "6 stores in one Saturday needs a bigger bag.",
    signal: "Esh bought a linen tote there on Sept 13.",
  },
  {
    id: "rec-11",
    productId: "prod-sabina-campus",
    forUserId: "sabina",
    budget: "u100",
    behavior: "Their one big splurge this month was sneakers.",
    signal: "Two friends copied their Sambas. You can return the favor.",
  },
  {
    id: "rec-12",
    productId: "prod-sabina-boots",
    forUserId: "sabina",
    budget: "u100",
    behavior: "Denim, cargo, sneakers. Their closet leans chunky.",
    signal: "Esh rated these five out of five.",
  },

  // Madhav
  {
    id: "rec-13",
    productId: "prod-madhav-hojicha",
    forUserId: "madhav",
    budget: "u25",
    behavior: "Nine café visits, then one surprise matcha at Mori on Sept 14.",
    signal: "Esh is the group's tea person.",
  },
  {
    id: "rec-14",
    productId: "prod-madhav-notebook",
    forUserId: "madhav",
    budget: "u25",
    behavior: "Bought the pocket notebook trio on Sept 5.",
    signal: "Kristina bought one too on Sept 6. Matching notebooks.",
  },
  {
    id: "rec-15",
    productId: "prod-madhav-cup",
    forUserId: "madhav",
    budget: "u50",
    behavior: "Four cortados in September. He deserves the proper cup.",
    signal: "Sabina bought a pinch pot at Clay & Cloud on Sept 5.",
  },
  {
    id: "rec-16",
    productId: "prod-madhav-cables",
    forUserId: "madhav",
    budget: "u50",
    behavior: "Volta Supply twice: a cable, then a keyboard.",
    signal: "Esh asked where the braided cable came from.",
  },
  {
    id: "rec-17",
    productId: "prod-madhav-kettle",
    forUserId: "madhav",
    budget: "u100",
    behavior: "Nine café visits and a ceramic dripper. Home brewing is next.",
    signal: "Esh saved the same kettle.",
  },
  {
    id: "rec-18",
    productId: "prod-madhav-wrist",
    forUserId: "madhav",
    budget: "u100",
    behavior: "He upgraded to a mechanical keyboard on Sept 11.",
    signal: "Sabina typed on it once and asked about a wrist rest.",
  },
];

export const groupGifts: Record<string, GroupGift> = {
  kristina: {
    forUserId: "kristina",
    productId: "prod-sabina-campus",
    banner: birthdayBanner("kristina"),
    bannerBg: birthdayIsSoon("kristina") ? "#E8806F" : "#A8DCC2",
    why: "Gazelles on Sept 17, at 8:30 PM. One pair of shoes all month, and one favourite shop.",
    splitWays: 3,
  },
  esh: {
    forUserId: "esh",
    productId: "prod-esh-vanity",
    banner: birthdayBanner("esh"),
    bannerBg: birthdayIsSoon("esh") ? "#E8806F" : "#A8DCC2",
    why: "They bought silver drop earrings here on Sept 15. This is the whole shelf.",
    splitWays: 3,
  },
  sabina: {
    forUserId: "sabina",
    productId: "prod-sabina-camera",
    banner: birthdayBanner("sabina"),
    bannerBg: birthdayIsSoon("sabina") ? "#E8806F" : "#A8DCC2",
    why: "Sept 12: six stores, eight hours, zero photos. She bought the film on Sept 27 anyway.",
    splitWays: 3,
  },
  madhav: {
    forUserId: "madhav",
    productId: "prod-madhav-grinder",
    banner: birthdayBanner("madhav"),
    bannerBg: birthdayIsSoon("madhav") ? "#E8806F" : "#A8DCC2",
    why: "9 visits to Grain & Co. earns a machine at home.",
    splitWays: 3,
  },
};

export function recommendationsFor(
  forUserId: string,
  budget: string,
): Recommendation[] {
  return recommendations.filter(
    (r) => r.forUserId === forUserId && r.budget === budget,
  );
}
