/**
 * Base URL and viewer identity for the API client.
 *
 * Auth is a dev stub: the backend accepts `Authorization: Bearer dev:<userId>` and looks the user
 * straight up. The demo backend seeds the same four ids the UI uses - `kristina`, `esh`, `sabina`,
 * `madhav` - so the token is just the UserId:
 *
 *   setViewer("sabina")       // sends `Bearer dev:sabina`
 *   setAuthToken("dev:sabina") // or set the raw token yourself
 *
 * This is module state, not React state - call setViewer() then re-fetch. The demo switcher in
 * `@/components/demo/ViewerSwitcher` goes through `setViewerId` on the store, which does both.
 */

const DEFAULT_BASE_URL = "http://localhost:8080";

/**
 * Who a fresh page load is. NEXT_PUBLIC_DEV_USER_ID still wins so a stale `.env.local` keeps
 * working, but it is no longer required: the demo seed always has a Kristina.
 */
export const DEFAULT_VIEWER_ID = "kristina";

/** Trailing slashes are stripped so path joins stay predictable. */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL
).replace(/\/+$/, "");

function initialToken(): string | null {
  return `dev:${process.env.NEXT_PUBLIC_DEV_USER_ID || DEFAULT_VIEWER_ID}`;
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
