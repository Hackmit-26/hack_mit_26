"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { CommentDock } from "@/components/comments/CommentDock";
import { FindHeart } from "@/components/commerce/FindHeart";
import {
  artForFind,
  bgForFind,
  feedOrder,
  findCommentTarget,
  ownerOf,
  useGroupFinds,
} from "@/components/commerce/findsStore";
import { useItemDetail } from "@/components/commerce/ItemDetailModal";
import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, Heart, Lock, Sparkle } from "@/components/primitives/Glyphs";
import { ItemLink } from "@/components/primitives/ItemLink";
import { ProductArt } from "@/components/primitives/ProductArt";
import { VisaLockup } from "@/components/primitives/VisaMark";
import { PageShell, PaperCard, SectionLabel } from "@/components/layout/PageShell";
import { storyChapters } from "@/data/chapters";
import { getProduct } from "@/data/products";
import { backendGroupId, group, getUser, userList } from "@/data/users";
import type { FindItem } from "@/lib/apiTypes";
import { useApp } from "@/state/store";

const pill: React.CSSProperties = {
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
};

/** Two rows of the 180px grid on a normal laptop: enough to see all four people. */
const FEED_SIZE = 12;

/**
 * The home screen: who is in the group, what is shared this month, and the way into the
 * Wrapped. "Shared this month" is the live feed — `GET /groups/:id/finds` — so
 * its ids join the wishlist rosters and the comment threads on the server.
 */
