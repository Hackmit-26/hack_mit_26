import Link from "next/link";

import { PageShell, PaperCard, SectionLabel } from "@/components/layout/PageShell";
import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, Lock } from "@/components/primitives/Glyphs";
import { VisaLockup } from "@/components/primitives/VisaMark";
import { InviteCodeCard } from "@/components/welcome/InviteCodeCard";
import { storyChapters } from "@/data/chapters";
import { purchases } from "@/data/purchases";
import { group, userList, viewer } from "@/data/users";
import { defaultSpendLimits } from "@/services/checkout";
import { formatPrice } from "@/services/commerce";

/** The four stages `runCheckout` actually walks, in the user's words. */
const visaSteps = [
  {
    title: "You pick",
    body: "An item from a friend's month, or a gift the group splits.",
  },
  {
    title: "You approve",
    body: "A passkey prompt with the exact amount, bounded by your limit.",
  },
  {
    title: "A token, not a card",
    body: "Checkout gets an agent-scoped credential. No card number is held.",
  },
  {
    title: "It lands",
    body: "The merchant is paid and the outcome returns to the story.",
  },
];

/**
 * The front door. Who you are, who is in the group, the code that gets
 * someone else in, and what the four chapters ask — then one way onward.
 * Same system as the cards: midnight ground, cream paper, ink outlines.
 */
