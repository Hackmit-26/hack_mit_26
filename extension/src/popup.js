import { originPatternFor, setSettings } from "./settings.js";

/** The vocabulary already present in `backend/fixtures`; the backend itself takes any string. */
const CATEGORIES = [
  "accessories",
  "art_crafts",
  "beauty",
  "books",
  "clothing",
  "food_drink",
  "games",
  "home",
  "kitchen",
  "music",
  "other",
  "shoes",
  "sports_outdoors",
  "stationery",
  "tech",
];

const $ = (id) => document.getElementById(id);

const panes = {
  loading: $("state-loading"),
  setup: $("state-setup"),
  form: $("state-form"),
  saved: $("state-saved"),
};

let state = { product: null, groups: [], settings: null, visibility: "private" };

function show(name) {
  for (const [key, pane] of Object.entries(panes)) pane.hidden = key !== name;
}

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function centsToInput(cents) {
  return Number.isInteger(cents) ? (cents / 100).toFixed(2) : "";
}

function inputToCents(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const amount = Number.parseFloat(trimmed.replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

/* ----------------------------------------------------------------- setup pane */

function renderSetup({ settings, granted }) {
  const needsPermission = !granted;
  $("setup-detail").textContent = needsPermission
    ? `Chrome needs permission to reach the backend at ${settings.apiBaseUrl}.`
    : "Choose which viewer you're saving as before you can add anything.";

  const cta = $("setup-cta");
  cta.textContent = needsPermission ? "Grant access" : "Open settings";
  cta.onclick = async () => {
    if (!needsPermission) {
      chrome.runtime.openOptionsPage();
      window.close();
      return;
    }
    const pattern = originPatternFor(settings.apiBaseUrl);
    const ok = pattern && (await chrome.permissions.request({ origins: [pattern] }));
    if (ok) {
      await boot();
    } else {
      chrome.runtime.openOptionsPage();
      window.close();
    }
  };
  show("setup");
}

/* ------------------------------------------------------------------ form pane */

function renderVisibility() {
  for (const button of $("visibility").querySelectorAll("button")) {
    button.setAttribute("aria-checked", String(button.dataset.value === state.visibility));
  }
  const grouped = state.visibility !== "private";
  $("group-field").hidden = !grouped;
  $("save").textContent = grouped ? "Share with the group" : "Save to wishlist";
}

function renderForm({ product, viewer, groups, duplicate, settings }) {
  $("title").value = product?.title ?? "";
  $("merchant").value = product?.merchant ?? "";
  $("price").value = centsToInput(product?.priceCents);

  const img = $("thumb-img");
  const fallback = $("thumb-fallback");
  if (product?.imageUrl) {
    img.src = product.imageUrl;
    img.hidden = false;
    fallback.hidden = true;
    // Hotlink protection and expiring CDN URLs are common; fall back rather than show a broken box.
    img.onerror = () => {
      img.hidden = true;
      fallback.hidden = false;
      fallback.textContent = (product.merchant ?? "?").slice(0, 1).toUpperCase();
    };
  } else {
    img.hidden = true;
    fallback.hidden = false;
    fallback.textContent = (product?.merchant ?? "?").slice(0, 1).toUpperCase();
  }

  const category = $("category");
  category.replaceChildren(
    ...CATEGORIES.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.replace(/_/g, " ");
      return option;
    }),
  );
  category.value = CATEGORIES.includes(product?.category) ? product.category : "other";

  const group = $("group");
  group.replaceChildren(
    ...groups.map((g) => {
      const option = document.createElement("option");
      option.value = g.id;
      option.textContent = g.name;
      return option;
    }),
  );
  if (groups.some((g) => g.id === settings.defaultGroupId)) group.value = settings.defaultGroupId;

  $("duplicate").hidden = !duplicate;
  $("viewer-line").textContent = viewer ? `Saving as ${viewer.name}` : "";

  // No group means nothing to share into; `POST /items` rejects a non-private item without one.
  for (const button of $("visibility").querySelectorAll("button")) {
    const needsGroup = button.dataset.value !== "private";
    button.disabled = needsGroup && groups.length === 0;
    button.title = button.disabled ? "Join a group first" : button.title;
  }

  state.visibility = groups.length === 0 ? "private" : settings.defaultVisibility;
  renderVisibility();
  show("form");
  $("title").focus();
}

async function save() {
  const button = $("save");
  button.disabled = true;
  $("form-error").hidden = true;

  const product = {
    ...state.product,
    title: $("title").value.trim() || state.product?.title || "Saved item",
    merchant: $("merchant").value.trim() || null,
    priceCents: inputToCents($("price").value),
    category: $("category").value,
    url: state.product?.url ?? state.tabUrl ?? null,
  };

  const response = await send({
    type: "SAVE",
    product,
    visibility: state.visibility,
    groupId: state.visibility === "private" ? state.settings.defaultGroupId || $("group").value : $("group").value,
  });

  button.disabled = false;

  if (!response?.ok) {
    $("form-error").textContent = response?.message ?? "Could not reach the extension worker.";
    $("form-error").hidden = false;
    return;
  }

  // The next save from this tab should inherit whatever was just chosen.
  await setSettings({ defaultVisibility: state.visibility });

  $("saved-headline").textContent = state.visibility === "private" ? "On your wishlist" : "Shared with the group";
  $("saved-detail").textContent = response.data.name;
  show("saved");
}

/* ----------------------------------------------------------------------- boot */

async function boot() {
  show("loading");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabUrl = tab?.url ?? null;

  const response = await send({ type: "BOOTSTRAP", tabId: tab?.id });
  if (!response?.ok) {
    renderSetup({ settings: { apiBaseUrl: "the backend" }, granted: true });
    $("setup-detail").textContent = response?.message ?? "Could not reach the extension worker.";
    return;
  }

  const data = response.data;
  state.product = data.product ?? {
    url: state.tabUrl,
    title: tab?.title ?? "",
    merchant: null,
    imageUrl: null,
    priceCents: null,
    category: "other",
  };
  state.groups = data.groups;
  state.settings = data.settings;

  if (!data.granted || !data.viewer) {
    renderSetup(data);
    return;
  }
  renderForm({ ...data, product: state.product });
}

$("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

$("visibility").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  state.visibility = button.dataset.value;
  renderVisibility();
});

$("save").addEventListener("click", () => {
  void save();
});

$("open-app").addEventListener("click", () => {
  void chrome.tabs.create({ url: `${state.settings.appBaseUrl}/wishlist` });
  window.close();
});

$("save-another").addEventListener("click", () => {
  void boot();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !panes.form.hidden) void save();
});

void boot();
