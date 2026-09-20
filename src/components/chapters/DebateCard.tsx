"use client";

/**
 * Chapter 5 · The group chat — the month's most argued-about buy.
 *
 * Everything on this card is live. The server picks the winning item off the real comment rows,
 * the transcript underneath is that item's actual thread, and the composer at the bottom writes
 * through the same `/comments` endpoint the feed uses — so a comment typed here is on the item
 * tile on the home page when you close the Wrapped.
 */

import { useEffect, useMemo, useRef } from "react";

import { CommentComposer } from "@/components/comments/CommentComposer";
import { artForFind, findCommentTarget } from "@/components/commerce/findsStore";
import { Avatar } from "@/components/primitives/Avatar";
import { Grain } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { backendGroupId, users } from "@/data/users";
import { useGroupDebate } from "@/components/chapters/debateStore";
import { formatPrice } from "@/services/commerce";
import { useApp, type StoredComment } from "@/state/store";
import type { Debate } from "@/lib/apiTypes";
import type { UserId } from "@/lib/types";

const BG = "#BBA9E8";
const INK = "#141A47";
const CREAM = "#F5ECD9";

const FRAME: React.CSSProperties = {
  position: "absolute",
  left: 360,
  top: 70,
  width: 720,
  height: 900,
  borderRadius: 36,
  overflow: "hidden",
  boxShadow: "0 40px 90px rgba(0,0,0,0.5)",
  background: BG,
  color: INK,
};

export function DebateCard() {
  const state = useGroupDebate(backendGroupId);

  return (
    <div style={FRAME}>
      <Grain w={720} h={900} id="grainDebate" />
      {state.status === "ready" ? (
        <DebateBody debate={state.debate} />
      ) : (
        <Placeholder empty={state.status === "empty"} />
      )}
    </div>
  );
}

function Placeholder({ empty }: { empty: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        textAlign: "center",
        fontSize: 16,
        fontWeight: 600,
        opacity: 0.6,
      }}
    >
      {empty
        ? "Nothing in the group has been argued about yet. Go start something."
        : "Reading the group chat…"}
    </div>
  );
}

/* --------------------------------------------------------------------- body */

export interface DebateThread {
  /** Flattened into render order, replies under their parent. */
  rows: { comment: StoredComment; depth: number }[];
  count: number;
  send: (body: string) => Promise<void>;
}

/**
 * The live thread for the debated item. Reads through the app's normal comment store, so the
 * composer on this card and the one on the item tile are writing to the same place — and both
 * mobile and desktop share the wiring.
 */
export function useDebateThread(debate: Debate): DebateThread {
  const { commentsFor, commentCount, loadComments, postComment } = useApp();
  const target = useMemo(() => findCommentTarget(debate.itemId), [debate.itemId]);

  useEffect(() => {
    void loadComments(target);
  }, [loadComments, target]);

  const live = commentsFor(target);
  // The endpoint ships the thread with the verdict, so the transcript paints on the first frame
  // rather than flashing empty while `/comments` is still in the air.
  const source: StoredComment[] = live.length
    ? live
    : debate.thread.map((m) => ({
        id: m.id,
        parentId: m.parentId,
        authorId: m.userId,
        authorName: m.userName,
        body: m.body,
        createdAt: m.createdAt,
        mine: false,
      }));

  return {
    rows: threadOrder(source),
    count: live.length ? commentCount(target) : debate.commentCount,
    send: (body: string) => postComment(target, body),
  };
}

/** The owner's colour for an item, or cream when it was shared anonymously. */
export function debateOwner(debate: Debate): UserId | null {
  return isUserId(debate.ownerId) ? debate.ownerId : null;
}

