import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommentDock } from "@/components/comments/CommentDock";
import { CommentComposer } from "@/components/comments/CommentComposer";
import { ApiError } from "@/lib/api";
import type { Comment } from "@/lib/apiTypes";
import {
  AppProvider,
  setCommentsApi,
  type CommentsApi,
  type CommentTarget,
} from "@/state/store";

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

function dock() {
  return render(
    <AppProvider>
      <CommentDock target={TARGET} placement="inline" />
    </AppProvider>,
  );
}

/** The panel is closed until someone asks for it. */
async function open() {
  dock();
  await waitFor(() => expect(screen.getByRole("button", { name: /Comments/ })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /Comments/ }));
  return screen.getByLabelText("Add a comment");
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

beforeEach(() => {
  window.sessionStorage.clear();
  setCommentsApi(fakeApi());
});

afterEach(cleanup);

describe("CommentDock", () => {
  it("counts the conversation on the chip and opens it", async () => {
    setCommentsApi(fakeApi({ list: async () => [serverComment(), serverComment({ id: "srv-2" })] }));
    dock();

    await waitFor(() => expect(screen.getByRole("button", { name: "Comments · 2" })).toBeTruthy());
    expect(screen.queryByLabelText("Add a comment")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Comments · 2" }));
    expect(screen.getAllByText("this is unhinged")).toHaveLength(2);
  });

  it("renders a 404 as an empty thread rather than an error", async () => {
    setCommentsApi(
      fakeApi({ list: () => Promise.reject(new ApiError("NOT_FOUND", "Not found", 404)) }),
    );
    await open();

    await waitFor(() => expect(screen.getByText(/no one has said anything yet/)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Comments" })).toBeTruthy();
  });

  it("posts on Enter and keeps Shift+Enter for a newline", async () => {
    const create = vi.fn(fakeApi().create);
    setCommentsApi(fakeApi({ create }));
    const field = await open();

    type(field, "not the third matcha");
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(create).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("not the third matcha")).toBeTruthy());
    expect(create).toHaveBeenCalledWith(TARGET, "not the third matcha", null);
    expect((field as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the comment visible when the server never answers", async () => {
    setCommentsApi(
      fakeApi({ create: () => Promise.reject(new ApiError("NETWORK_ERROR", "dead", 0)) }),
    );
    const field = await open();

    type(field, "this still counts");
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(screen.getByText(/couldn’t reach the server/)).toBeTruthy());
    expect(screen.getByText("this still counts")).toBeTruthy();
  });

  it("offers delete on the viewer's comment and on nobody else's", async () => {
    setCommentsApi(
      fakeApi({
        list: async () => [
          serverComment({ id: "hers", body: "sabina said this" }),
          serverComment({
            id: "mine",
            body: "kristina said this",
            authorId: VIEWER_UUID,
            authorName: "Kristina",
            createdAt: "2026-09-18T11:00:00.000Z",
          }),
        ],
      }),
    );
    await open();

    await waitFor(() => expect(screen.getByText("sabina said this")).toBeTruthy());
    const deletes = screen.getAllByRole("button", { name: /^Delete your comment/ });
    expect(deletes).toHaveLength(1);
    expect(deletes[0].getAttribute("aria-label")).toContain("kristina said this");

    fireEvent.click(deletes[0]);
    await waitFor(() => expect(screen.queryByText("kristina said this")).toBeNull());
    expect(screen.getByText("sabina said this")).toBeTruthy();
  });

  it("hangs a reply under the comment it answers", async () => {
    const create = vi.fn(fakeApi().create);
    setCommentsApi(fakeApi({ create, list: async () => [serverComment({ id: "root-1" })] }));
    await open();

    await waitFor(() => expect(screen.getByText("this is unhinged")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    const reply = screen.getByLabelText("Reply to Sabina");
    type(reply, "it really is");
    fireEvent.keyDown(reply, { key: "Enter" });

    await waitFor(() => expect(create).toHaveBeenCalledWith(TARGET, "it really is", "root-1"));
    await waitFor(() => expect(screen.getByText("it really is")).toBeTruthy());
    // Still one conversation, not two.
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(1);
  });

  it("shows the viewer's own name as You", async () => {
    setCommentsApi(
      fakeApi({
        list: async () => [
          serverComment({ id: "mine", authorId: VIEWER_UUID, authorName: "Kristina" }),
        ],
      }),
    );
    await open();

    await waitFor(() => expect(screen.getByText("You")).toBeTruthy());
    expect(screen.queryByText("Kristina")).toBeNull();
  });
});

describe("CommentComposer", () => {
  it("gives the sentence back when the send throws", async () => {
    const onSend = vi.fn(() => Promise.reject(new Error("boom")));
    render(
      <AppProvider>
        <CommentComposer onSend={onSend} />
      </AppProvider>,
    );

    const field = screen.getByLabelText("Add a comment");
    type(field, "do not lose this");
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect((field as HTMLTextAreaElement).value).toBe("do not lose this"),
    );
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("will not send whitespace", () => {
    const onSend = vi.fn(async () => undefined);
    render(
      <AppProvider>
        <CommentComposer onSend={onSend} />
      </AppProvider>,
    );

    const field = screen.getByLabelText("Add a comment");
    type(field, "   ");
    fireEvent.keyDown(field, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  });
});