export default function HomePage() {
  const { orders, savedProductIds, wishlist } = useApp();
  const { openItem } = useItemDetail();

  const feed = useGroupFinds(backendGroupId);
  const finds = feed.status === "ready" ? feed.finds : [];
  const recent = feedOrder(finds, FEED_SIZE);

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
          <SectionLabel>{group.period} issue</SectionLabel>
          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(44px, 6vw, 76px)",
              lineHeight: 0.92,
              letterSpacing: "-0.03em",
              margin: "8px 0 0",
              fontWeight: 400,
            }}
          >
            {group.name}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/wishlist" style={pill}>
            <Heart />
            Wishlist
            {wishlist.length > 0 ? ` · ${wishlist.length}` : ""}
          </Link>
          <Link href="/settings" style={pill}>
            <Lock />
            Privacy controls
          </Link>
        </div>
      </div>

      {/* the Wrapped is ready */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        style={{ marginTop: 28 }}
      >
        <PaperCard bg="#EBB5BD">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 28,
                  padding: "0 12px 0 8px",
                  boxSizing: "border-box",
                  borderRadius: 999,
                  background: "#F5E39B",
                  border: "2px solid #141A47",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                <Sparkle size={14} fill="#141A47" />
                Ready
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: "clamp(32px, 4vw, 52px)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  marginTop: 10,
                }}
              >
                Your September <em style={{ color: "#B8412F" }}>Wrapped</em>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-hand), cursive",
                  fontSize: 24,
                  lineHeight: 1,
                  marginTop: 8,
                }}
              >
                {storyChapters.length} chapters
                {feed.status === "ready" && ` · ${finds.length} shared finds`} · about 2
                minutes
              </div>
            </div>

            <Link
              href="/wrapped"
              scroll={false}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                height: 64,
                padding: "0 28px",
                boxSizing: "border-box",
                border: 0,
                borderRadius: 999,
                background: "#141A47",
                color: "#F5ECD9",
                fontSize: 18,
                fontWeight: 700,
                boxShadow: "5px 5px 0 #B8412F",
                flexShrink: 0,
              }}
            >
              Play the Wrapped
              <ArrowRight />
            </Link>
          </div>
        </PaperCard>
      </motion.div>

      {/* members */}
      <SectionLabel style={{ marginTop: 40 }}>The group</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        {userList.map((u, i) => {
          // Anonymous items are stripped of their owner, so they count for that person alone.
          const count = finds.filter((f) => f.ownerId === u.id).length;
          return (
            <div
              key={u.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: 14,
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 22,
                background: u.color,
                color: "#141A47",
                boxShadow: "4px 4px 0 #141A47",
                transform: `rotate(${[-0.8, 0.6, -0.5, 0.7][i]}deg)`,
              }}
            >
              <div
                style={{
                  width: 62,
                  height: 62,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: "2px solid #141A47",
                  overflow: "hidden",
                }}
              >
                <Avatar who={u.id} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontSize: 28,
                    lineHeight: 1,
                  }}
                >
                  {u.name}
                  {u.isViewer && (
                    <span style={{ fontSize: 15, fontFamily: "var(--font-body)" }}> (you)</span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-hand), cursive", fontSize: 19 }}>
                  {u.persona}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
                  {feed.status === "ready" ? `${count} shared this month` : "counting…"}
                </div>
              </div>
            </div>
          );
        })}

        <Link
          href="/join"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 14,
            minHeight: 96,
            boxSizing: "border-box",
            border: "2px dashed rgba(245,236,217,0.5)",
            borderRadius: 22,
            color: "rgba(245,236,217,0.85)",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          + Invite a friend
        </Link>
      </div>

      {/* shared finds */}
      <SectionLabel style={{ marginTop: 40 }}>Shared this month</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        {feed.status === "loading" &&
          Array.from({ length: FEED_SIZE }, (_, i) => <FindTileGhost key={i} />)}
        {feed.status === "ready" &&
          recent.map((find) => <SharedFindTile key={find.id} find={find} />)}
      </div>

      {feed.status === "error" && <FeedNotice>the group feed is not answering.</FeedNotice>}
      {feed.status === "ready" && recent.length === 0 && (
        <FeedNotice>nothing shared yet this month.</FeedNotice>
      )}

      {/* what the viewer has done from inside the Wrapped */}
      {(orders.length > 0 || savedProductIds.length > 0) && (
        <>
          <SectionLabel style={{ marginTop: 40 }}>From your Wrapped</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
            {orders.map((o) => (
              <ItemLink
                key={o.id}
                url={getProduct(o.productId).url}
                label={`${getProduct(o.productId).title} at ${o.merchant}`}
                onActivate={() => openItem({ kind: "product", id: o.productId })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 18px 10px 10px",
                  border: "2px solid #141A47",
                  borderRadius: 999,
                  background: "#A8DCC2",
                  color: "#141A47",
                  boxShadow: "3px 3px 0 #141A47",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "#F5ECD9",
                    border: "2px solid #141A47",
                    padding: 4,
                    boxSizing: "border-box",
                  }}
                >
                  <ProductArt kind={getProduct(o.productId).art} src={getProduct(o.productId).image} />
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                    {getProduct(o.productId).title}
                  </div>
                  <div style={{ fontSize: 12.5 }}>
                    Ordered from {o.merchant}
                    {o.inspiredByUserId &&
                      ` · credited to ${getUser(o.inspiredByUserId).name}`}
                  </div>
                </div>
              </ItemLink>
            ))}
            {savedProductIds.map((id) => (
              <ItemLink
                key={id}
                url={getProduct(id).url}
                label={`${getProduct(id).title} at ${getProduct(id).merchant}`}
                onActivate={() => openItem({ kind: "product", id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 44,
                  padding: "0 18px",
                  border: "2px dashed #141A47",
                  borderRadius: 999,
                  background: "#F5ECD9",
                  color: "#141A47",
                  fontSize: 14.5,
                  fontWeight: 700,
                }}
              >
                Saved · {getProduct(id).title}
              </ItemLink>
            ))}
          </div>
        </>
      )}

      {/*
        The rail, in one line. This used to be a four-step wall on a separate welcome screen;
        the feed is the front door now, so the sponsor story rides along the footnote rather
        than standing between the viewer and their group.
      */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 18,
          marginTop: 44,
          paddingTop: 18,
          borderTop: "1px solid rgba(245,236,217,0.18)",
          fontSize: 14,
          color: "rgba(245,236,217,0.7)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Lock />
          Data shared with this group stays in this group. Leaving deletes your items from
          future Wrappeds.
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          Buy anything here without handing over a card number.
          <VisaLockup height={18} />
        </span>
      </div>
    </PageShell>
  );
}

