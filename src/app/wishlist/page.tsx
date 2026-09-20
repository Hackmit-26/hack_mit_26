"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PageShell, SectionLabel } from "@/components/layout/PageShell";
import { ArrowRight, Lock } from "@/components/primitives/Glyphs";
import { AddLinkForm } from "@/components/wishlist/AddLinkForm";
import { WishlistGrid } from "@/components/wishlist/WishlistGrid";
import { group } from "@/data/users";
import { useApp } from "@/state/store";

/**
 * The wishlist: the one input the group can't infer. Everything here outranks
 * what the gift picker guesses from behaviour, so it earns its own screen.
 */
export default function WishlistPage() {
  const { wishlist, refreshWishlist } = useApp();

  useEffect(() => {
    void refreshWishlist();
  }, [refreshWishlist]);

  const count = wishlist.length;

  return (
    <PageShell>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <SectionLabel>Your list · {group.name}</SectionLabel>
          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(40px, 5.4vw, 70px)",
              lineHeight: 0.94,
              letterSpacing: "-0.03em",
              margin: "10px 0 0",
              fontWeight: 400,
              maxWidth: 760,
            }}
          >
            Stop being guessed at. <em style={{ color: "#EBB5BD" }}>Say it.</em>
          </h1>
        </div>
        <Link
          href="/group"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            height: 48,
            padding: "0 20px",
            boxSizing: "border-box",
            border: "2px solid rgba(245,236,217,0.5)",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Back to the group
          <ArrowRight size={18} />
        </Link>
      </div>

      <div
        style={{
          fontFamily: "var(--font-hand), cursive",
          fontSize: 26,
          color: "#F5E39B",
          marginTop: 14,
          transform: "rotate(-1deg)",
        }}
      >
        {count === 0
          ? "an empty list is the AI guessing on its own."
          : `${count} item${count === 1 ? "" : "s"} · the gift picker puts these above anything it works out on its own.`}
      </div>

      <div style={{ marginTop: 28 }}>
        <AddLinkForm />
      </div>

      <SectionLabel style={{ marginTop: 40 }}>On the list</SectionLabel>
      <WishlistGrid />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 44,
          fontSize: 14,
          color: "rgba(245,236,217,0.7)",
        }}
      >
        <Lock />
        Your list is visible to {group.name} and nowhere else. Remove an item and it
        stops counting as a signal immediately.
      </div>
    </PageShell>
  );
}
