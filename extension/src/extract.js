/**
 * Runs in the page. Returns one product guess for whatever the tab is showing.
 *
 * This is the whole reason the extension exists rather than just pasting a link into the app:
 * `backend/src/products/linkPreview.ts` fetches the URL server-side with a bot user-agent, and the
 * retailers worth saving from (Amazon, Nike, Zara, SSENSE) answer that with a 503 or a consent
 * wall. The browser already has the rendered, cookied page — read it here instead.
 *
 * Injected with `chrome.scripting.executeScript({ files: [...] })`, so the file must END in an
 * expression: that value is what `result` carries back.
 */

(() => {
  const abs = (value) => {
    if (!value || typeof value !== "string") return null;
    try {
      const url = new URL(value.trim(), document.baseURI);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  };

  const clean = (value) =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : null;

  const meta = (...names) => {
    for (const name of names) {
      const el = document.querySelector(
        `meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`,
      );
      const content = clean(el?.getAttribute("content"));
      if (content) return content;
    }
    return null;
  };

  /** Money is integer cents everywhere past this boundary (see backend `priceCents`). */
  const toCents = (raw) => {
    if (typeof raw === "number") {
      return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) : null;
    }
    if (typeof raw !== "string") return null;
    // Match ONE money token. Allowing whitespace inside the token would run "$1,299.00 $1,499.00"
    // - which is exactly how a sale price and its struck-through sibling read - into one number.
    // French and Scandinavian sites space their thousands ("1 299,00 €"). Only close that gap when
    // the whole string is one such number - otherwise "$30.00 100% cotton" fuses into $30,001.00.
    const spaced = /^[^\d]*\d{1,3}(?:[\s\u00a0]\d{3})+(?:[.,]\d{1,2})?[^\d]*$/.test(raw);
    const joined = spaced ? raw.replace(/[\s\u00a0]/g, "") : raw;
    const match = /\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?/.exec(joined);
    if (!match) return null;
    // "1,299.00" and "1.299,00" both appear in the wild; the last separator is the decimal one.
    let digits = match[0];
    const lastComma = digits.lastIndexOf(",");
    const lastDot = digits.lastIndexOf(".");
    const decimal = Math.max(lastComma, lastDot);
    if (decimal !== -1 && digits.length - decimal - 1 <= 2) {
      digits = `${digits.slice(0, decimal).replace(/[.,]/g, "")}.${digits.slice(decimal + 1)}`;
    } else {
      digits = digits.replace(/[.,]/g, "");
    }
    const amount = Number.parseFloat(digits);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
  };

  /**
   * schema.org Product, wherever it is hiding: a bare object, an array, or a node inside `@graph`.
   * This is the highest-confidence source by a wide margin, so it is tried before anything else.
   */
  const productFromJsonLd = () => {
    const seen = [];
    const walk = (node, depth) => {
      if (!node || depth > 6) return;
      if (Array.isArray(node)) {
        for (const child of node) walk(child, depth + 1);
        return;
      }
      if (typeof node !== "object") return;
      const type = node["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.some((t) => typeof t === "string" && /product|book|vehicle/i.test(t))) {
        seen.push(node);
      }
      if (node["@graph"]) walk(node["@graph"], depth + 1);
      if (node.mainEntity) walk(node.mainEntity, depth + 1);
      if (node.itemListElement) walk(node.itemListElement, depth + 1);
      // ListItem wraps the real node one level down; without this every carousel is invisible.
      if (node.item) walk(node.item, depth + 1);
    };

    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        walk(JSON.parse(script.textContent ?? ""), 0);
      } catch {
        // Retailers ship malformed JSON-LD constantly. One bad block must not lose the good ones.
      }
    }
    // Document order puts a "you may also like" carousel ahead of the page's own product, so
    // prefer whichever node actually carries a price.
    return seen.find((p) => p.offers && p.name) ?? seen.find((p) => p.name) ?? seen[0] ?? null;
  };

  const offerOf = (product) => {
    const offers = product?.offers;
    const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
    return (
      list.find(
        (o) =>
          o && (o.price ?? o.lowPrice ?? o.highPrice ?? o.priceSpecification?.price) !== undefined,
      ) ?? null
    );
  };

  const offerPrice = (offer) =>
    offer?.price ?? offer?.lowPrice ?? offer?.priceSpecification?.price ?? null;

  const jsonLdImage = (product) => {
    const image = product?.image;
    if (typeof image === "string") return abs(image);
    if (Array.isArray(image)) return abs(typeof image[0] === "string" ? image[0] : image[0]?.url);
    return abs(image?.url ?? image?.contentUrl);
  };

  /**
   * Last resort when there is no structured data: the biggest image above the fold that is not a
   * logo or a sprite. Small, data-URI and 1:8-aspect images are chrome, not product shots.
   */
  const largestImage = () => {
    let best = null;
    let bestArea = 40_000; // ~200x200; below this it is an icon.
    for (const img of document.images) {
      // On a lazy-loading page nothing has decoded yet and naturalWidth is 0, which used to make
      // this whole fallback dead. The laid-out box is the honest size in that case.
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (!w || !h) {
        const box = img.getBoundingClientRect();
        w = box.width;
        h = box.height;
      }
      if (!w || !h) continue;
      const ratio = w / h;
      if (ratio > 4 || ratio < 0.25) continue;
      const src =
        img.currentSrc ||
        img.getAttribute("src") ||
        img.dataset.src ||
        img.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
      if (!src || src.startsWith("data:")) continue;
      if (/sprite|logo|icon|placeholder|pixel/i.test(src)) continue;
      if (w * h > bestArea) {
        bestArea = w * h;
        best = src;
      }
    }
    return abs(best);
  };

  /**
   * DOM price scrape, only reached when structured data and OG tags both came up empty.
   * Ordered most- to least-specific; the generic `[class*=price]` sweep is deliberately last
   * because it also matches "was" prices and shipping estimates.
   */
  const priceFromDom = () => {
    // Struck-through "was" prices sit right next to the real one and usually come first in the
    // document, so they have to be excluded rather than merely out-ranked.
    const STRIKE =
      "del, s, strike, [class*='strike' i], [class*='was' i], [class*='compare' i], " +
      "[class*='old-price' i], [class*='list-price' i], [class*='save' i], [class*='basisprice' i]";
    const NOISE =
      /\/\s*mo|per month|month|save|shipping|rrp|msrp|retail|%\s*off|\boff\b|out of|star|review/i;

    const selectors = [
      "[itemprop='price'][content]",
      "[data-testid*='price' i]",
      "[itemprop='price']",
      ".a-price .a-offscreen", // Amazon
      ".price-characteristic",
      "[class*='ProductPrice' i]",
      "[class*='product-price' i]",
      // Deliberately last: it also matches financing, shipping and "you save" figures.
      "[class*='price' i]",
      "[id*='price' i]",
    ];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (el.closest(STRIKE)) continue;
        const attr = el.getAttribute("content");
        const text = clean(attr ?? el.textContent);
        if (!text || text.length > 40 || !/\d/.test(text)) continue;
        if (!attr && NOISE.test(text)) continue;
        const cents = toCents(text);
        // Under 50c is a rating, a review count or a "0" placeholder, not a product price.
        if (cents && cents >= 50) return cents;
      }
    }
    return null;
  };

  /** No currency field exists downstream; this is for the popup's own display only. */
  const currencyFromSymbol = (text) => {
    if (!text) return null;
    if (text.includes("£")) return "GBP";
    if (text.includes("€")) return "EUR";
    if (text.includes("¥")) return "JPY";
    if (text.includes("$")) return "USD";
    return null;
  };

  const CATEGORY_KEYWORDS = [
    ["shoes", /\b(sneaker|trainer|shoe|boot|loafer|sandal|heel|clog|mule)\b/i],
    ["clothing", /\b(shirt|tee|t-shirt|jacket|coat|dress|jean|trouser|pant|hoodie|sweater|knit|skirt|blazer|cardigan|parka|vest|short)\b/i],
    ["accessories", /\b(bag|tote|backpack|wallet|belt|scarf|hat|cap|sunglass|jewel|necklace|earring|ring|bracelet|watch)\b/i],
    ["beauty", /\b(serum|cleanser|moisturis|moisturiz|lipstick|fragrance|perfume|skincare|shampoo|balm|mascara|spf|sunscreen)\b/i],
    ["kitchen", /\b(kettle|pan|skillet|knife|mug|grinder|espresso|cookware|blender|whisk|chopping|dutch oven|teapot)\b/i],
    ["home", /\b(lamp|candle|cushion|rug|vase|duvet|throw|shelf|chair|linen|towel|planter|mirror)\b/i],
    ["tech", /\b(headphone|earbud|laptop|keyboard|monitor|camera|ssd|charger|cable|iphone|ipad|speaker|mouse|gpu|console)\b/i],
    ["books", /\b(book|novel|paperback|hardcover|memoir|isbn)\b/i],
    ["stationery", /\b(notebook|pen |pencil|journal|planner|sticker|washi|fountain pen)\b/i],
    ["food_drink", /\b(coffee|tea|matcha|hojicha|chocolate|snack|olive oil|honey|wine|beans)\b/i],
    ["games", /\b(board game|puzzle|lego|nintendo|playstation|xbox|figure|tcg)\b/i],
    ["music", /\b(vinyl|record|turntable|guitar|synth|headphone amp|album)\b/i],
    ["sports_outdoors", /\b(yoga|running|bike|cycling|tent|hiking|dumbbell|climbing|ski|racket)\b/i],
    ["art_crafts", /\b(paint|canvas|yarn|knitting|embroider|sketch|clay|craft)\b/i],
  ];

  /** Matches the vocabulary already in `backend/fixtures`; anything unrecognised is 'other'. */
  const matchCategory = (haystack) => {
    for (const [category, pattern] of CATEGORY_KEYWORDS) {
      if (pattern.test(haystack)) return category;
    }
    return "other";
  };

  /**
   * The keyword list is scanned in its own order, not the haystack's, so folding a breadcrumb
   * into the product name lets a stray nav link win: "Shoes" in the site nav classifies a t-shirt
   * as footwear. The name gets first refusal; the breadcrumb only breaks a tie of "other".
   */
  const guessCategory = (name, context) => {
    const fromName = matchCategory(name);
    return fromName === "other" ? matchCategory(context) : fromName;
  };

  const product = productFromJsonLd();
  const offer = offerOf(product);

  const canonical =
    abs(document.querySelector('link[rel="canonical"]')?.getAttribute("href")) ??
    abs(meta("og:url")) ??
    location.href;

  const title =
    clean(product?.name) ??
    meta("og:title", "twitter:title") ??
    // Amazon has no og:title and no h1 — the product name lives in this span.
    clean(document.getElementById("productTitle")?.textContent) ??
    clean(document.querySelector("h1")?.textContent) ??
    clean(document.title) ??
    location.hostname;

  const imageUrl =
    jsonLdImage(product) ??
    abs(meta("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src")) ??
    largestImage();

  const metaPrice = meta("og:price:amount", "product:price:amount", "twitter:data1");
  const priceCents = toCents(offerPrice(offer)) ?? toCents(metaPrice) ?? priceFromDom();

  const currency =
    clean(offer?.priceCurrency) ??
    meta("og:price:currency", "product:price:currency") ??
    currencyFromSymbol(metaPrice) ??
    currencyFromSymbol(clean(document.querySelector(".a-price .a-offscreen")?.textContent)) ??
    null;

  const hostname = location.hostname.replace(/^www\./, "");
  const merchant =
    clean(typeof product?.brand === "string" ? product.brand : product?.brand?.name) ??
    meta("og:site_name") ??
    hostname;

  const description =
    clean(product?.description)?.slice(0, 2000) ??
    meta("og:description", "description", "twitter:description")?.slice(0, 2000) ??
    null;

  const breadcrumb = [...document.querySelectorAll('[class*="breadcrumb" i] a')]
    .slice(0, 12)
    .map((a) => a.textContent ?? "")
    .join(" ");

  // schema.org allows `category` to be a Thing, which stringifies to "[object Object]".
  const ldCategory =
    typeof product?.category === "string" ? product.category : (product?.category?.name ?? "");

  return {
    url: canonical,
    title: title.slice(0, 200),
    imageUrl,
    priceCents,
    currency,
    merchant: merchant.slice(0, 120),
    description,
    category: guessCategory(title, `${breadcrumb} ${ldCategory}`),
    // Nearly every page has an og:title, so that proves nothing. A price is the signal that the
    // page really is a product page and the popup can be trusted without editing.
    confident: Boolean(offer || priceCents),
  };
})();
