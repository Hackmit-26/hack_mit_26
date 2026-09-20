import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  API_BASE_URL,
  ApiError,
  createComment,
  deleteComment,
  listComments,
  setAuthToken,
  setViewer,
} from "@/lib/api";

const fetchMock = vi.fn<typeof fetch>();

function lastCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was never called");
  return { url: String(call[0]), init: call[1] ?? {} };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setViewer("user-uuid-1");
});

afterEach(() => {
  setAuthToken(null);
  vi.unstubAllGlobals();
});

describe("comments client", () => {
  it("puts the target in the query string", async () => {
    fetchMock.mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await expect(listComments("gift_thread", "t 1/2")).resolves.toEqual([]);
    expect(lastCall().url).toBe(
      `${API_BASE_URL}/comments?targetType=gift_thread&targetId=t+1%2F2`,
    );
  });

  it("carries groupId for a wrapped_card, which the server needs to authorise the read", async () => {
    fetchMock.mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await listComments("wrapped_card", "card-uuid", "group-uuid");
    expect(lastCall().url).toBe(
      `${API_BASE_URL}/comments?targetType=wrapped_card&targetId=card-uuid&groupId=group-uuid`,
    );
  });

  it("surfaces an invisible target as a 404 for the caller to swallow", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const error = await listComments("purchase", "i1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("sends the create body verbatim", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await createComment({ targetType: "product", targetId: "i1", parentId: "c1", body: "hi" });
    expect(lastCall().init.method).toBe("POST");
    expect(lastCall().init.body).toBe(
      '{"targetType":"product","targetId":"i1","parentId":"c1","body":"hi"}',
    );
  });

  it("deletes by id and resolves on the 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteComment("c/1")).resolves.toBeUndefined();
    expect(lastCall().url).toBe(`${API_BASE_URL}/comments/c%2F1`);
    expect(lastCall().init.method).toBe("DELETE");
  });
});