export function WelcomeScreen() {
  const others = userList.filter((u) => !u.isViewer);

  return (
    <PageShell>
      {/* ---- hero ------------------------------------------------------ */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "clamp(28px, 4vw, 56px)",
          alignItems: "center",
        }}
      >
        <div className="a-up">
          <SectionLabel>
            {group.period} issue · {group.name}
          </SectionLabel>

          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(44px, 7vw, 82px)",
              lineHeight: 0.98,
              margin: "18px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            Welcome, <em style={{ color: "#EBB5BD" }}>{viewer.name}</em>
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 1.6vw, 19px)",
              lineHeight: 1.55,
              color: "#C9CEE6",
              maxWidth: 460,
              margin: "18px 0 0",
            }}
          >
            Your {group.period.toLowerCase()} is in. {purchases.length} purchases
            across {userList.length} friends, read for patterns rather than
            totals — who you shop like, what your month says about you, and the
            one strange thing you all did.
          </p>

          <div style={{ marginTop: 28, maxWidth: 420 }}>
            <InviteCodeCard code={group.inviteCode} />
            <div
              style={{
                fontFamily: "var(--font-hand), cursive",
                fontSize: 17,
                color: "#C9CEE6",
                marginTop: 10,
                paddingLeft: 4,
              }}
            >
              send this to whoever is missing
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignItems: "center",
              marginTop: 28,
            }}
          >
            <Link
              href="/wrapped"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 26px",
                borderRadius: 999,
                background: "#F5E39B",
                color: "#141A47",
                border: "2px solid #141A47",
                boxShadow: "5px 5px 0 #141A47",
                fontWeight: 700,
                fontSize: 17,
              }}
            >
              Open the {group.period} issue
              <ArrowRight size={20} />
            </Link>

            <Link
              href="/join"
              style={{
                padding: "15px 22px",
                borderRadius: 999,
                border: "2px solid rgba(245,236,217,0.35)",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Join with a code
            </Link>
          </div>
        </div>

        {/* the four of them, with the real faces */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "clamp(6px, 1.4vw, 18px)",
            flexWrap: "wrap",
          }}
        >
          {userList.map((u, i) => (
            <figure
              key={u.id}
              className="a-drop"
              style={{
                margin: 0,
                textAlign: "center",
                animationDelay: `${0.12 * i + 0.15}s`,
                transform: `rotate(${i % 2 ? 2.5 : -2.5}deg)`,
              }}
            >
              <div
                style={{
                  width: "clamp(76px, 9vw, 116px)",
                  height: "clamp(76px, 9vw, 116px)",
                  borderRadius: "50%",
                  border: `3px solid ${u.color}`,
                  boxShadow: "4px 4px 0 #141A47",
                  overflow: "hidden",
                  background: u.color,
                }}
              >
                <Avatar who={u.id} />
              </div>
              <figcaption style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {u.isViewer ? `${u.name} (you)` : u.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-hand), cursive",
                    fontSize: 16,
                    color: u.color,
                    lineHeight: 1.15,
                    maxWidth: 110,
                    margin: "2px auto 0",
                  }}
                >
                  {u.persona}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ---- what's inside --------------------------------------------- */}
      <section style={{ marginTop: "clamp(48px, 7vh, 84px)" }}>
        <SectionLabel style={{ color: "#A8DCC2" }}>
          Four chapters · {others.length} friends to compare against
        </SectionLabel>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "clamp(14px, 2vw, 22px)",
            marginTop: 20,
          }}
        >
          {storyChapters.map((c, i) => (
            <PaperCard
              key={c.id}
              bg={c.bg}
              className="a-up"
              style={{
                color: c.fg,
                animationDelay: `${0.08 * i + 0.3}s`,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 178,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  opacity: 0.72,
                }}
              >
                {c.kicker}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 30,
                  lineHeight: 1.04,
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-hand), cursive",
                  fontSize: 20,
                  lineHeight: 1.2,
                  marginTop: "auto",
                }}
              >
                “{c.question}”
              </div>
            </PaperCard>
          ))}
        </div>
      </section>

      {/* ---- the rail ---------------------------------------------------- */}
      <section
        className="a-fade"
        style={{ marginTop: "clamp(48px, 7vh, 84px)", animationDelay: "0.5s" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <SectionLabel style={{ color: "#BBA9E8" }}>
            Chapter 4 · buying, handled
          </SectionLabel>
          <VisaLockup tone="cream" height={22} label="Intelligent Commerce" />
        </div>

        <PaperCard
          bg="#141A47"
          style={{
            color: "#F5ECD9",
            marginTop: 18,
            boxShadow: "6px 6px 0 #1434CB",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(24px, 2.8vw, 34px)",
              lineHeight: 1.12,
              margin: 0,
              maxWidth: 640,
            }}
          >
            See something a friend bought, buy it in the story — without ever
            handing a card number to the agent.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 16,
              marginTop: 26,
            }}
          >
            {visaSteps.map((s, i) => (
              <div key={s.title} style={{ display: "flex", gap: 12 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "2px solid #F7B600",
                    color: "#F7B600",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <span>
                  <span
                    style={{ display: "block", fontWeight: 700, fontSize: 15 }}
                  >
                    {s.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: "#C9CEE6",
                      marginTop: 3,
                    }}
                  >
                    {s.body}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid rgba(245,236,217,0.18)",
              fontSize: 14.5,
              color: "#C9CEE6",
            }}
          >
            <Lock size={16} />
            Your limits, set once:
            <b style={{ color: "#F5ECD9" }}>
              {formatPrice(defaultSpendLimits.perPurchaseCents)} per purchase
            </b>
            ·
            <b style={{ color: "#F5ECD9" }}>
              {formatPrice(defaultSpendLimits.monthlyCents)} a month
            </b>
            <span style={{ opacity: 0.75 }}>
              — the agent can never spend past them.
            </span>
          </div>
        </PaperCard>
      </section>

      {/* ---- the promise ------------------------------------------------ */}
      <section
        className="a-fade"
        style={{
          marginTop: "clamp(34px, 5vh, 56px)",
          display: "flex",
          gap: 14,
          alignItems: "center",
          padding: "20px 24px",
          borderRadius: 24,
          border: "2px dashed rgba(245,236,217,0.28)",
          animationDelay: "0.6s",
        }}
      >
        <Lock size={20} />
        <div style={{ fontSize: 15.5, lineHeight: 1.5, maxWidth: 640 }}>
          Every purchase starts private. You pick what the group sees, item by
          item, and you can hide anything after the fact — nothing here is
          public, and nothing leaves {group.name}.
        </div>
      </section>
    </PageShell>
  );
}
