/**
 * Service worker: the only place in the extension that talks to the backend.
 *
 * Three entry points converge on `saveTab()` — the popup (edit first), the context menu, and the
 * keyboard command (both save immediately). Keeping one save path means the popup and the
 * one-keystroke path cannot drift apart.
 */

import * as api from "./api.js";
import { ApiError } from "./api.js";
import { getSettings, originPatternFor } from "./settings.js";

const MENU_PRIVATE = "shopwrapped-save-private";
const MENU_SHARE = "shopwrapped-save-shared";

/* --------------------------------------------------------------------- menus */

const CONTEXTS = ["page", "link", "image", "selection"];

/**
 * Serialised, and every await happens *before* `removeAll()`. Saving the options page fires this
 * three times in a row; overlapping runs would interleave a `removeAll` between two `create`s and
 * lose the share item to a duplicate-id error.
 */
let menuJob = Promise.resolve();

function buildMenus() {
  menuJob = menuJob.then(async () => {
    const { defaultGroupId } = await getSettings();
    const groups = defaultGroupId ? await api.myGroups().catch(() => []) : [];
    const groupName = groups.find((g) => g.id === defaultGroupId)?.name;

    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: MENU_PRIVATE,
      title: "Save to my Unwrap wishlist",
      contexts: CONTEXTS,
    });
    if (!defaultGroupId) return;
    chrome.contextMenus.create({
      id: MENU_SHARE,
      title: groupName ? `Share with ${groupName}` : "Share with my group",
      contexts: CONTEXTS,
    });
  });
  return menuJob;
}

chrome.runtime.onInstalled.addListener(() => void buildMenus());
chrome.runtime.onStartup.addListener(() => void buildMenus());
chrome.storage.sync.onChanged.addListener((changes) => {
  if (changes.defaultGroupId || changes.userId || changes.apiBaseUrl) void buildMenus();
});

/* -------------------------------------------------------------------- saving */

/**
 * Read the product out of the page. Fails on `chrome://`, the Web Store and PDF viewers, where no
 * script may run — callers fall back to the server-side preview.
 */
async function extractFromTab(tabId) {
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/extract.js"],
  });
  if (!injected?.result) throw new Error("Nothing product-shaped on this page");
  return injected.result;
}

function itemBodyFrom(product, { visibility, groupId }) {
  return {
    name: (product.title || "Saved item").slice(0, 200),
    category: (product.category || "other").slice(0, 60),
    merchant: product.merchant ? product.merchant.slice(0, 120) : null,
    // The backend validates these as URLs, so an empty string is a 400 where null is fine.
    imageUrl: product.imageUrl || null,
    productUrl: product.url || null,
    description: product.description || null,
    priceCents: Number.isInteger(product.priceCents) && product.priceCents >= 0 ? product.priceCents : null,
    groupId: groupId || null,
    visibility,
  };
}

/**
 * `POST /items` then `POST /reactions` rather than `POST /wishlist/link`, because the link route
 * re-fetches the URL server-side and would throw away the richer scrape we already have. The
 * reaction is what actually puts the item on `GET /wishlist`; without it the item exists but the
 * wishlist stays empty.
 */
async function saveExtracted(product, { visibility, groupId }) {
  const item = await api.createItem(itemBodyFrom(product, { visibility, groupId }));
  await api.react(item.id, "wishlist");
  return item;
}

/**
 * Pages we cannot inject into, and right-clicked links: let the backend's Open Graph scraper try.
 * `POST /wishlist/link` always lands the item `private`, so sharing needs the follow-up PATCH.
 */
async function saveByUrl(url, { visibility, groupId }) {
  const item = await api.wishlistLink({ url, ...(groupId ? { groupId } : {}) });
  return visibility === "private" ? item : api.updateVisibility(item.id, visibility);
}

/**
 * One save, from any entry point.
 * `target` lets the context menu save a right-clicked link instead of the page it sits on.
 */
async function saveTab(tab, { visibility, groupId, target = null }) {
  const settings = await getSettings();
  const resolvedGroup = groupId ?? settings.defaultGroupId ?? "";
  if (visibility !== "private" && !resolvedGroup) {
    throw new ApiError("VALIDATION_ERROR", "Pick a group in the extension options first.", 400);
  }

  if (target) return saveByUrl(target, { visibility, groupId: resolvedGroup });

  let product;
  try {
    product = await extractFromTab(tab.id);
  } catch {
    if (!tab.url?.startsWith("http")) {
      throw new ApiError("VALIDATION_ERROR", "This page can't be saved — open the product page first.", 400);
    }
    return saveByUrl(tab.url, { visibility, groupId: resolvedGroup });
  }

  return saveExtracted(product, { visibility, groupId: resolvedGroup });
}

