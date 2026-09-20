import { getSettings, originPatternFor, setSettings, trimSlash } from "./settings.js";

/**
 * The personas `DEMO_MODE=true` seeds from `backend/fixtures/seed-personas.json` — one click
 * instead of typing an id. Any other backend just uses the text field.
 */
const DEMO_USERS = ["esh", "kristina", "madhav", "sabina"];

const $ = (id) => document.getElementById(id);

const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));

function status(el, text, ok) {
  el.textContent = text;
  el.className = `status ${ok ? "ok" : "bad"}`;
}

/** Non-localhost backends are not in the manifest, so ask before the first request fails. */
async function ensurePermission(apiBaseUrl) {
  const pattern = originPatternFor(apiBaseUrl);
  if (!pattern) return false;
  if (await chrome.permissions.contains({ origins: [pattern] })) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

const typedApiBaseUrl = () => trimSlash($("apiBaseUrl").value.trim() || "http://localhost:8080");

async function persistConnection() {
  await setSettings({
    apiBaseUrl: typedApiBaseUrl(),
    appBaseUrl: trimSlash($("appBaseUrl").value.trim() || "http://localhost:3000"),
    userId: $("userId").value.trim(),
  });
}

function renderGroups(groups, selected) {
  const select = $("defaultGroupId");
  select.replaceChildren();
  if (groups.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No groups yet";
    select.append(option);
    return;
  }
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    select.append(option);
  }
  if (groups.some((g) => g.id === selected)) select.value = selected;
}

async function testConnection() {
  // Permission first: `chrome.permissions.request` has to run inside the click's gesture, and an
  // awaited storage write before it breaks that chain.
  const apiBaseUrl = typedApiBaseUrl();
  if (!(await ensurePermission(apiBaseUrl))) {
    status($("health"), "Chrome denied access to that host.", false);
    return;
  }
  await persistConnection();
  const response = await send({ type: "HEALTH", apiBaseUrl });
  if (!response?.ok) {
    status($("health"), response?.message ?? "Unreachable", false);
    return;
  }
  const { visaMode, llmMode } = response.data;
  status($("health"), `Reachable — visa: ${visaMode}, llm: ${llmMode}`, true);
}

async function verify() {
  if (!$("userId").value.trim()) {
    status($("viewer"), "Enter a user id first.", false);
    return;
  }
  if (!(await ensurePermission(typedApiBaseUrl()))) {
    status($("viewer"), "Chrome denied access to that host.", false);
    return;
  }
  await persistConnection();

  const response = await send({ type: "VERIFY" });
  if (!response?.ok) {
    status($("viewer"), response?.message ?? "The extension worker did not reply.", false);
    return;
  }

  const { viewer, groups } = response.data;
  const { defaultGroupId } = await getSettings();
  renderGroups(groups, defaultGroupId || groups[0]?.id);
  status(
    $("viewer"),
    `Signed in as ${viewer.name} · ${groups.length} group${groups.length === 1 ? "" : "s"}`,
    true,
  );
}

async function save() {
  await persistConnection();
  // The select holds a single empty placeholder until `verify()` fills it. Writing that back
  // would silently drop an already-configured group.
  const groupId = $("defaultGroupId").value;
  await setSettings({
    ...(groupId ? { defaultGroupId: groupId } : {}),
    defaultVisibility: $("defaultVisibility").value,
  });
  await send({ type: "REBUILD_MENUS" });
  status($("saved-note"), "Saved.", true);
  setTimeout(() => {
    $("saved-note").textContent = "";
  }, 2000);
}

async function boot() {
  const settings = await getSettings();
  $("apiBaseUrl").value = settings.apiBaseUrl;
  $("appBaseUrl").value = settings.appBaseUrl;
  $("userId").value = settings.userId;
  $("defaultVisibility").value = settings.defaultVisibility;
  renderGroups([], settings.defaultGroupId);

  for (const id of DEMO_USERS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = id;
    chip.addEventListener("click", () => {
      $("userId").value = id;
      void verify();
    });
    $("demo-users").append(chip);
  }

  if (settings.userId) void verify();
}

$("test").addEventListener("click", () => void testConnection());
$("verify").addEventListener("click", () => void verify());
$("save").addEventListener("click", () => void save());

void boot();
