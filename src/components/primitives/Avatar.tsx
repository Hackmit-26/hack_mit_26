import type { UserId } from "@/lib/types";

/**
 * Flat, faceless-minimal portrait in the friend's colour.
 * Ported from the `Avatar` artboard; hair shape differs per person.
 */
const palette: Record<UserId, { bg: string; skin: string; body: string }> = {
  kristina: { bg: "#E8806F", skin: "#E9BE9F", body: "#F5ECD9" },
  esh: { bg: "#BBA9E8", skin: "#C58F6C", body: "#141A47" },
  sabina: { bg: "#A8DCC2", skin: "#8D5A3E", body: "#E8806F" },
  madhav: { bg: "#F5E39B", skin: "#F0CBB0", body: "#BBA9E8" },
};

/**
 * Real photos, square and face-centred, in `public/people`. Anyone without
 * one here falls back to the illustrated portrait below.
 */
const photos: Partial<Record<UserId, string>> = {
  kristina: "/people/kristina.jpg",
  esh: "/people/esh.jpg",
  sabina: "/people/sabina.jpg",
  madhav: "/people/madhav.jpg",
};

export function Avatar({ who }: { who: UserId }) {
  const m = palette[who];
  const photo = photos[who];

  if (photo) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          background: m.bg,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        overflow: "hidden",
        background: m.bg,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{ display: "block" }}
        aria-hidden="true"
      >
        <rect x="0" y="0" width="100" height="100" fill={m.bg} />

        {/* back hair */}
        {who === "kristina" && (
          <path
            d="M30 50 C24 20 40 12 50 12 C62 12 78 20 70 50 L73 82 L27 82 Z"
            fill="#4A2C22"
          />
        )}
        {who === "esh" && (
          <path
            d="M29 52 C24 20 42 12 50 12 C60 12 77 20 71 52 L71 62 C71 66 66 64 66 60 L34 60 C34 64 29 66 29 62 Z"
            fill="#1B1B26"
          />
        )}
        {who === "sabina" && (
          <g fill="#A24B2A">
            <circle cx="50" cy="13" r="9" />
            <circle cx="33" cy="34" r="10" />
            <circle cx="42" cy="25" r="10" />
            <circle cx="56" cy="25" r="10" />
            <circle cx="67" cy="34" r="10" />
            <circle cx="70" cy="48" r="9" />
            <circle cx="30" cy="48" r="9" />
          </g>
        )}

        <path
          d="M12 100 C14 78 32 72 50 72 C68 72 86 78 88 100 Z"
          fill={m.body}
        />
        <rect x="44" y="60" width="12" height="16" rx="5" fill={m.skin} />
        <ellipse cx="50" cy="46" rx="17" ry="19" fill={m.skin} />

        {/* front hair */}
        {who === "kristina" && (
          <path
            d="M33 42 C35 26 48 24 52 30 C58 24 69 30 67 42 C60 34 44 34 33 42 Z"
            fill="#4A2C22"
          />
        )}
        {who === "esh" && (
          <>
            <path
              d="M32 40 C33 25 67 25 68 40 C58 34 42 34 32 40 Z"
              fill="#1B1B26"
            />
            <rect
              x="60"
              y="30"
              width="9"
              height="3.4"
              rx="1.7"
              fill="#F4E29A"
              transform="rotate(-24 64 31)"
            />
          </>
        )}
        {who === "sabina" && (
          <path
            d="M33 40 C36 30 46 30 50 34 C56 29 64 32 67 40 C60 36 42 36 33 40 Z"
            fill="#A24B2A"
          />
        )}
        {who === "madhav" && (
          <path
            d="M32 42 C29 22 44 18 50 18 C58 18 71 22 68 42 C64 33 36 33 32 42 Z"
            fill="#22202B"
          />
        )}

        <circle cx="43" cy="48" r="1.9" fill="#1B1B26" />
        <circle cx="57" cy="48" r="1.9" fill="#1B1B26" />
        <circle cx="39" cy="53" r="3" fill="#E8806F" opacity="0.35" />
        <circle cx="61" cy="53" r="3" fill="#E8806F" opacity="0.35" />
        <path
          d="M45 55 Q50 59.5 55 55"
          fill="none"
          stroke="#1B1B26"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
