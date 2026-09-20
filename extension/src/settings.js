/**
 * Extension settings, in `chrome.storage.sync`.
 *
 * `userId` is what the backend's dev auth stub keys off: it is sent as
 * `Authorization: Bearer dev:<userId>` (backend/src/auth/verifyUser.js). When that stub becomes
 * Supabase Auth, this is the one field that changes shape.
 */

export const DEFAULTS = {
  /** Fastify API. 8080 in real mode, 8081 in the fast/demo mode from UI_ITERATION_HANDOFF.md. */
  apiBaseUrl: "http://localhost:8080",
  /** Next.js app, used only for the "open wishlist" links. */
  appBaseUrl: "http://localhost:3000",
  userId: "",
  defaultGroupId: "",
  /** 'private' | 'shared' | 'anonymous' — the destination a fresh popup or quick-save picks. */
  defaultVisibility: "private",
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored, apiBaseUrl: trimSlash(stored.apiBaseUrl || DEFAULTS.apiBaseUrl) };
}

export async function setSettings(patch) {
  await chrome.storage.sync.set(patch);
  return getSettings();
}

export function trimSlash(url) {
  return url.replace(/\/+$/, "");
}

/**
 * The manifest only asks for localhost up front. Anything else — a tunnel, a deployed API — needs
 * the host permission granted at runtime, or the service worker's fetch is blocked by CORS.
 */
export function originPatternFor(apiBaseUrl) {
  try {
    const { protocol, hostname, port } = new URL(apiBaseUrl);
    return `${protocol}//${hostname}${port ? `:${port}` : ""}/*`;
  } catch {
    return null;
  }
}
