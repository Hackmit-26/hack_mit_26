"use client";

import Link from "next/link";

import { Avatar } from "@/components/primitives/Avatar";
import { Lock } from "@/components/primitives/Glyphs";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { PageShell, PaperCard, SectionLabel } from "@/components/layout/PageShell";
import { purchasesFor } from "@/data/purchases";
import { viewer } from "@/data/users";
import { wrappedCards } from "@/data/wrapped";
import { getChapter } from "@/data/chapters";
import { formatPrice, searchUrl } from "@/services/commerce";
import { useApp } from "@/state/store";
import type { SharingState } from "@/lib/types";

const CATEGORIES = [
  "Health",
  "Pharmacy",
  "Beauty",
  "Skincare",
  "Food & drink",
  "Clothing",
  "Tech",
];

const SHARING_OPTIONS: { value: SharingState; label: string }[] = [
  { value: "shared", label: "Share" },
  { value: "anonymous", label: "Anonymous" },
  { value: "hidden", label: "Hide" },
];

/**
 * Privacy and consent, shown rather than described: per-item sharing,
 * amounts off by default, excluded categories, and a veto before publishing.
 */
export default function SettingsPage() {
  const {
    privacy,
    setSharing,
    toggleAmounts,
    toggleCategory,
    toggleVeto,
    isVetoed,
    resetDemo,
  } = useApp();

  const mine = purchasesFor(viewer.id);
  const sharedCount = mine.filter(
    (p) => (privacy.sharing[p.id] ?? p.sharing) === "shared",
  ).length;

  return (
    <PageShell>
      <SectionLabel>Privacy and consent</SectionLabel>
      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(40px, 5.4vw, 66px)",
          lineHeight: 0.94,
          letterSpacing: "-0.03em",
          margin: "10px 0 0",
          fontWeight: 400,
          maxWidth: 760,
        }}
      >
        Nothing is shared by default. <em style={{ color: "#EBB5BD" }}>You choose.</em>
      </h1>
      <div
        style={{
          fontFamily: "var(--font-hand), cursive",
          fontSize: 26,
          color: "#F5E39B",
          marginTop: 14,
          transform: "rotate(-1deg)",
        }}
      >
        {sharedCount} of your {mine.length} September items are visible to the group.
      </div>

      {/* amounts */}
      <div style={{ marginTop: 30, display: "grid", gap: 18 }}>
        <PaperCard>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 560 }}>
              <SectionLabel style={{ color: "#C4553F" }}>Amounts</SectionLabel>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 30,
                  lineHeight: 1.05,
                  marginTop: 6,
                }}
              >
                Prices never appear in the Wrapped unless you turn them on.
              </div>
              <p style={{ fontSize: 15.5, lineHeight: 1.4, marginTop: 6 }}>
                No card ever ranks who spent the most.
              </p>
            </div>
            <Toggle on={privacy.showAmounts} onChange={toggleAmounts} label="Show my amounts" />
          </div>
        </PaperCard>

        {/* excluded categories */}
        <PaperCard>
          <SectionLabel style={{ color: "#C4553F" }}>Excluded categories</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 30,
              lineHeight: 1.05,
              marginTop: 6,
            }}
          >
            Never ingested, never parsed.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {CATEGORIES.map((c) => {
              const excluded = privacy.excludedCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  aria-pressed={excluded}
                  style={{
                    height: 44,
                    padding: "0 18px",
                    boxSizing: "border-box",
                    border: "2px solid #141A47",
                    borderRadius: 999,
                    background: excluded ? "#141A47" : "#FBF6EA",
                    color: excluded ? "#F5ECD9" : "#141A47",
                    fontSize: 15,
                    fontWeight: 700,
                    transition: "background .2s, color .2s",
                  }}
                >
                  {excluded ? "✓ " : ""}
                  {c}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.4, marginTop: 12, opacity: 0.8 }}>
            Excluded items never reach the Wrapped generator at all.
          </p>
        </PaperCard>

        {/* per-item sharing */}
        <PaperCard>
          <SectionLabel style={{ color: "#C4553F" }}>Per-item sharing</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 30,
              lineHeight: 1.05,
              marginTop: 6,
            }}
          >
            Share, hide, or share anonymously.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {mine.slice(0, 8).map((p) => {
              const state = privacy.sharing[p.id] ?? p.sharing;
              const excluded = privacy.excludedCategories.includes(p.category);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 12,
                    border: "2px solid #141A47",
                    borderRadius: 20,
                    background:
                      state === "shared"
                        ? "#A8DCC2"
                        : state === "anonymous"
                          ? "#F5E39B"
                          : "#FBF6EA",
                    opacity: excluded ? 0.45 : 1,
                    transition: "background .25s, opacity .25s",
                    flexWrap: "wrap",
                  }}
                >
                  <ItemLink
                    url={searchUrl(p.item, p.merchant)}
                    label={`${p.item} at ${p.merchant}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      flex: "1 1 220px",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        flexShrink: 0,
                        border: "2px solid #141A47",
                        borderRadius: 14,
                        background: "#F5ECD9",
                        padding: 5,
                        boxSizing: "border-box",
                      }}
                    >
                      <ProductArt kind={p.art} src={p.image} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                        {p.item}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.78 }}>
                        <span style={{ textDecoration: "underline" }}>{p.merchant}</span> ·{" "}
                        {p.category}
                        {privacy.showAmounts && ` · ${formatPrice(p.amountCents)}`}
                        {excluded && " · excluded category"}
                      </div>
                    </div>
                  </ItemLink>
                  <div style={{ display: "flex", gap: 6 }}>
                    {SHARING_OPTIONS.map((o) => {
                      const on = state === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setSharing(p.id, o.value)}
                          aria-pressed={on}
                          disabled={excluded}
                          style={{
                            height: 40,
                            padding: "0 14px",
                            boxSizing: "border-box",
                            border: "2px solid #141A47",
                            borderRadius: 999,
                            background: on ? "#141A47" : "transparent",
                            color: on ? "#F5ECD9" : "#141A47",
                            fontSize: 13.5,
                            fontWeight: 700,
                            transition: "background .2s, color .2s",
                          }}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.4, marginTop: 12, opacity: 0.8 }}>
            Anonymous items appear as “someone in the group bought…”. Hidden items never
            leave your account.
          </p>
        </PaperCard>

        {/* veto */}
        <PaperCard bg="#EBB5BD">
          <SectionLabel style={{ color: "#B8412F" }}>Veto before publishing</SectionLabel>
          <div
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 30,
              lineHeight: 1.05,
              marginTop: 6,
            }}
          >
            Preview the cards about you. Remove one before the group sees it.
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            {wrappedCards.map((card) => {
              const chapter = getChapter(card.chapter);
              const vetoed = isVetoed(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleVeto(card.id)}
                  aria-pressed={vetoed}
                  style={{
                    flex: "1 1 180px",
                    minHeight: 90,
                    padding: "12px 16px",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    textAlign: "left",
                    border: "2px solid #141A47",
                    borderRadius: 18,
                    background: vetoed ? "transparent" : chapter.bg,
                    color: vetoed ? "#141A47" : chapter.fg,
                    boxShadow: vetoed ? "none" : "4px 4px 0 #141A47",
                    opacity: vetoed ? 0.55 : 1,
                    textDecoration: vetoed ? "line-through" : "none",
                    transition: "background .2s, opacity .2s, box-shadow .2s",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      opacity: 0.85,
                    }}
                  >
                    {vetoed ? "Removed" : "In the story"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display), Georgia, serif",
                      fontSize: 24,
                      lineHeight: 1.05,
                    }}
                  >
                    {chapter.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.4, marginTop: 12 }}>
            Removed chapters disappear from the Wrapped immediately — open it and see.
          </p>
        </PaperCard>

        {/* payments */}
        <PaperCard>
          <SectionLabel style={{ color: "#C4553F" }}>Payments</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
            <div
              style={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: "50%",
                border: "2px solid #141A47",
                background: "#BBA9E8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={26} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                We never store card numbers.
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.4, opacity: 0.85 }}>
                Agent tokens and a passkey approval handle every purchase. The agent can’t
                spend more, or anywhere else, than you confirm.
              </div>
            </div>
          </div>
        </PaperCard>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 32,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/wrapped"
          scroll={false}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 56,
            padding: "0 26px",
            boxSizing: "border-box",
            borderRadius: 999,
            background: "#F5ECD9",
            color: "#141A47",
            fontSize: 16,
            fontWeight: 700,
            boxShadow: "4px 4px 0 #E8806F",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #141A47",
            }}
          >
            <Avatar who={viewer.id} />
          </span>
          See how the Wrapped changes
        </Link>
        <button
          type="button"
          onClick={resetDemo}
          style={{
            height: 56,
            padding: "0 22px",
            border: "2px solid rgba(245,236,217,0.4)",
            borderRadius: 999,
            background: "transparent",
            color: "rgba(245,236,217,0.8)",
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Reset the demo
        </button>
      </div>
    </PageShell>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={on}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 52,
        padding: "0 10px 0 20px",
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 999,
        background: on ? "#141A47" : "#FBF6EA",
        color: on ? "#F5ECD9" : "#141A47",
        fontSize: 14.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        transition: "background .25s, color .25s",
      }}
    >
      {label}
      <span
        style={{
          display: "block",
          position: "relative",
          width: 52,
          height: 30,
          borderRadius: 15,
          background: on ? "#E8806F" : "rgba(20,26,71,0.2)",
          transition: "background .25s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: on ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#F5ECD9",
            border: "2px solid #141A47",
            boxSizing: "border-box",
            transition: "left .25s cubic-bezier(.2,.8,.3,1)",
          }}
        />
      </span>
    </button>
  );
}
