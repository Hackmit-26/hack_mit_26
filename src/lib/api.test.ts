import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addReaction,
  ApiError,
  API_BASE_URL,
  approveMyContribution,
  createThread,
  duplicateThreadId,
  getGroup,
  getThread,
  health,
  listGroupFinds,
  removeReaction,
  setAuthToken,
  setViewer,
  updateItemVisibility,
  waitForPicks,
} from "@/lib/api";
import type { Group } from "@/lib/apiTypes";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A Response body may only be read once, so hand out a fresh one per call. */
function respondWith(body: unknown, status = 200): void {
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(body, status)));
}

function lastCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was never called");
  return { url: String(call[0]), init: call[1] ?? {} };
}

function headerValue(name: string): string | undefined {
  const headers = lastCall().init.headers as Record<string, string> | undefined;
  return headers?.[name];
}

const GROUP: Group = {
  id: "g1",
  name: "Roommates",
  emoji: "🏠",
  inviteCode: "ABC123",
  members: [{ id: "u1", name: "Kristina", avatarUrl: null, hasBirthday: true }],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setViewer("user-uuid-1");
});

afterEach(() => {
  setAuthToken(null);
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("decodes a JSON success body and builds an absolute URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(GROUP));

    await expect(getGroup("g1")).resolves.toEqual(GROUP);
    expect(lastCall().url).toBe(`${API_BASE_URL}/groups/g1`);
    expect(lastCall().init.method).toBe("GET");
  });

  it("percent-encodes path segments", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listGroupFinds("a/b c");
    expect(lastCall().url).toBe(`${API_BASE_URL}/groups/a%2Fb%20c/finds`);
  });

  it("sends the bearer token from the runtime viewer override", async () => {
    respondWith(GROUP);

    await getGroup("g1");
    expect(headerValue("Authorization")).toBe("Bearer dev:user-uuid-1");

    setViewer("user-uuid-2");
    await getGroup("g1");
    expect(headerValue("Authorization")).toBe("Bearer dev:user-uuid-2");
  });

  it("omits the Authorization header when no viewer is set", async () => {
    setAuthToken(null);
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, visaMode: "mock", llmMode: "mock" }));

    await health();
    expect(headerValue("Authorization")).toBeUndefined();
  });

  it("JSON-encodes bodies and sets Content-Type only when there is one", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await addReaction({ itemId: "i1", type: "heart" });
    expect(lastCall().init.method).toBe("POST");
    expect(lastCall().init.body).toBe('{"itemId":"i1","type":"heart"}');
    expect(headerValue("Content-Type")).toBe("application/json");

    fetchMock.mockResolvedValue(jsonResponse(GROUP));
    await getGroup("g1");
    expect(lastCall().init.body).toBeUndefined();
    expect(headerValue("Content-Type")).toBeUndefined();
  });

  it("resolves to undefined on a 204 with an empty body", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(addReaction({ itemId: "i1", type: "heart" })).resolves.toBeUndefined();
    await expect(removeReaction({ itemId: "i1", type: "heart" })).resolves.toBeUndefined();
    expect(lastCall().init.method).toBe("DELETE");
  });

  it("parses the error envelope into an ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "NOT_MEMBER", message: "Not a member of this group" } }, 403),
    );

    const error = await getGroup("g1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "NOT_MEMBER",
      status: 403,
      message: "Not a member of this group",
    });
  });

  it("surfaces NOT_ENOUGH_DATA and INVALID_STATE codes verbatim", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "NOT_ENOUGH_DATA", message: "Nothing shared yet" } }, 422),
    );
    await expect(getThread("t1")).rejects.toMatchObject({ code: "NOT_ENOUGH_DATA", status: 422 });

    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "INVALID_STATE", message: "Wrong state" } }, 409),
    );
    await expect(approveMyContribution("t1")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("falls back gracefully when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );

    const error = await getGroup("g1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "HTTP_502", status: 502 });
    expect((error as ApiError).message).toContain("Bad Gateway");
  });

  it("falls back when the error body is empty", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(updateItemVisibility("i1", { visibility: "shared" })).rejects.toMatchObject({
      code: "HTTP_500",
      status: 500,
      body: null,
    });
  });

  it("maps a thrown fetch into a NETWORK_ERROR ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await getGroup("g1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("rejects a non-JSON 200 rather than returning a string", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(getGroup("g1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("duplicateThreadId", () => {
  it("extracts the existing thread id from the 409 envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: { code: "INVALID_STATE", message: "A gift thread already exists" },
          threadId: "t-existing",
        },
        409,
      ),
    );

    const error = await createThread({
      groupId: "g1",
      recipientId: "u2",
      budgetMinCents: 1000,
      budgetMaxCents: 5000,
    }).catch((e: unknown) => e);

    expect(duplicateThreadId(error)).toBe("t-existing");
  });

  it("returns null for anything else", () => {
    expect(duplicateThreadId(new Error("nope"))).toBeNull();
    expect(duplicateThreadId(new ApiError("NOT_FOUND", "gone", 404))).toBeNull();
  });
});

describe("waitForPicks", () => {
  it("polls until the thread leaves `picking`", async () => {
    const states = ["picking", "picking", "voting"];
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ id: "t1", state: states.shift() ?? "voting", picks: [] })),
    );

    const thread = await waitForPicks("t1", { intervalMs: 0 });

    expect(thread.state).toBe("voting");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up on the last thread it read once the deadline passes", async () => {
    respondWith({ id: "t1", state: "picking", picks: [] });

    const thread = await waitForPicks("t1", { intervalMs: 0, timeoutMs: 0 });

    expect(thread.state).toBe("picking");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when the caller aborts", async () => {
    respondWith({ id: "t1", state: "picking", picks: [] });
    const controller = new AbortController();
    const pending = waitForPicks("t1", { intervalMs: 50, signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow(ApiError);
  });
});
