import { cleanup, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { groupIntoThreads } from "@/components/comments/CommentThread";
import { ApiError } from "@/lib/api";
import type { Comment } from "@/lib/apiTypes";
import { backendGroupId } from "@/data/users";
import {
  AppProvider,
  cardTarget,
  setCommentsApi,
  useApp,
  type CommentsApi,
  type CommentTarget,
} from "@/state/store";

// We drive the store through React's own act(), outside render().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEWER_UUID = "uuid-kristina";
const TARGET: CommentTarget = { targetType: "purchase", targetId: "p-esh-1" };

function serverComment(over: Partial<Comment> = {}): Comment {
  return {
    id: "srv-1",
    targetType: "purchase",
    targetId: "p-esh-1",
    parentId: null,
    authorId: "uuid-sabina",
    authorName: "Sabina",
    body: "this is unhinged",
    createdAt: "2026-09-18T10:00:00.000Z",
    editedAt: null,
    ...over,
  };
}

function fakeApi(over: Partial<CommentsApi> = {}): CommentsApi {
  return {
    list: async () => [],
    create: async (_target, body, parentId) =>
      serverComment({
        id: `srv-${body.length}`,
        body,
        parentId,
        authorId: VIEWER_UUID,
        authorName: "Kristina",
        createdAt: "2026-09-19T10:00:00.000Z",
      }),
    remove: async () => undefined,
    viewerId: () => VIEWER_UUID,
    ...over,
  };
}

let api: ReturnType<typeof useApp>;

function Probe() {
  api = useApp();
  return null;
}

function mount() {
  return render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  setCommentsApi(fakeApi());
});

afterEach(cleanup);