function DebateBody({ debate }: { debate: Debate }) {
  const { rows, count, send } = useDebateThread(debate);
  const owner = debateOwner(debate);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: "34px 36px 26px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        Chapter 5 · The group chat
      </div>

      <h2
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 46,
          lineHeight: 0.98,
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        The most <em style={{ color: "#B8412F" }}>debated</em>
        <br />
        buy of the month
      </h2>

      {/* The item on trial. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 16,
          padding: 14,
          background: CREAM,
          border: `2px solid ${INK}`,
          borderRadius: 20,
          boxShadow: `5px 5px 0 ${INK}`,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            flexShrink: 0,
            borderRadius: 14,
            overflow: "hidden",
            border: `2px solid ${INK}`,
            background: owner ? users[owner].color : "#FBF6EA",
            padding: 6,
            boxSizing: "border-box",
          }}
        >
          <ProductArt
            kind={artForFind({ id: debate.itemId, category: debate.category })}
            src={debate.imageUrl ?? undefined}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 21,
              fontWeight: 800,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {debate.name}
          </div>
          <div style={{ marginTop: 3, fontSize: 14, fontWeight: 600, opacity: 0.66 }}>
            {[debate.merchant, owner ? `${users[owner].name}'s find` : "shared anonymously"]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        {debate.priceCents !== null && (
          <div style={{ fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
            {formatPrice(debate.priceCents)}
          </div>
        )}
      </div>

      {/* What makes it the winner, in numbers the server computed. */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Stat value={String(count)} label={count === 1 ? "message" : "messages"} bg="#F5E39B" />
        <Stat value={String(debate.participants.length)} label="arguing" bg="#A8DCC2" />
        <Stat
          value={String(Math.max(1, debate.spanDays))}
          label={debate.spanDays === 1 ? "day" : "days"}
          bg="#EBB5BD"
        />
      </div>

      {/* The AI's read on the argument. */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 10,
          padding: "12px 16px",
          background: INK,
          color: CREAM,
          borderRadius: 18,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 40,
            lineHeight: 0.8,
            color: "#F5E39B",
          }}
        >
          “
        </span>
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            The verdict
          </div>
          <div style={{ marginTop: 3, fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
            {debate.verdict}
          </div>
        </div>
      </div>

      <DebateTranscript rows={rows} />

      <CommentComposer
        onSend={send}
        label="Join the debate"
        placeholder="Weigh in…"
        compact
      />
    </div>
  );
}

function Stat({ value, label, bg }: { value: string; label: string; bg: string }) {
  return (
    // Read as one fact, not a loose number next to a loose word.
    <div
      aria-label={`${value} ${label}`}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: bg,
        border: `2px solid ${INK}`,
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- transcript */

/**
 * Oldest at the top, newest at the bottom, scrolled to the bottom on arrival — the shape everyone
 * already knows from a messaging app. Replies sit indented under the message they answer.
 */
export function DebateTranscript({
  rows,
  gap = 8,
  indent = 34,
}: {
  rows: DebateThread["rows"];
  gap?: number;
  indent?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const last = rows.length ? rows[rows.length - 1].comment.id : null;

  // Park at the newest message, and follow it down when the viewer posts — otherwise their own
  // comment lands below the fold and the card looks like it swallowed it.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  return (
    <div
      ref={scroller}
      style={{
        flex: 1,
        minHeight: 0,
        marginTop: 12,
        paddingRight: 4,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap,
        // Older messages dissolve into the ground instead of being sliced off mid-sentence.
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 22px)",
        maskImage: "linear-gradient(to bottom, transparent 0, #000 22px)",
      }}
    >
      {rows.map(({ comment, depth }) => (
        <DebateBubble key={comment.id} comment={comment} depth={depth} indent={indent} />
      ))}
    </div>
  );
}

export function DebateBubble({
  comment,
  depth,
  indent = 34,
}: {
  comment: StoredComment;
  depth: number;
  indent?: number;
}) {
  const who = isUserId(comment.authorId) ? comment.authorId : null;
  const mine = comment.mine;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        marginLeft: depth * indent + (mine ? 44 : 0),
        marginRight: mine ? 0 : 28,
        flexDirection: mine ? "row-reverse" : "row",
        opacity: comment.pending ? 0.6 : 1,
        transition: "opacity .2s",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${INK}`,
          background: who ? users[who].color : CREAM,
          boxSizing: "border-box",
        }}
      >
        {who && <Avatar who={who} />}
      </div>

      <div
        style={{
          maxWidth: "100%",
          padding: "8px 13px",
          borderRadius: 16,
          border: `2px solid ${INK}`,
          background: mine ? INK : CREAM,
          color: mine ? CREAM : INK,
          borderBottomRightRadius: mine ? 5 : 16,
          borderBottomLeftRadius: mine ? 16 : 5,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          {mine ? "You" : comment.authorName}
        </div>
        <div style={{ marginTop: 2, fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>
          {comment.body}
        </div>
      </div>
    </div>
  );
}

/**
 * Flattens the thread into render order: each top-level message followed by its replies. The
 * server sends one flat, oldest-first list, and a reply whose parent the viewer cannot see is
 * still shown — dropping it would silently lose half the argument.
 */
function threadOrder(thread: StoredComment[]): { comment: StoredComment; depth: number }[] {
  const byParent = new Map<string, StoredComment[]>();
  const ids = new Set(thread.map((c) => c.id));

  for (const comment of thread) {
    const key = comment.parentId && ids.has(comment.parentId) ? comment.parentId : "";
    const bucket = byParent.get(key);
    if (bucket) bucket.push(comment);
    else byParent.set(key, [comment]);
  }

  const out: { comment: StoredComment; depth: number }[] = [];
  const walk = (key: string, depth: number): void => {
    for (const comment of byParent.get(key) ?? []) {
      out.push({ comment, depth });
      walk(comment.id, Math.min(depth + 1, 2));
    }
  };
  walk("", 0);
  return out;
}

function isUserId(value: string | null): value is UserId {
  return value !== null && value in users;
}