/* ---------------------------------------------------------------- feedback */

async function flashBadge(tabId, ok) {
  // A context-menu click outside a tab reports id -1, which setBadgeText rejects.
  const scope = tabId > 0 ? { tabId } : {};
  await chrome.action.setBadgeBackgroundColor({ color: ok ? "#A8DCC2" : "#E8806F" });
  await chrome.action.setBadgeText({ text: ok ? "✓" : "!", ...scope });
  setTimeout(() => void chrome.action.setBadgeText({ text: "", ...scope }), 2500);
}

/**
 * In-page confirmation for the two entry points that have no popup to render into. Self-contained
 * because it is serialised across into the page's world.
 */
function toastInPage(message, ok) {
  const id = "shop-wrapped-toast";
  document.getElementById(id)?.remove();

  const el = document.createElement("div");
  el.id = id;
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    zIndex: "2147483647",
    top: "16px",
    right: "16px",
    maxWidth: "320px",
    padding: "12px 16px",
    borderRadius: "12px",
    background: ok ? "#0B0F2A" : "#B8412F",
    color: "#F5ECD9",
    font: "500 14px/1.4 system-ui, -apple-system, sans-serif",
    boxShadow: "0 8px 28px rgba(11,15,42,.28)",
    opacity: "0",
    transform: "translateY(-8px)",
    transition: "opacity .18s ease, transform .18s ease",
    pointerEvents: "none",
  });
  document.documentElement.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

async function toast(tabId, message, ok) {
  if (!(tabId > 0)) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: toastInPage,
      args: [message, ok],
    });
  } catch {
    // Restricted page — the badge already said what happened.
  }
}

async function saveAndReport(tab, options) {
  try {
    const item = await saveTab(tab, options);
    const where = options.visibility === "private" ? "your wishlist" : "your group";
    await flashBadge(tab.id, true);
    await toast(tab.id, `Saved “${item.name}” to ${where}`, true);
    return item;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save this item";
    await flashBadge(tab.id, false);
    await toast(tab.id, message, false);
    throw err;
  }
}

/* --------------------------------------------------------------- listeners */

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;
  const visibility = info.menuItemId === MENU_SHARE ? "shared" : "private";
  // A right-clicked link points somewhere else entirely; a right-clicked image is still this page,
  // and reading the page beats asking the server to re-fetch it.
  void saveAndReport(tab, { visibility, target: info.linkUrl ?? null }).catch(() => {});
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "quick-save") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const { defaultVisibility } = await getSettings();
  void saveAndReport(tab, { visibility: defaultVisibility }).catch(() => {});
});

/* ------------------------------------------------------------ popup bridge */

/** Two links to the same product rarely agree on tracking params; ignore them when de-duping. */
function normaliseUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid|ref|ref_|mc_|_gl)/i.test(key)) parsed.searchParams.delete(key);
    }
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return url;
  }
}

async function bootstrap(tabId) {
  const settings = await getSettings();
  const pattern = originPatternFor(settings.apiBaseUrl);
  const granted = pattern ? await chrome.permissions.contains({ origins: [pattern] }) : false;

  // The scrape is independent of the backend, so it runs even when setup is incomplete — the
  // popup can then show what it *would* save while asking for the missing piece.
  const product = await extractFromTab(tabId).catch(() => null);

  if (!granted || !settings.userId) {
    return { settings, granted, product, viewer: null, groups: [], duplicate: null };
  }

  const [viewer, groups, mine] = await Promise.all([
    api.me(),
    api.myGroups(),
    api.myItems().catch(() => []),
  ]);

  const key = product?.url ? normaliseUrl(product.url) : null;
  const duplicate = key ? (mine.find((i) => i.productUrl && normaliseUrl(i.productUrl) === key) ?? null) : null;

  return { settings, granted, product, viewer, groups, duplicate };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case "BOOTSTRAP":
        return bootstrap(message.tabId);
      case "SAVE": {
        const item = await saveExtracted(message.product, {
          visibility: message.visibility,
          groupId: message.groupId,
        });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await flashBadge(tab?.id, true);
        return item;
      }
      case "HEALTH":
        return api.health(message.apiBaseUrl);
      case "VERIFY": {
        const [viewer, groups] = await Promise.all([api.me(), api.myGroups()]);
        return { viewer, groups };
      }
      case "REBUILD_MENUS":
        return buildMenus();
      default:
        throw new Error(`Unknown message ${message?.type}`);
    }
  };

  run()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) =>
      sendResponse({
        ok: false,
        code: err instanceof ApiError ? err.code : "INTERNAL",
        message: err instanceof Error ? err.message : "Something went wrong",
      }),
    );
  return true; // keeps the channel open for the async reply
});
