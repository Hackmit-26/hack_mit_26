/**
 * Client for the Unwrap backend (`backend/src/routes/`).
 *
 * Only ever imported by the service worker. Extension *pages* are subject to CORS and the backend
 * only allows `FRONTEND_ORIGIN`, but a service worker fetch to a host in `host_permissions` is
 * exempt — so routing every call through the worker means the backend needs no CORS change.
 */

import { getSettings } from "./settings.js";

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

async function request(path, { method = "GET", body } = {}) {
  const { apiBaseUrl, userId } = await getSettings();
  if (!userId) {
    throw new ApiError("UNAUTHENTICATED", "No viewer is set. Open the extension options.", 401);
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer dev:${userId}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "is unreachable";
    throw new ApiError("NETWORK", `The backend at ${apiBaseUrl} ${reason}.`, 0);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      error?.code ?? "INTERNAL",
      error?.message ?? `${method} ${path} failed with ${response.status}`,
      response.status,
    );
  }
  return payload;
}

/** Unauthenticated — the one route that works before a viewer is configured. */
export async function health(apiBaseUrl) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ApiError("NETWORK", `Nothing is listening at ${apiBaseUrl}.`, 0);
  }
  if (!response.ok) {
    throw new ApiError("INTERNAL", `Health check returned ${response.status}`, response.status);
  }
  return response.json();
}

export const me = () => request("/me");
export const myGroups = () => request("/me/groups");
export const myItems = () => request("/items/mine");
export const createItem = (body) => request("/items", { method: "POST", body });
export const wishlistLink = (body) => request("/wishlist/link", { method: "POST", body });
export const react = (itemId, type) => request("/reactions", { method: "POST", body: { itemId, type } });
export const updateVisibility = (itemId, visibility) =>
  request(`/items/${encodeURIComponent(itemId)}`, { method: "PATCH", body: { visibility } });
