/**
 * Typed client for the Shop Wrapped backend (`backend/src/routes/`).
 * Plain functions over `fetch` - no caching, no retries, safe to import on server or client.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/config";
import type {
  ApiErrorCode,
  ApprovalProof,
  Birthday,
  CardResponse,
  Contribution,
  CreateGroupBody,
  CreateItemBody,
  CreateThreadBody,
  DuplicateThreadEnvelope,
  FindItem,
  GiftPick,
  Group,
  HealthResponse,
  IngestReceiptBody,
  Item,
  JoinGroupBody,
  PasskeyAuthOptions,
  PasskeyRegistrationOptions,
  PasskeyRegistrationVerifyBody,
  PasskeyVerifyResponse,
  ReactionBody,
  Reveal,
  SetCardBody,
  Thread,
  ThreadPickLinkBody,
  UpdateItemVisibilityBody,
  UpdateMeBody,
  User,
  VetoWrappedCardBody,
  VoteBody,
  WishlistLinkBody,
  WrappedResponse,
} from "@/lib/apiTypes";

export * from "@/lib/apiTypes";
export { API_BASE_URL, getAuthToken, getViewerId, setAuthToken, setViewer } from "@/lib/config";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Raw decoded body, for the handful of errors that carry extra fields (see 409 on POST /threads). */
  readonly body: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

/** POST /threads returns 409 with the id of the thread that already exists. */
export function duplicateThreadId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as Partial<DuplicateThreadEnvelope> | null;
  return typeof body?.threadId === "string" ? body.threadId : null;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
};

function decode(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function envelopeOf(payload: unknown): { code: string; message: string } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== "string" || typeof message !== "string") return null;
  return { code, message };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    throw new ApiError(
      "NETWORK_ERROR",
      cause instanceof Error ? cause.message : "Could not reach the server",
      0,
    );
  }

  const text = await response.text();
  const payload = decode(text);

  if (!response.ok) {
    // A dead proxy or a crashed server answers with HTML or nothing at all; fall back to status.
    const envelope = envelopeOf(payload);
    throw new ApiError(
      envelope?.code ?? `HTTP_${response.status}`,
      envelope?.message ?? response.statusText ?? `Request failed with status ${response.status}`,
      response.status,
      payload ?? (text || null),
    );
  }

  // 204s (reactions, votes, vetoes, demo reset) have no body at all - do not try to decode one.
  if (text.length === 0) return undefined as T;

  if (payload === undefined) {
    throw new ApiError("INVALID_RESPONSE", "Server returned a non-JSON body", response.status, text);
  }
  return payload as T;
}

const seg = encodeURIComponent;

/* ----------------------------------------------------------------- system */

