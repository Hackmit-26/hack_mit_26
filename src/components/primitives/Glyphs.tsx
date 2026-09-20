/**
 * The only ornaments in the system: sparkles, one card suit per card at 55%
 * opacity, and hand-drawn arrows. Custom SVG reaction glyphs, no stock emoji.
 */

export function Grain({
  w,
  h,
  id,
  light = false,
}: {
  w: number;
  h: number;
  id: string;
  /** Cream grain for the navy lore cards, ink grain for pastel cards. */
  light?: boolean;
}) {
  return (
    <svg
      width={w}
      height={h}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
        mixBlendMode: light ? "normal" : "multiply",
        opacity: light ? 0.1 : 0.16,
      }}
      aria-hidden="true"
    >
      <filter id={id}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          stitchTiles="stitch"
        />
        <feColorMatrix
          values={
            light
              ? "0 0 0 0 0.9  0 0 0 0 0.85  0 0 0 0 0.7  0 0 0 0.5 0"
              : "0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0.9 0"
          }
        />
      </filter>
      <rect width={w} height={h} filter={`url(#${id})`} />
    </svg>
  );
}

export function Sparkle({
  size = 26,
  fill = "#F5E39B",
  stroke,
}: {
  size?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <path
        d="M13 1 l3.4 8.6 L25 13 l-8.6 3.4 L13 25 l-3.4 -8.6 L1 13 l8.6 -3.4 z"
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 1.6 : undefined}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRight({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13 H21 M14 6 L21 13 L14 20" />
    </svg>
  );
}

export function ArrowLeft({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 13 H5 M12 6 L5 13 L12 20" />
    </svg>
  );
}

export function Heart({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 14 C2 10 1 6 3 4 C5 2 7.5 3 8 5 C8.5 3 11 2 13 4 C15 6 14 10 8 14 Z"
        fill="#D6455A"
        stroke="#141A47"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Star({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.5 L9.9 5.9 L14.6 6.3 L11 9.4 L12.1 14 L8 11.5 L3.9 14 L5 9.4 L1.4 6.3 L6.1 5.9 Z"
        fill="#F5C64B"
        stroke="#141A47"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Lock({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" />
    </svg>
  );
}

export function Check({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      style={{ flexShrink: 0, marginTop: 1 }}
      fill="none"
      stroke="#141A47"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="8" fill="#A8DCC2" />
      <path d="M5.5 9.3 L8 11.8 L12.5 6.6" />
    </svg>
  );
}

export function GiftIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="10" width="20" height="13" rx="2" />
      <rect x="2" y="6.5" width="22" height="4.5" rx="1.5" />
      <path d="M13 6.5 V23" />
      <path d="M13 6.5 C10 2 5 3 7 6 M13 6.5 C16 2 21 3 19 6" />
    </svg>
  );
}

export function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 12 V2 M5 6 L9 2 L13 6 M3 10 V15 H15 V10" />
    </svg>
  );
}

export function ReplayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9 a6 6 0 1 0 2 -4.5 M3 3 V6 H6" />
    </svg>
  );
}

/** One suit per card, at 55% opacity. */
export function Diamond({ size = 26, fill = "#D6455A" }) {
  return (
    <svg width={size} height={size} viewBox="-13 -13 26 26" aria-hidden="true">
      <path d="M0 -12 L9 0 L0 12 L-9 0 Z" fill={fill} stroke="#141A47" strokeWidth="1.4" />
    </svg>
  );
}

export function HandArrow({ width = 70 }: { width?: number }) {
  return (
    <svg
      width={width}
      height={width * (30 / 70)}
      viewBox="0 0 70 30"
      fill="none"
      stroke="#C4553F"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 22 C24 -2 48 6 62 22 M52 20 L62 24 L62 12" />
    </svg>
  );
}
