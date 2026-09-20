/**
 * Base URL and viewer identity for the API client.
 *
 * Auth is a dev stub: the backend accepts `Authorization: Bearer dev:<userUuid>` and looks the
 * user straight up. The demo hops between four users, so the token lives in a module-level
 * variable that any component may overwrite:
 *
 *   setViewer("8f3c...-uuid")   // sends `Bearer dev:8f3c...`
 *   setAuthToken("dev:8f3c...")  // or set the raw token yourself
 *
 * The initial value comes from NEXT_PUBLIC_DEV_USER_ID so a fresh page load has a viewer.
 * This is module state, not React state - call setViewer() then re-fetch.
 */

const DEFAULT_BASE_URL = "http://localhost:8080";

/** Trailing slashes are stripped so path joins stay predictable. */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL
).replace(/\/+$/, "");

function initialToken(): string | null {
  const userId = process.env.NEXT_PUBLIC_DEV_USER_ID;
  return userId ? `dev:${userId}` : null;
}

let authToken: string | null = initialToken();

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Sugar for the demo user switcher: wraps a user UUID in the `dev:` scheme. */
export function setViewer(userId: string | null): void {
  authToken = userId ? `dev:${userId}` : null;
}

export function getViewerId(): string | null {
  if (!authToken) return null;
  return authToken.startsWith("dev:") ? authToken.slice(4) : authToken;
}
