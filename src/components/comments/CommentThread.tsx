"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { CommentComposer } from "@/components/comments/CommentComposer";
import { Avatar } from "@/components/primitives/Avatar";
import { userList } from "@/data/users";
import type { UserId } from "@/lib/types";
import { useApp, type CommentTarget, type StoredComment } from "@/state/store";

export interface CommentNode {
  comment: StoredComment;
  replies: StoredComment[];
}

/**
 * The backend allows arbitrary nesting; this UI shows exactly two levels. Every
 * comment is walked up to its top-level ancestor and hung there, so a reply to a
 * reply lands in the same conversation instead of starting a staircase. A comment
 * whose parent was deleted has no ancestor left and becomes a root of its own.
 */
export function groupIntoThreads(items: StoredComment[]): CommentNode[] {
  const byId = new Map(items.map((c) => [c.id, c]));

  function rootIdOf(comment: StoredComment): string {
    let current = comment;
    const seen = new Set<string>([current.id]);
    while (current.parentId !== null) {
      const parent = byId.get(current.parentId);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      current = parent;
    }
    return current.id;
  }

  const roots: CommentNode[] = [];
  const byRoot = new Map<string, CommentNode>();

  for (const comment of items) {
    if (rootIdOf(comment) !== comment.id) continue;
    const node: CommentNode = { comment, replies: [] };
    roots.push(node);
    byRoot.set(comment.id, node);
  }
  for (const comment of items) {
    if (byRoot.has(comment.id)) continue;
    byRoot.get(rootIdOf(comment))?.replies.push(comment);
  }
  return roots;
}

/** The four personas are the only people in this demo; anyone else gets an initial. */
function personaFor(name: string): UserId | null {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return userList.find((u) => u.name.toLowerCase() === first)?.id ?? null;
}

function sinceLabel(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "just now";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Portrait({ name, size }: { name: string; size: number }) {
  const who = personaFor(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        border: "2px solid #141A47",
        boxSizing: "border-box",
        background: "#EBB5BD",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 700,
        color: "#141A47",
      }}
    >
      {who ? <Avatar who={who} /> : (name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

function Bubble({
  comment,
  onReply,
  onDelete,
  compact,
}: {
  comment: StoredComment;
  onReply?: () => void;
  onDelete: () => void;
  compact: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
    >
      <Portrait name={comment.authorName} size={compact ? 26 : 30} />

      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        <div
          style={{
            padding: compact ? "7px 11px" : "8px 13px",
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: 16,
            borderTopLeftRadius: 5,
            background: comment.mine ? "#F5E39B" : "#FBF6EA",
            color: "#141A47",
            opacity: comment.pending ? 0.6 : 1,
            transition: "opacity .3s",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 700 }}>
              {comment.mine ? "You" : comment.authorName}
            </span>
            <span
              style={{
                fontFamily: "var(--font-hand), cursive",
                fontSize: compact ? 14 : 15.5,
                opacity: 0.7,
              }}
            >
              {comment.pending ? "sending…" : sinceLabel(comment.createdAt)}
            </span>
          </div>
          <div
            style={{
              fontSize: compact ? 13.5 : 14.5,
              lineHeight: 1.38,
              marginTop: 1,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {comment.body}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
          {onReply && !comment.pending && (
            <button type="button" onClick={onReply} style={linkButton}>
              Reply
            </button>
          )}
          {/* Author-only: a 403 is never reachable from here. */}
          {comment.mine && !comment.pending && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete your comment: ${comment.body}`}
              style={{ ...linkButton, color: "#B8412F" }}
            >
              Delete
            </button>
          )}
          {comment.note && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#B8412F" }}>
              {comment.note}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const linkButton: React.CSSProperties = {
  border: 0,
  background: "none",
  padding: 0,
  color: "#141A47",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textDecoration: "underline",
  cursor: "pointer",
};

/**
 * The conversation on one card or tile. Empty is a real state: a 404 from the
 * server means the viewer cannot see this target, which for the recipient of a
 * gift thread is the correct answer, so it reads as "nothing here yet".
 */
export function CommentThread({
  target,
  compact = false,
}: {
  target: CommentTarget;
  compact?: boolean;
}) {
  const { commentsFor, commentsStatus, postComment, deleteComment } = useApp();
  const items = commentsFor(target);
  const status = commentsStatus(target);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const threads = useMemo(() => groupIntoThreads(items), [items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingRight: 2,
        }}
      >
        {threads.length === 0 && (
          <div
            style={{
              fontFamily: "var(--font-hand), cursive",
              fontSize: compact ? 19 : 22,
              color: "#141A47",
              opacity: 0.65,
              padding: "6px 2px",
            }}
          >
            {status === "loading"
              ? "reading the thread…"
              : "no one has said anything yet. go first."}
          </div>
        )}

        <AnimatePresence initial={false}>
          {threads.map(({ comment, replies }) => (
            <motion.div key={comment.id} exit={{ opacity: 0 }} layout="position">
              <Bubble
                comment={comment}
                compact={compact}
                onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                onDelete={() => void deleteComment(target, comment.id)}
              />

              {(replies.length > 0 || replyTo === comment.id) && (
                <div
                  style={{
                    marginLeft: compact ? 16 : 19,
                    marginTop: 8,
                    paddingLeft: compact ? 12 : 15,
                    borderLeft: "2px solid rgba(20,26,71,0.25)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  {replies.map((reply) => (
                    <Bubble
                      key={reply.id}
                      comment={reply}
                      compact={compact}
                      onDelete={() => void deleteComment(target, reply.id)}
                    />
                  ))}

                  {replyTo === comment.id && (
                    <CommentComposer
                      compact
                      autoFocus
                      label={`Reply to ${comment.mine ? "your comment" : comment.authorName}`}
                      placeholder={`Reply to ${comment.mine ? "yourself" : comment.authorName}…`}
                      onSend={async (body) => {
                        // Always the top-level id: this UI is one level deep.
                        await postComment(target, body, comment.id);
                        setReplyTo(null);
                      }}
                    />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <CommentComposer
        compact={compact}
        onSend={(body) => postComment(target, body)}
        placeholder="Say something…"
      />
    </div>
  );
}