/**
 * One live find. The comment chip sits under the tile and, while the
 * conversation is open, the tile takes the whole row so the thread has room to
 * be a thread rather than a column of one-word bubbles.
 *
 * Finds carry no price — that is the backend's privacy design, not a gap — so
 * the row that used to hold the amount holds the real heart count instead.
 */
function SharedFindTile({ find }: { find: FindItem }) {
  const [talking, setTalking] = useState(false);
  const { openItem } = useItemDetail();
  const owner = ownerOf(find);

  return (
    <div
      style={{
        position: "relative",
        gridColumn: talking ? "1 / -1" : "auto",
        padding: 12,
        boxSizing: "border-box",
        border: "2px solid #141A47",
        borderRadius: 20,
        background: "#F5ECD9",
        color: "#141A47",
        boxShadow: "4px 4px 0 #141A47",
      }}
    >
      {/* The whole tile opens the item, not the shop: who shared it, how many
          hearts, who has it on a list, and the conversation, all in one place. */}
      <ItemLink
        url={find.productUrl}
        label={`${find.name}${find.merchant ? ` at ${find.merchant}` : ""}`}
        onActivate={() => openItem({ kind: "find", id: find.id })}
      >
        <div
          style={{
            height: 92,
            maxWidth: talking ? 260 : "none",
            borderRadius: 14,
            background: bgForFind(find),
            border: "2px solid #141A47",
            // No photo is the normal case on real data: the illustration fills the slot instead.
            padding: find.imageUrl ? 0 : 6,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <ProductArt kind={artForFind(find)} src={find.imageUrl ?? undefined} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, lineHeight: 1.2 }}>
          {find.name}
        </div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{find.merchant ?? "No shop recorded"}</div>
      </ItemLink>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginTop: 8,
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {owner === null ? (
          <span style={{ opacity: 0.7 }}>someone in the group</span>
        ) : (
          <>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid #141A47",
                flexShrink: 0,
              }}
            >
              <Avatar who={owner} />
            </span>
            {getUser(owner).name}
          </>
        )}
        <span style={{ marginLeft: "auto" }}>
          <FindHeart itemId={find.id} count={find.heartCount} mine={find.iHearted} compact />
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <CommentDock
          target={findCommentTarget(find.id)}
          compact
          placement="inline"
          label="Comments"
          title={`On ${find.name}`}
          onOpenChange={setTalking}
        />
      </div>

      {find.iWishlisted && (
        <div
          style={{
            position: "absolute",
            right: -6,
            top: -8,
            display: "flex",
            alignItems: "center",
            gap: 5,
            height: 26,
            padding: "0 10px",
            borderRadius: 999,
            background: "#F5E39B",
            border: "2px solid #141A47",
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          <Heart size={12} />
          On your list
        </div>
      )}
    </div>
  );
}

/** The feed is a network call now: hold the grid's shape while it lands. */
function FindTileGhost() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 212,
        boxSizing: "border-box",
        border: "2px dashed rgba(20,26,71,0.35)",
        borderRadius: 20,
        background: "rgba(245,236,217,0.35)",
        boxShadow: "4px 4px 0 rgba(20,26,71,0.2)",
        animation: "fadeIn .5s ease both",
      }}
    />
  );
}

function FeedNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-hand), cursive",
        fontSize: 24,
        color: "#F5E39B",
        marginTop: 16,
        transform: "rotate(-1deg)",
      }}
    >
      {children}
    </div>
  );
}