export function health(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function resetDemo(): Promise<void> {
  return request<void>("/demo/reset", { method: "POST" });
}

/* ------------------------------------------------------------------- me */

/** Resolves the bearer token to a user, so nothing downstream has to hardcode a uuid. */
export function getMe(): Promise<User> {
  return request<User>("/me");
}

export function listMyGroups(): Promise<Group[]> {
  return request<Group[]>("/me/groups");
}

export function updateMe(body: UpdateMeBody): Promise<User> {
  return request<User>("/me", { method: "PATCH", body });
}

export function setMyCard(body: SetCardBody): Promise<CardResponse> {
  return request<CardResponse>("/me/card", { method: "POST", body });
}

/* --------------------------------------------------------------- groups */

export function createGroup(body: CreateGroupBody): Promise<Group> {
  return request<Group>("/groups", { method: "POST", body });
}

export function joinGroup(body: JoinGroupBody): Promise<Group> {
  return request<Group>("/groups/join", { method: "POST", body });
}

export function getGroup(groupId: string): Promise<Group> {
  return request<Group>(`/groups/${seg(groupId)}`);
}

export function listGroupBirthdays(groupId: string): Promise<Birthday[]> {
  return request<Birthday[]>(`/groups/${seg(groupId)}/birthdays`);
}

/* ---------------------------------------------------------------- items */

export function listMyItems(): Promise<Item[]> {
  return request<Item[]>("/items/mine");
}

export function createItem(body: CreateItemBody): Promise<Item> {
  return request<Item>("/items", { method: "POST", body });
}

export function updateItemVisibility(
  itemId: string,
  body: UpdateItemVisibilityBody,
): Promise<Item> {
  return request<Item>(`/items/${seg(itemId)}`, { method: "PATCH", body });
}

export function ingestReceipt(body: IngestReceiptBody): Promise<Item[]> {
  return request<Item[]>("/items/ingest", { method: "POST", body });
}

/* ------------------------------------------------------------ reactions */

export function addReaction(body: ReactionBody): Promise<void> {
  return request<void>("/reactions", { method: "POST", body });
}

export function removeReaction(body: ReactionBody): Promise<void> {
  return request<void>("/reactions", { method: "DELETE", body });
}

/* ------------------------------------------------------------- wishlist */

export function addWishlistLink(body: WishlistLinkBody): Promise<Item> {
  return request<Item>("/wishlist/link", { method: "POST", body });
}

/* ---------------------------------------------------------------- finds */

export function listGroupFinds(groupId: string): Promise<FindItem[]> {
  return request<FindItem[]>(`/groups/${seg(groupId)}/finds`);
}

/* -------------------------------------------------------------- wrapped */

export function generateWrapped(groupId: string): Promise<WrappedResponse> {
  return request<WrappedResponse>(`/groups/${seg(groupId)}/wrapped`, { method: "POST" });
}

export function getWrapped(wrappedId: string): Promise<WrappedResponse> {
  return request<WrappedResponse>(`/wrapped/${seg(wrappedId)}`);
}

export function vetoWrappedCard(wrappedId: string, body: VetoWrappedCardBody): Promise<void> {
  return request<void>(`/wrapped/${seg(wrappedId)}/veto`, { method: "POST", body });
}

/* -------------------------------------------------------------- threads */

export function createThread(body: CreateThreadBody): Promise<Thread> {
  return request<Thread>("/threads", { method: "POST", body });
}

export function getThread(threadId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}`);
}

export function listGroupThreads(groupId: string): Promise<Thread[]> {
  return request<Thread[]>(`/groups/${seg(groupId)}/threads`);
}

export function generateThreadPicks(threadId: string): Promise<GiftPick[]> {
  return request<GiftPick[]>(`/threads/${seg(threadId)}/picks`, { method: "POST" });
}

export function addThreadPickLink(threadId: string, body: ThreadPickLinkBody): Promise<GiftPick> {
  return request<GiftPick>(`/threads/${seg(threadId)}/picks/link`, { method: "POST", body });
}

export function voteForPick(threadId: string, body: VoteBody): Promise<void> {
  return request<void>(`/threads/${seg(threadId)}/votes`, { method: "POST", body });
}

export function lockThread(threadId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}/lock`, { method: "POST" });
}

export function cancelThread(threadId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}/cancel`, { method: "POST" });
}

export function markThreadBought(threadId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}/bought`, { method: "POST" });
}

export function revealThread(threadId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}/reveal`, { method: "POST" });
}

/* -------------------------------------------------------- contributions */

export function approveMyContribution(
  threadId: string,
  proof: ApprovalProof = { confirm: true },
): Promise<Contribution> {
  return request<Contribution>(`/threads/${seg(threadId)}/contributions/me/approve`, {
    method: "POST",
    body: proof,
  });
}

export function optOutOfContribution(threadId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}/contributions/me/opt-out`, { method: "POST" });
}

export function removeContributor(threadId: string, userId: string): Promise<Thread> {
  return request<Thread>(`/threads/${seg(threadId)}/contributions/${seg(userId)}/remove`, {
    method: "POST",
  });
}

/* -------------------------------------------------------------- reveals */

export function getReveal(threadId: string): Promise<Reveal> {
  return request<Reveal>(`/reveals/${seg(threadId)}`);
}

/* ------------------------------------------------------------- passkeys */

export function getPasskeyRegistrationOptions(): Promise<PasskeyRegistrationOptions> {
  return request<PasskeyRegistrationOptions>("/passkeys/register/options", { method: "POST" });
}

export function verifyPasskeyRegistration(
  body: PasskeyRegistrationVerifyBody,
): Promise<PasskeyVerifyResponse> {
  return request<PasskeyVerifyResponse>("/passkeys/register/verify", { method: "POST", body });
}

export function getPasskeyAuthOptions(): Promise<PasskeyAuthOptions> {
  return request<PasskeyAuthOptions>("/passkeys/auth/options", { method: "POST" });
}
