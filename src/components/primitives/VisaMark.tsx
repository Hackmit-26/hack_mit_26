/**
 * The Visa wordmark.
 *
 * `public/brand/visa.png` is the official 2021 mark; `visa-cream.png` is the
 * same artwork repainted cream for the midnight surfaces, since the blue does
 * not hold up on #0B0F2A or #141A47. Aspect is fixed at the source ratio, so
 * callers set a height and the width follows — never scale it non-uniformly.
 */

const ASPECT = 512 / 166; // the trimmed wordmark

export type VisaTone = "blue" | "cream";

export function VisaMark({
  height = 18,
  tone = "blue",
}: {
  /** Height of the wordmark in px; width is derived. */
  height?: number;
  tone?: VisaTone;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "cream" ? "/brand/visa-cream.png" : "/brand/visa.png"}
      alt="Visa"
      width={Math.round(height * ASPECT)}
      height={height}
      style={{
        height,
        width: Math.round(height * ASPECT),
        display: "block",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * "Built on" lockup for surfaces that explain the rail rather than badge a
 * single merchant. The gold rule is the house accent, not Visa artwork.
 */
export function VisaLockup({
  tone = "cream",
  height = 22,
  label = "Intelligent Commerce",
}: {
  tone?: VisaTone;
  height?: number;
  label?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        whiteSpace: "nowrap",
      }}
    >
      <VisaMark height={height} tone={tone} />
      <span
        style={{
          width: 1,
          height: height * 0.95,
          background: "currentColor",
          opacity: 0.35,
        }}
      />
      <span
        style={{
          fontSize: height * 0.62,
          fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
    </span>
  );
}
