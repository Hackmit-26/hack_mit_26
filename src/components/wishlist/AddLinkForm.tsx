"use client";

import { useState, type FormEvent } from "react";

import { PaperCard, SectionLabel } from "@/components/layout/PageShell";
import { useApp } from "@/state/store";

/** Cents from whatever the person typed: "38", "$38", "38.00" all work. */
function centsFrom(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return undefined;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100);
}

function looksLikeLink(raw: string): boolean {
  const value = raw.trim();
  if (/\s/.test(value)) return false;
  return /^(https?:\/\/)?[^.]+\.[^.]{2,}/.test(value);
}

/**
 * Paste-a-link. The page is scraped best-effort on the server, which takes a
 * beat, so the button says what it is doing and the row appears immediately.
 */
export function AddLinkForm() {
  const { addWishlistLink } = useApp();
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (reading) return;
    if (!looksLikeLink(url)) {
      setError("That needs to be a link — a domain at minimum.");
      return;
    }
    setError(null);
    setReading(true);
    const pending = url;
    setUrl("");
    setPrice("");
    await addWishlistLink(pending, centsFrom(price));
    setReading(false);
  }

  return (
    <PaperCard>
      <SectionLabel style={{ color: "#C4553F" }}>Add by link</SectionLabel>
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 30,
          lineHeight: 1.05,
          marginTop: 6,
        }}
      >
        Anything with a URL counts.
      </div>
      <p style={{ fontSize: 15.5, lineHeight: 1.4, marginTop: 6, maxWidth: 560 }}>
        We read the page for a title, a photo and a price. If the shop blocks us,
        the link lands on your list anyway.
      </p>

      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          gap: 10,
          marginTop: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Product link"
          placeholder="https://"
          style={{
            flex: "3 1 280px",
            minWidth: 0,
            height: 54,
            padding: "0 18px",
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: 999,
            background: "#FBF6EA",
            color: "#141A47",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 600,
          }}
        />
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label="Price, if you know it"
          placeholder="Price, optional"
          style={{
            flex: "1 1 140px",
            minWidth: 0,
            height: 54,
            padding: "0 18px",
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: 999,
            background: "#FBF6EA",
            color: "#141A47",
            fontFamily: "inherit",
            fontSize: 16,
            fontWeight: 600,
          }}
        />
        <button
          type="submit"
          disabled={reading}
          style={{
            height: 54,
            padding: "0 26px",
            boxSizing: "border-box",
            border: 0,
            borderRadius: 999,
            background: "#141A47",
            color: "#F5ECD9",
            fontSize: 16,
            fontWeight: 700,
            boxShadow: reading ? "none" : "4px 4px 0 #B8412F",
            opacity: reading ? 0.72 : 1,
            cursor: reading ? "progress" : "pointer",
            transition: "opacity .2s, box-shadow .2s",
          }}
        >
          {reading ? "Reading the page…" : "Add to list"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            fontFamily: "var(--font-hand), cursive",
            fontSize: 22,
            color: "#B8412F",
            marginTop: 10,
            transform: "rotate(-1deg)",
          }}
        >
          {error}
        </div>
      )}
    </PaperCard>
  );
}
