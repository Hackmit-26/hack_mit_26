"use client";

import { useState, type KeyboardEvent } from "react";

import { Avatar } from "@/components/primitives/Avatar";
import { useApp } from "@/state/store";

/**
 * One textarea. Enter sends, Shift+Enter is a newline, and the draft is put
 * back if the send ever throws — nobody retypes a sentence because the wifi
 * went. Grows to three lines then scrolls.
 */
export function CommentComposer({
  onSend,
  placeholder = "Say something…",
  label = "Add a comment",
  autoFocus = false,
  compact = false,
}: {
  onSend: (body: string) => Promise<void>;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const { viewerId } = useApp();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const ready = draft.trim().length > 0 && !sending;

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      await onSend(text);
    } catch {
      // The store never throws, but a seam might. Give the sentence back.
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send();
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 10 }}>
      <div
        style={{
          width: compact ? 26 : 30,
          height: compact ? 26 : 30,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #141A47",
          boxSizing: "border-box",
        }}
      >
        <Avatar who={viewerId} />
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={label}
        placeholder={placeholder}
        rows={1}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          minHeight: compact ? 34 : 38,
          maxHeight: 96,
          padding: compact ? "7px 12px" : "8px 14px",
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 18,
          background: "#FBF6EA",
          color: "#141A47",
          fontFamily: "var(--font-body), inherit",
          fontSize: compact ? 13.5 : 14.5,
          lineHeight: 1.35,
          fontWeight: 500,
          resize: "none",
        }}
      />

      <button
        type="button"
        onClick={() => void send()}
        disabled={!ready}
        style={{
          height: compact ? 34 : 38,
          padding: compact ? "0 14px" : "0 18px",
          flexShrink: 0,
          boxSizing: "border-box",
          border: 0,
          borderRadius: 999,
          background: "#141A47",
          color: "#F5ECD9",
          fontSize: compact ? 13 : 14,
          fontWeight: 700,
          boxShadow: ready ? "3px 3px 0 #B8412F" : "none",
          opacity: ready ? 1 : 0.45,
          cursor: ready ? "pointer" : "default",
          transition: "opacity .2s, box-shadow .2s",
        }}
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
