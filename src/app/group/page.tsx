"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, Lock, Sparkle } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { PageShell, PaperCard, SectionLabel } from "@/components/layout/PageShell";
import { getProduct } from "@/data/products";
import { purchases } from "@/data/purchases";
import { group, getUser, userList } from "@/data/users";
import { formatPrice } from "@/services/commerce";
import { useApp } from "@/state/store";

/**
 * The group screen: who's in, what's shared this month, and the way into the
 * Wrapped. Amounts stay hidden unless the viewer turns them on.
 */
export default function GroupPage() {
  const { privacy, orders, savedProductIds, reactionsFor } = useApp();

  const visible = purchases.filter(
    (p) => (privacy.sharing[p.id] ?? p.sharing) !== "hidden",
  );
  const recent = [...visible]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

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
        <Link
          href="/settings"
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
          <Lock />
          Privacy controls
        </Link>
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
                4 chapters · {visible.length} shared purchases · about 2 minutes
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
          const count = visible.filter((p) => p.userId === u.id).length;
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
                  {count} shared this month
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
        {recent.map((p) => {
          const sharing = privacy.sharing[p.id] ?? p.sharing;
          const anon = sharing === "anonymous";
          const reactions = reactionsFor(p.id);
          return (
            <div
              key={p.id}
              style={{
                position: "relative",
                padding: 12,
                boxSizing: "border-box",
                border: "2px solid #141A47",
                borderRadius: 20,
                background: "#F5ECD9",
                color: "#141A47",
                boxShadow: "4px 4px 0 #141A47",
              }}
            >
              <div
                style={{
                  height: 92,
                  borderRadius: 14,
                  background: anon ? "#F5ECD9" : getUser(p.userId).color,
                  border: "2px solid #141A47",
                  padding: 6,
                  boxSizing: "border-box",
                }}
              >
                <ProductArt kind={p.art} src={p.image} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, lineHeight: 1.2 }}>
                {p.item}
              </div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>{p.merchant}</div>
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
                {anon ? (
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
                      <Avatar who={p.userId} />
                    </span>
                    {getUser(p.userId).name}
                  </>
                )}
                {privacy.showAmounts && (
                  <span style={{ marginLeft: "auto", fontWeight: 700 }}>
                    {formatPrice(p.amountCents)}
                  </span>
                )}
              </div>
              {reactions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    right: -6,
                    top: -8,
                    height: 26,
                    padding: "0 9px",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 999,
                    background: "#F5E39B",
                    border: "2px solid #141A47",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {reactions.length}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* what the viewer has done from inside the Wrapped */}
      {(orders.length > 0 || savedProductIds.length > 0) && (
        <>
          <SectionLabel style={{ marginTop: 40 }}>From your Wrapped</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
            {orders.map((o) => (
              <div
                key={o.id}
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
              </div>
            ))}
            {savedProductIds.map((id) => (
              <div
                key={id}
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
              </div>
            ))}
          </div>
        </>
      )}

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
        Data shared with this group stays in this group. Leaving deletes your items from
        future Wrappeds.
      </div>
    </PageShell>
  );
}
