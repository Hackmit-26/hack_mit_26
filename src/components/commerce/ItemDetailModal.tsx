"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CommentDock } from "@/components/comments/CommentDock";
import { FindHeart } from "@/components/commerce/FindHeart";
import {
  artForFind,
  bgForFind,
  findCommentTarget,
  getCachedRoster,
  ownerOf,
  toggleFindWishlist,
  useCachedFind,
  type RosterUser,
} from "@/components/commerce/findsStore";
import { Avatar } from "@/components/primitives/Avatar";
import { ArrowRight, Heart, Lock, Star } from "@/components/primitives/Glyphs";
import { ProductArt } from "@/components/primitives/ProductArt";
import { ReactionBar } from "@/components/wrapped/ReactionBar";
import { productsById } from "@/data/products";
import { purchases } from "@/data/purchases";
import { getUser, users } from "@/data/users";
import type { FindItem } from "@/lib/apiTypes";
import type { ArtKind, UserId } from "@/lib/types";
import { formatPrice } from "@/services/commerce";
import { cardTarget, useApp, type CommentTarget, type WishlistItem } from "@/state/store";

/** What a call site asks for. Four id-spaces, one modal. `find` is the live one. */
export type ItemDetailRequest =
  | { kind: "product"; id: string }
  | { kind: "purchase"; id: string }
  | { kind: "wishlist"; id: string }
  | { kind: "find"; id: string };

/**
 * One person on one of the modal's rosters. `userId` is null for a purchase
 * shared anonymously — the group is told somebody bought it, never who.
 */
interface Person {
  key: string;
  userId: UserId | null;
  /** The line under the name: "Sept 10 · Adidas", "Ordered from Tin & Tulip". */
  note?: string;
}

/**
 * Everything the modal can show about one item, whatever it was resolved from.
 * Optional fields are genuinely absent facts, not blanks: a catalogue row has
 * no owner, a wishlist row has no interesting "who wishlisted it".
 */
interface ItemDetailView {
  title: string;
  merchant: string;
  /** Null when the amount is the buyer's business and they have not shared it. */
  priceCents: number | null;
  /** Why the price is missing, when it is missing for a privacy reason. */
  priceNote?: string;
  image?: string;
  art: ArtKind;
  bg: string;
  /** The real product page. Absent on receipts and on catalogue rows with no page. */
  url?: string;
  /** Small-caps line above the title. */
  kicker: string;
  /** The owner's own words about it. Live finds carry one; fixtures do not. */
  blurb?: string;
  /** Who put it there, when that is a different question from who bought it. */
  addedBy?: { label: string; person: Person };
  boughtBy: Person[];
  wishlistedBy: Person[];
  /** Local demo reactions key off this. Shares its id-space with the Wrapped cards. */
  likeTargetId?: string;
  /**
   * Real server-side hearts, for a live find. An anonymous aggregate on purpose:
   * §1 rule 4 forbids ever naming who hearted an item, so there is a count and
   * no roster, which is why this is not `likeTargetId`.
   */
  hearts?: { itemId: string; count: number; mine: boolean };
  /** Only a live find can be starred: the reaction needs a real `item-*` row to hang off. */
  starred?: { itemId: string; mine: boolean };
  commentTarget: CommentTarget;
}

const anonPerson = (key: string, note?: string): Person => ({ key, userId: null, note });

function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  const name = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][Number(month) - 1];
  return name ? `${name} ${Number(day)}` : date;
}

interface ResolveContext {
  viewerId: UserId;
  wishlist: WishlistItem[];
  orders: { id: string; productId: string; merchant: string }[];
  sharing: Record<string, string>;
  showAmounts: boolean;
  /** The live row behind a `find` request, already fetched by the group feed. */
  find: FindItem | null;
  findRoster: RosterUser[];
}