describe("comments store", () => {
  it("shows a comment before the server has answered it", async () => {
    let release!: (value: Comment) => void;
    setCommentsApi(fakeApi({ create: () => new Promise<Comment>((r) => (release = r)) }));
    mount();

    let posting!: Promise<void>;
    await act(async () => {
      posting = api.postComment(TARGET, "  the matcha again  ");
    });

    expect(api.commentCount(TARGET)).toBe(1);
    expect(api.commentsFor(TARGET)[0]).toMatchObject({
      body: "the matcha again",
      authorName: "Kristina",
      mine: true,
      pending: true,
    });

    await act(async () => {
      release(serverComment({ id: "srv-9", body: "the matcha again", authorId: VIEWER_UUID }));
      await posting;
    });

    expect(api.commentsFor(TARGET)[0]).toMatchObject({
      id: "srv-9",
      pending: false,
      note: undefined,
      mine: true,
    });
  });

  it("ignores an empty body without calling the seam", async () => {
    const create = vi.fn(async () => serverComment());
    setCommentsApi(fakeApi({ create }));
    mount();

    await act(async () => {
      await api.postComment(TARGET, "   \n  ");
    });

    expect(create).not.toHaveBeenCalled();
    expect(api.commentCount(TARGET)).toBe(0);
  });

  it("attaches a reply to its parent", async () => {
    setCommentsApi(
      fakeApi({ list: async () => [serverComment({ id: "root-1", body: "who let her" })] }),
    );
    mount();

    await act(async () => {
      await api.loadComments(TARGET);
    });
    await act(async () => {
      await api.postComment(TARGET, "she let herself", "root-1");
    });

    const threads = groupIntoThreads(api.commentsFor(TARGET));
    expect(threads).toHaveLength(1);
    expect(threads[0].comment.id).toBe("root-1");
    expect(threads[0].replies.map((r) => r.body)).toEqual(["she let herself"]);
  });

  it("flattens a reply to a reply onto the top-level comment", () => {
    const items = groupIntoThreads([
      {
        id: "a",
        parentId: null,
        authorId: "x",
        authorName: "Esh",
        body: "root",
        createdAt: "1",
        mine: false,
      },
      {
        id: "b",
        parentId: "a",
        authorId: "x",
        authorName: "Esh",
        body: "reply",
        createdAt: "2",
        mine: false,
      },
      {
        id: "c",
        parentId: "b",
        authorId: "x",
        authorName: "Esh",
        body: "reply to the reply",
        createdAt: "3",
        mine: false,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].replies.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("treats a 404 as an empty thread, not an error", async () => {
    setCommentsApi(
      fakeApi({
        list: () => Promise.reject(new ApiError("NOT_FOUND", "Item not found", 404)),
      }),
    );
    mount();

    await act(async () => {
      await api.loadComments(TARGET);
    });

    expect(api.commentsFor(TARGET)).toEqual([]);
    expect(api.commentsStatus(TARGET)).toBe("ready");
  });

  it("keeps the comment when the backend is unreachable", async () => {
    setCommentsApi(
      fakeApi({
        create: () => Promise.reject(new ApiError("NETWORK_ERROR", "fetch failed", 0)),
        list: () => Promise.reject(new ApiError("NETWORK_ERROR", "fetch failed", 0)),
      }),
    );
    mount();

    await act(async () => {
      await api.postComment(TARGET, "still counts");
    });

    expect(api.commentsFor(TARGET)[0]).toMatchObject({
      body: "still counts",
      pending: false,
      mine: true,
    });
    expect(api.commentsFor(TARGET)[0].note).toContain("couldn’t reach the server");

    // And a later refresh must not quietly drop it.
    await act(async () => {
      await api.loadComments(TARGET);
    });
    expect(api.commentCount(TARGET)).toBe(1);
  });

  it("marks only the token's own comments as the viewer's", async () => {
    setCommentsApi(
      fakeApi({
        list: async () => [
          serverComment({ id: "a", authorId: "uuid-sabina", authorName: "Sabina" }),
          serverComment({ id: "b", authorId: VIEWER_UUID, authorName: "Kristina" }),
        ],
      }),
    );
    mount();

    await act(async () => {
      await api.loadComments(TARGET);
    });

    expect(api.commentsFor(TARGET).map((c) => c.mine)).toEqual([false, true]);
  });

  it("deletes through the seam and leaves the replies standing", async () => {
    const remove = vi.fn(async () => undefined);
    setCommentsApi(
      fakeApi({
        remove,
        list: async () => [
          serverComment({ id: "root-1", authorId: VIEWER_UUID, authorName: "Kristina" }),
          serverComment({ id: "reply-1", parentId: "root-1", createdAt: "2026-09-18T11:00:00.000Z" }),
        ],
      }),
    );
    mount();

    await act(async () => {
      await api.loadComments(TARGET);
    });
    await act(async () => {
      await api.deleteComment(TARGET, "root-1");
    });

    expect(remove).toHaveBeenCalledWith("root-1");
    expect(api.commentsFor(TARGET).map((c) => c.id)).toEqual(["reply-1"]);
  });

  it("does not ask the server to delete a comment that never reached it", async () => {
    const remove = vi.fn(async () => undefined);
    setCommentsApi(
      fakeApi({
        remove,
        create: () => Promise.reject(new ApiError("NETWORK_ERROR", "fetch failed", 0)),
      }),
    );
    mount();

    await act(async () => {
      await api.postComment(TARGET, "oops");
    });
    const [only] = api.commentsFor(TARGET);
    await act(async () => {
      await api.deleteComment(TARGET, only.id);
    });

    expect(remove).not.toHaveBeenCalled();
    expect(api.commentCount(TARGET)).toBe(0);
  });

  it("keeps threads apart by target", async () => {
    mount();
    const other: CommentTarget = { targetType: "product", targetId: "card-taste" };

    await act(async () => {
      await api.postComment(TARGET, "on the purchase");
    });

    expect(api.commentCount(TARGET)).toBe(1);
    expect(api.commentCount(other)).toBe(0);
  });
});

describe("cardTarget", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

  it("folds a client-side card key into a uuid the server's uuid column accepts", () => {
    expect(cardTarget("spot-esh").targetId).toMatch(UUID);
  });

  it("is stable across calls, so the same card reads the same thread on every device", () => {
    expect(cardTarget("lore-corduroy").targetId).toBe(cardTarget("lore-corduroy").targetId);
  });

  it("separates cards that differ by a single character", () => {
    expect(cardTarget("spot-esh").targetId).not.toBe(cardTarget("spot-ash").targetId);
  });

  it("carries the group, which is what authorises a wrapped_card comment", () => {
    const target = cardTarget("card-taste");
    expect(target.targetType).toBe("wrapped_card");
    expect(target.groupId).toBe(backendGroupId);
  });
});