/** Everyone who bought this exact item in September, minus whatever is hidden. */
function buyersOf(item: string, ctx: ResolveContext): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of purchases) {
    if (p.item !== item) continue;
    const state = ctx.sharing[p.id] ?? p.sharing;
    if (state === "hidden") continue;
    const who = state === "anonymous" ? null : p.userId;
    const dedupe = who ?? `anon-${p.id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      key: p.id,
      userId: who,
      note: `${dayLabel(p.date)} · ${p.merchant}`,
    });
  }
  return out;
}

/** Only the viewer's own list exists on this device, so this is at most one name. */
function wishlistedBy(
  ctx: ResolveContext,
  match: (w: WishlistItem) => boolean,
): Person[] {
  const mine = ctx.wishlist.find(match);
  return mine ? [{ key: mine.id, userId: ctx.viewerId, note: "on their list" }] : [];
}

/** What the viewer has actually ordered from inside the Wrapped. */
function orderedBy(productId: string, ctx: ResolveContext): Person[] {
  return ctx.orders
    .filter((o) => o.productId === productId)
    .map((o) => ({
      key: o.id,
      userId: ctx.viewerId,
      note: `ordered from ${o.merchant}`,
    }));
}

/**
 * "Three other people also want this" is the one signal a gifting app cannot
 * fake, and the viewer's own list can only ever name the viewer — so this comes
 * from the group roster, not from `ctx.wishlist`.
 *
 * An id outside the four demo members cannot be drawn (no avatar, no colour),
 * so it renders as "Someone in the group" rather than being dropped: the size
 * of the roster is the part that carries the meaning.
 */
function rosterPeople(itemId: string, roster: RosterUser[], viewerId: UserId): Person[] {
  return roster.map((user) => ({
    key: `${itemId}-${user.id}`,
    userId: user.id in users ? (user.id as UserId) : null,
    note: user.id === viewerId ? "on your list" : "on their list",
  }));
}

/**
 * The one place the four id-spaces become the same thing.
 *
 * Returns null for an id that resolves to nothing — a stale wishlist row, a
 * product that left the catalogue — and the modal then shows nothing at all
 * rather than a card full of dashes.
 */
function resolve(request: ItemDetailRequest, ctx: ResolveContext): ItemDetailView | null {
  if (request.kind === "find") {
    const find = ctx.find;
    if (!find || find.id !== request.id) return null;
    const owner = ownerOf(find);
    return {
      title: find.name,
      merchant: find.merchant ?? "No shop recorded",
      // Finds genuinely carry no price: the group feed is not a spending feed.
      priceCents: null,
      priceNote: "The group feed doesn’t carry amounts",
      image: find.imageUrl ?? undefined,
      art: artForFind(find),
      bg: bgForFind(find),
      url: find.productUrl ?? undefined,
      kicker: owner ? "Shared with the group" : "Shared anonymously",
      blurb: find.description ?? undefined,
      boughtBy: [
        {
          key: find.id,
          userId: owner,
          note: owner ? undefined : "shared anonymously",
        },
      ],
      wishlistedBy: rosterPeople(find.id, ctx.findRoster, ctx.viewerId),
      hearts: { itemId: find.id, count: find.heartCount, mine: find.iHearted },
      starred: { itemId: find.id, mine: find.iWishlisted },
      // The same key the feed's tile uses, so it is one conversation, not two.
      commentTarget: findCommentTarget(find.id),
    };
  }

  if (request.kind === "product") {
    const p = productsById[request.id];
    if (!p) return null;
    return {
      title: p.title,
      merchant: p.merchant,
      priceCents: p.priceCents,
      image: p.image,
      art: p.art,
      bg: p.bg,
      url: p.url,
      kicker: p.isNew ? "New to the group" : "In the catalogue",
      // A catalogue row belongs to nobody: it was sourced, not added by a friend.
      boughtBy: orderedBy(p.id, ctx),
      wishlistedBy: wishlistedBy(ctx, (w) => w.productId === p.id),
      likeTargetId: p.id,
      commentTarget: cardTarget(`product-${p.id}`),
    };
  }

  if (request.kind === "purchase") {
    const p = purchases.find((x) => x.id === request.id);
    if (!p) return null;
    const state = ctx.sharing[p.id] ?? p.sharing;
    // The buyer always sees their own amount; everyone else waits to be shown it.
    const mine = p.userId === ctx.viewerId;
    return {
      title: p.item,
      merchant: p.merchant,
      priceCents: ctx.showAmounts || mine ? p.amountCents : null,
      priceNote: ctx.showAmounts || mine ? undefined : "Amount hidden by the buyer",
      image: p.image,
      art: p.art,
      bg: state === "anonymous" ? "#F5ECD9" : getUser(p.userId).color,
      url: p.url,
      kicker: `Bought ${dayLabel(p.date)}`,
      boughtBy: buyersOf(p.item, ctx),
      wishlistedBy: wishlistedBy(ctx, (w) => w.title === p.item),
      likeTargetId: p.id,
      // Same key the group feed's tile uses, so it is one conversation, not two.
      commentTarget: cardTarget(`purchase-${p.id}`),
    };
  }

  const w = ctx.wishlist.find((x) => x.id === request.id);
  if (!w) return null;
  return {
    title: w.title,
    merchant: w.merchant,
    priceCents: w.priceCents,
    image: w.image,
    art: w.art,
    bg: w.bg,
    url: w.pending ? undefined : w.url,
    kicker: w.source === "catalogue" ? "Saved from the Wrapped" : "Saved from a link",
    addedBy: {
      label: "Added by",
      person: { key: w.id, userId: ctx.viewerId, note: "to their list" },
    },
    boughtBy: w.productId ? orderedBy(w.productId, ctx) : [],
    // "Who wishlisted it" is the list you are looking at. Nothing to say.
    wishlistedBy: [],
    likeTargetId: w.productId ?? w.id,
    commentTarget: cardTarget(w.productId ? `product-${w.productId}` : `wishlist-${w.id}`),
  };
}

// ---- the provider ----------------------------------------------------

interface ItemDetailValue {
  openItem: (request: ItemDetailRequest) => void;
}

const ItemDetailContext = createContext<ItemDetailValue | null>(null);

/**
 * Mounted once, in the root layout, so any tile anywhere opens the same modal
 * with one hook call and no prop drilling.
 */
export function ItemDetailProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ItemDetailRequest | null>(null);

  const openItem = useCallback((next: ItemDetailRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);
  const value = useMemo(() => ({ openItem }), [openItem]);

  return (
    <ItemDetailContext.Provider value={value}>
      {children}
      <ItemDetailModal request={request} onClose={close} />
    </ItemDetailContext.Provider>
  );
}

export function useItemDetail(): ItemDetailValue {
  const ctx = useContext(ItemDetailContext);
  if (!ctx) throw new Error("useItemDetail must be used inside <ItemDetailProvider>");
  return ctx;
}

// ---- the modal -------------------------------------------------------

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function ItemDetailModal({
  request,
  onClose,
}: {
  request: ItemDetailRequest | null;
  onClose: () => void;
}) {
  const { viewerId, wishlist, orders, privacy } = useApp();
  const panel = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<Element | null>(null);

  // Subscribed rather than read once, so a heart toggled inside the modal moves the count here too.
  const findId = request?.kind === "find" ? request.id : null;
  const find = useCachedFind(findId);

  const view = useMemo(
    () =>
      request === null
        ? null
        : resolve(request, {
            viewerId,
            wishlist,
            orders,
            sharing: privacy.sharing,
            showAmounts: privacy.showAmounts,
            find,
            findRoster: findId ? getCachedRoster(findId) : [],
          }),
    [request, viewerId, wishlist, orders, privacy.sharing, privacy.showAmounts, find, findId],
  );

  const open = view !== null;

  // Esc closes, Tab stays inside, and the tile that opened it gets focus back.
  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const stops = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      const back = returnFocusTo.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          key="item-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(11,15,42,0.74)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            boxSizing: "border-box",
          }}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={`${view.title} at ${view.merchant}`}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.2, 0.8, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: 620,
              maxWidth: "100%",
              maxHeight: "88vh",
              overflowY: "auto",
              boxSizing: "border-box",
              borderRadius: 32,
              background: "#F5ECD9",
              color: "#141A47",
              border: "2px solid #141A47",
              boxShadow: "8px 8px 0 #141A47",
              padding: 26,
              outline: "none",
            }}
          >
            <Body view={view} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Body({ view, onClose }: { view: ItemDetailView; onClose: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#C4553F",
            paddingTop: 8,
          }}
        >
          {view.kicker}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            border: "2px solid #141A47",
            borderRadius: "50%",
            background: "transparent",
            color: "#141A47",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            width: 168,
            height: 168,
            flexShrink: 0,
            boxSizing: "border-box",
            border: "2px solid #141A47",
            borderRadius: 24,
            background: view.bg,
            padding: view.image ? 0 : 14,
            overflow: "hidden",
            boxShadow: "5px 5px 0 #141A47",
          }}
        >
          {/* No photo is the normal case on real data — the illustration is the answer. */}
          <ProductArt kind={view.art} src={view.image} />
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 38,
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
              margin: 0,
              fontWeight: 400,
            }}
          >
            {view.title}
          </h2>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginTop: 8 }}>{view.merchant}</div>

          {view.blurb && (
            <div
              style={{
                fontFamily: "var(--font-hand), cursive",
                fontSize: 20,
                lineHeight: 1.15,
                marginTop: 8,
                opacity: 0.85,
              }}
            >
              {view.blurb}
            </div>
          )}

          {view.priceCents !== null ? (
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 40,
                lineHeight: 1,
                marginTop: 6,
              }}
            >
              {formatPrice(view.priceCents)}
            </div>
          ) : (
            view.priceNote && (
              <div
                style={{
                  // `flex`, not `inline-flex`: the price branch above is a block, and an inline
                  // note let the "Open the product page" button ride up onto the same line.
                  display: "flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  opacity: 0.8,
                }}
              >
                <Lock size={14} />
                {view.priceNote}
              </div>
            )
          )}

          {view.url ? (
            <a
              href={view.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                height: 48,
                padding: "0 22px",
                marginTop: 14,
                boxSizing: "border-box",
                borderRadius: 999,
                background: "#141A47",
                color: "#F5ECD9",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "4px 4px 0 #E8806F",
              }}
            >
              Open the product page
              <ArrowRight size={18} />
            </a>
          ) : (
            // A café round has no page. Say so instead of offering a dead button.
            <div
              style={{
                fontFamily: "var(--font-hand), cursive",
                fontSize: 21,
                lineHeight: 1.1,
                marginTop: 12,
                opacity: 0.75,
              }}
            >
              no product page for this one.
            </div>
          )}
        </div>
      </div>

      <Roster label="Bought by" people={view.boughtBy} />
      {view.addedBy && <Roster label={view.addedBy.label} people={[view.addedBy.person]} />}
      <Roster label="On a wishlist" people={view.wishlistedBy} />

      {view.hearts ? (
        <Section label="Hearts">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FindHearts hearts={view.hearts} />
            {view.starred && <FindStar starred={view.starred} />}
          </div>
        </Section>
      ) : (
        view.likeTargetId && (
          <Section label="Liked by">
            <Likes targetId={view.likeTargetId} />
          </Section>
        )
      )}

      <Section label="Comments">
        <CommentDock
          target={view.commentTarget}
          placement="inline"
          label="Open the thread"
          title={`On ${view.title}`}
        />
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          opacity: 0.65,
          marginBottom: 9,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/** A roster with nobody on it is a fact we do not have — the section goes away. */
function Roster({ label, people }: { label: string; people: Person[] }) {
  if (people.length === 0) return null;

  return (
    <Section label={label}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {people.map((p) => (
          <div
            key={p.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 16px 6px 6px",
              boxSizing: "border-box",
              border: "2px solid #141A47",
              borderRadius: 999,
              background: p.userId ? users[p.userId].color : "#FBF6EA",
              boxShadow: "3px 3px 0 #141A47",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid #141A47",
                boxSizing: "border-box",
                background: "#F5ECD9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {p.userId ? <Avatar who={p.userId} /> : <Lock size={14} />}
            </span>
            <span style={{ lineHeight: 1.15 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>
                {p.userId ? getUser(p.userId).name : "Someone in the group"}
              </span>
              {p.note && (
                <span style={{ display: "block", fontSize: 12, opacity: 0.8 }}>{p.note}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * Hearts on a live find. Never a list of names: the server sends a count and
 * nothing else, on purpose, so this says how many and whether the viewer is one.
 */
function FindHearts({ hearts }: { hearts: NonNullable<ItemDetailView["hearts"]> }) {
  const others = hearts.count - (hearts.mine ? 1 : 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <FindHeart itemId={hearts.itemId} count={hearts.count} mine={hearts.mine} />
      <span
        style={{
          fontFamily: "var(--font-hand), cursive",
          fontSize: 20,
          opacity: 0.75,
        }}
      >
        {hearts.count === 0
          ? "no hearts yet. be the first."
          : hearts.mine
            ? others === 0
              ? "just you, so far."
              : `you and ${others} other${others === 1 ? "" : "s"}.`
            : `${hearts.count} in the group. names stay private.`}
      </span>
    </div>
  );
}

/**
 * Starring a find. Unlike a heart this is *not* anonymous by design — the whole point of the
 * "On a wishlist" roster above is that the group can see who wants a thing — so the label says
 * out loud that the name goes on the list.
 */
function FindStar({ starred }: { starred: NonNullable<ItemDetailView["starred"]> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => void toggleFindWishlist(starred.itemId)}
        aria-pressed={starred.mine}
        aria-label={starred.mine ? "Remove from your list" : "Add to your list"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 16px",
          boxSizing: "border-box",
          border: "2px solid #141A47",
          borderRadius: 999,
          background: starred.mine ? "#F5E39B" : "rgba(245,236,217,0.92)",
          color: "#141A47",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: 700,
          boxShadow: "3px 3px 0 #141A47",
          cursor: "pointer",
          transition: "background .2s",
        }}
      >
        <Star size={16} />
        {starred.mine ? "On your list" : "Add to your list"}
      </motion.button>
      <span style={{ fontFamily: "var(--font-hand), cursive", fontSize: 20, opacity: 0.75 }}>
        {starred.mine ? "the group can see you want this." : "your name goes on the list above."}
      </span>
    </div>
  );
}

/** The like button, plus the names behind it so "who liked it" is readable. */
function Likes({ targetId }: { targetId: string }) {
  const { reactionsFor, viewerId } = useApp();
  const liked = reactionsFor(targetId).filter((r) => r.kind === "accurate");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <ReactionBar targetId={targetId} />
      {liked.length === 0 ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "var(--font-hand), cursive",
            fontSize: 20,
            opacity: 0.7,
          }}
        >
          <Heart size={15} />
          no likes yet. be the first.
        </span>
      ) : (
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>
          {liked
            .map((r) => (r.userId === viewerId ? "You" : getUser(r.userId).name))
            .join(", ")}
        </span>
      )}
    </div>
  );
}
