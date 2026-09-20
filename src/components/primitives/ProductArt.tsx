import type { ArtKind } from "@/lib/types";

/**
 * Original flat illustrations for the product slots, ported from the `Art`
 * artboard. Real merchant imagery, cut out on transparent background, drops
 * into the same slot later.
 */
export function ProductArt({ kind, src }: { kind: ArtKind; src?: string }) {
  if (src) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
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
    <div style={{ width: "100%", height: "100%" }}>
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        style={{ display: "block" }}
        aria-hidden="true"
      >
        <g
          stroke="#141A47"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {shapes[kind]}
        </g>
      </svg>
    </div>
  );
}

const shapes: Record<ArtKind, React.ReactNode> = {
  bag: (
    <>
      <path d="M62 84 C62 22 138 22 138 84" fill="none" strokeWidth="10" />
      <path d="M62 84 C62 22 138 22 138 84" fill="none" stroke="#CF7358" strokeWidth="4" />
      <path d="M38 84 H162 L170 158 Q170 170 158 170 H42 Q30 170 30 158 Z" fill="#B9583F" />
      <path d="M38 84 H162 L156 120 Q100 138 44 120 Z" fill="#CF7358" />
      <rect x="91" y="112" width="18" height="16" rx="4" fill="#F5E39B" />
      <path d="M44 146 H156" fill="none" stroke="#F5ECD9" strokeWidth="2" strokeDasharray="4 6" />
    </>
  ),
  matcha: (
    <>
      <rect x="112" y="14" width="10" height="46" rx="5" fill="#EBB5BD" transform="rotate(10 117 37)" />
      <path d="M58 62 H142 L132 170 Q131 180 121 180 H79 Q69 180 68 170 Z" fill="#F5ECD9" />
      <path d="M63 96 H137 L132 170 Q131 180 121 180 H79 Q69 180 68 170 Z" fill="#A8DCC2" />
      <rect x="52" y="48" width="96" height="16" rx="8" fill="#F5ECD9" />
      <rect x="84" y="112" width="16" height="16" rx="4" fill="#F5ECD9" opacity="0.8" strokeWidth="2" />
      <rect x="102" y="134" width="14" height="14" rx="4" fill="#F5ECD9" opacity="0.8" strokeWidth="2" />
    </>
  ),
  earrings: (
    <>
      <path d="M64 62 V44 a9 9 0 0 1 18 0" fill="none" />
      <path d="M73 62 C46 92 58 132 70 156 C90 130 96 92 73 62 Z" fill="#D9DEEA" />
      <path d="M66 84 C60 104 64 122 68 134" fill="none" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M124 78 V60 a9 9 0 0 1 18 0" fill="none" />
      <path d="M133 78 C112 104 120 140 130 164 C150 140 154 104 133 78 Z" fill="#D9DEEA" />
      <path d="M126 100 C122 116 124 132 127 142" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    </>
  ),
  notebook: (
    <>
      <g transform="rotate(-8 100 100)">
        <rect x="48" y="26" width="104" height="148" rx="10" fill="#BBA9E8" />
        <rect x="48" y="26" width="18" height="148" rx="6" fill="#9F8BD8" />
        <rect x="78" y="52" width="58" height="36" rx="4" fill="#F5ECD9" />
        <path d="M86 66 H126 M86 76 H114" fill="none" strokeWidth="2" />
      </g>
      <rect x="120" y="70" width="12" height="116" rx="5" fill="#F5E39B" transform="rotate(14 126 128)" />
    </>
  ),
  charm: (
    <>
      <path d="M100 14 V70" fill="none" />
      <circle cx="100" cy="30" r="13" fill="#EBB5BD" />
      <circle cx="100" cy="58" r="11" fill="#A8DCC2" />
      <circle cx="100" cy="84" r="13" fill="#F5E39B" />
      <circle cx="100" cy="112" r="10" fill="#BBA9E8" />
      <path d="M100 122 L108 142 L130 144 L112 158 L118 180 L100 167 L82 180 L88 158 L70 144 L92 142 Z" fill="#D9DEEA" />
    </>
  ),
  boots: (
    <>
      <path d="M66 28 H116 V98 C116 108 154 110 172 132 V160 H58 Q52 160 52 154 V40 Q52 28 66 28 Z" fill="#2A2F6B" />
      <rect x="46" y="150" width="134" height="22" rx="8" fill="#F5ECD9" />
      <path d="M66 60 H102 M66 74 H102 M66 88 H102" fill="none" stroke="#F5ECD9" strokeWidth="3" />
    </>
  ),
  lamp: (
    <>
      <circle cx="100" cy="82" r="70" fill="#F5E39B" opacity="0.45" stroke="none" />
      <path d="M84 100 H116 L124 162 H76 Z" fill="#EFE2C8" />
      <path d="M36 104 C36 34 164 34 164 104 Z" fill="#F5ECD9" />
      <circle cx="70" cy="78" r="8" fill="#E8806F" />
      <circle cx="112" cy="62" r="6" fill="#E8806F" />
      <circle cx="136" cy="88" r="7" fill="#E8806F" />
      <rect x="62" y="160" width="76" height="14" rx="7" fill="#141A47" />
    </>
  ),
  cafe: (
    <>
      <rect x="32" y="72" width="136" height="100" fill="#F5ECD9" />
      <path d="M22 72 L34 34 H166 L178 72 Z" fill="#E8806F" />
      <path d="M56 34 L52 72 M78 34 L76 72 M100 34 V72 M122 34 L124 72 M144 34 L148 72" fill="none" stroke="#F5ECD9" strokeWidth="7" />
      <path d="M22 72 L34 34 H166 L178 72 Z" fill="none" />
      <rect x="84" y="104" width="34" height="68" rx="4" fill="#141A47" />
      <rect x="44" y="94" width="30" height="34" rx="4" fill="#A8DCC2" />
      <circle cx="110" cy="142" r="2.5" fill="#F5E39B" stroke="none" />
      <path d="M132 102 H150 V118 Q150 128 141 128 Q132 128 132 118 Z" fill="#F5E39B" />
    </>
  ),
  camera: (
    <>
      <rect x="26" y="66" width="148" height="98" rx="16" fill="#D9DEEA" />
      <path d="M26 92 H174 V148 Q174 164 158 164 H42 Q26 164 26 148 Z" fill="#E8806F" />
      <rect x="62" y="50" width="34" height="18" rx="5" fill="#141A47" />
      <rect x="132" y="76" width="26" height="12" rx="3" fill="#F5E39B" />
      <circle cx="100" cy="122" r="32" fill="#141A47" />
      <circle cx="100" cy="122" r="20" fill="#4A56FF" />
      <circle cx="93" cy="115" r="5" fill="#F5ECD9" stroke="none" />
    </>
  ),
  cabin: (
    <>
      <circle cx="150" cy="40" r="16" fill="#F5E39B" />
      <path d="M20 172 L46 104 L72 172 Z" fill="#A8DCC2" />
      <path d="M132 172 L158 110 L184 172 Z" fill="#A8DCC2" />
      <path d="M44 172 V110 L100 44 L156 110 V172 Z" fill="#F5ECD9" />
      <path d="M32 118 L100 36 L168 118 L156 118 L100 52 L44 118 Z" fill="#E8806F" />
      <rect x="86" y="124" width="28" height="48" rx="4" fill="#141A47" />
      <circle cx="100" cy="90" r="9" fill="#F5E39B" />
      <path d="M14 172 H186" fill="none" />
    </>
  ),
  tin: (
    <>
      <rect x="50" y="62" width="100" height="106" rx="10" fill="#F5E39B" />
      <rect x="44" y="46" width="112" height="24" rx="10" fill="#EFE2C8" />
      <rect x="66" y="92" width="68" height="46" rx="6" fill="#F5ECD9" />
      <path d="M100 98 L104 110 L116 111 L107 118 L110 130 L100 123 L90 130 L93 118 L84 111 L96 110 Z" fill="#E8806F" strokeWidth="2" />
    </>
  ),
  cardcase: (
    <>
      <rect x="70" y="40" width="70" height="46" rx="6" fill="#F5ECD9" transform="rotate(-10 105 63)" />
      <rect x="36" y="64" width="128" height="98" rx="14" fill="#C96B50" />
      <path d="M36 92 H164" fill="none" />
      <path d="M46 150 H154" fill="none" stroke="#F5ECD9" strokeWidth="2" strokeDasharray="4 6" />
      <circle cx="100" cy="120" r="7" fill="#F5E39B" />
    </>
  ),
  claw: (
    <>
      <path d="M34 118 C34 52 166 52 166 118" fill="none" strokeWidth="22" />
      <path d="M34 118 C34 52 166 52 166 118" fill="none" stroke="#EBB5BD" strokeWidth="16" />
      <path d="M46 126 V150 M66 126 V156 M86 126 V160 M106 126 V160 M126 126 V156 M146 126 V150" fill="none" strokeWidth="7" />
      <path d="M46 126 V150 M66 126 V156 M86 126 V160 M106 126 V160 M126 126 V156 M146 126 V150" fill="none" stroke="#EBB5BD" strokeWidth="3" />
      <circle cx="70" cy="76" r="6" fill="#F5ECD9" />
      <circle cx="100" cy="68" r="7" fill="#F5ECD9" />
      <circle cx="130" cy="76" r="6" fill="#F5ECD9" />
    </>
  ),
  whisk: (
    <>
      <path d="M100 20 C84 20 78 44 84 68 L116 68 C122 44 116 20 100 20 Z" fill="#EFE2C8" />
      <path d="M100 22 V66 M91 26 L92 66 M109 26 L108 66" fill="none" strokeWidth="2" />
      <rect x="88" y="66" width="24" height="26" rx="4" fill="#EFE2C8" />
      <path d="M34 100 H166 C166 148 136 172 100 172 C64 172 34 148 34 100 Z" fill="#A8DCC2" />
      <path d="M30 100 H170" fill="none" strokeWidth="5" />
      <ellipse cx="100" cy="112" rx="50" ry="6" fill="#8CC9A8" stroke="none" />
    </>
  ),
  tote: (
    <>
      <path d="M64 74 C64 20 136 20 136 74" fill="none" strokeWidth="9" />
      <path d="M64 74 C64 20 136 20 136 74" fill="none" stroke="#EFE2C8" strokeWidth="4" />
      <path d="M36 72 H164 L158 168 H42 Z" fill="#F5ECD9" />
      <path d="M62 106 H138 M62 122 H120 M62 138 H130" fill="none" stroke="#141A47" strokeWidth="5" />
      <rect x="104" y="146" width="22" height="8" fill="#E8806F" stroke="none" />
    </>
  ),
  planner: (
    <>
      <rect x="44" y="26" width="112" height="148" rx="10" fill="#F5E39B" />
      <path d="M44 56 H156 M44 86 H156 M44 116 H156 M44 146 H156" fill="none" strokeWidth="1.5" opacity="0.5" />
      <rect x="34" y="44" width="22" height="9" rx="4" fill="#D9DEEA" />
      <rect x="34" y="84" width="22" height="9" rx="4" fill="#D9DEEA" />
      <rect x="34" y="124" width="22" height="9" rx="4" fill="#D9DEEA" />
      <circle cx="112" cy="70" r="14" fill="#E8806F" />
      <path d="M76 104 H140 M76 128 H124" fill="none" strokeWidth="4" />
    </>
  ),
  knit: (
    <>
      <path d="M62 38 L38 56 L18 112 L44 122 L56 94 V168 H144 V94 L156 122 L182 112 L162 56 L138 38 Q100 64 62 38 Z" fill="#EFE2C8" />
      <path d="M62 38 Q100 64 138 38" fill="none" />
      <path d="M56 154 H144 M56 146 H144" fill="none" strokeWidth="2" opacity="0.6" />
      <path d="M30 92 L44 96 M170 92 L156 96" fill="none" strokeWidth="2" opacity="0.6" />
    </>
  ),
  serum: (
    <>
      <path d="M88 54 C88 20 112 20 112 54" fill="#EBB5BD" />
      <rect x="84" y="50" width="32" height="26" rx="6" fill="#141A47" />
      <rect x="66" y="74" width="68" height="98" rx="14" fill="#F5ECD9" />
      <rect x="66" y="112" width="68" height="60" rx="12" fill="#A8DCC2" />
      <rect x="78" y="86" width="44" height="18" rx="3" fill="#F5ECD9" strokeWidth="2" />
      <path d="M84 95 H116" fill="none" strokeWidth="2" />
    </>
  ),
  ring: (
    <>
      <ellipse cx="100" cy="148" rx="52" ry="15" fill="none" strokeWidth="15" />
      <ellipse cx="100" cy="148" rx="52" ry="15" fill="none" stroke="#D9DEEA" strokeWidth="9" />
      <ellipse cx="100" cy="116" rx="46" ry="14" fill="none" strokeWidth="15" />
      <ellipse cx="100" cy="116" rx="46" ry="14" fill="none" stroke="#D9DEEA" strokeWidth="9" />
      <ellipse cx="100" cy="86" rx="40" ry="12" fill="none" strokeWidth="15" />
      <ellipse cx="100" cy="86" rx="40" ry="12" fill="none" stroke="#D9DEEA" strokeWidth="9" />
      <path d="M100 44 L106 58 L120 60 L110 69 L113 83 L100 76 L87 83 L90 69 L80 60 L94 58 Z" fill="#F5E39B" strokeWidth="2.4" />
    </>
  ),
  sneaker: (
    <>
      <path d="M20 140 H182 Q190 140 190 148 V154 Q190 164 180 164 H30 Q20 164 20 154 Z" fill="#E5C9A0" />
      <path d="M26 140 V90 C26 80 34 74 44 76 L72 84 L94 62 L110 68 C112 94 140 98 170 110 C184 116 188 128 188 140 Z" fill="#F5ECD9" />
      <path d="M150 108 C172 114 186 122 188 140 H148 Z" fill="#141A47" />
      <path d="M26 104 C40 100 56 112 60 140 H26 Z" fill="#141A47" />
      <path d="M96 76 L120 132 M110 76 L136 128 M124 80 L152 124" fill="none" strokeWidth="6" />
      <path d="M78 84 L92 94 M86 78 L100 88" fill="none" strokeWidth="2.5" />
    </>
  ),
  sneaker2: (
    <>
      <path d="M20 140 H182 Q190 140 190 148 V154 Q190 164 180 164 H30 Q20 164 20 154 Z" fill="#F5ECD9" />
      <path d="M26 140 V90 C26 80 34 74 44 76 L72 84 L94 62 L110 68 C112 94 140 98 170 110 C184 116 188 128 188 140 Z" fill="#EBB5BD" />
      <path d="M26 104 C40 100 56 112 60 140 H26 Z" fill="#BBA9E8" />
      <path d="M96 76 L120 132 M110 76 L136 128 M124 80 L152 124" fill="none" stroke="#F5ECD9" strokeWidth="6" />
      <path d="M78 84 L92 94 M86 78 L100 88" fill="none" strokeWidth="2.5" />
    </>
  ),
  tube: (
    <>
      <rect x="76" y="76" width="48" height="94" rx="16" fill="#E8806F" />
      <rect x="72" y="32" width="56" height="52" rx="14" fill="#F5E39B" />
      <rect x="88" y="110" width="24" height="34" rx="4" fill="#F5ECD9" strokeWidth="2" />
      <path d="M84 46 V66" fill="none" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M148 60 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 z" fill="#F5E39B" strokeWidth="2" />
    </>
  ),
  film: (
    <>
      <rect x="36" y="78" width="58" height="86" rx="8" fill="#2A2F6B" />
      <rect x="42" y="68" width="46" height="14" rx="4" fill="#D9DEEA" />
      <rect x="43" y="100" width="44" height="38" fill="#F5E39B" strokeWidth="2" />
      <path d="M50 112 H80 M50 122 H72" fill="none" strokeWidth="2" />
      <rect x="104" y="96" width="58" height="70" rx="8" fill="#2A2F6B" />
      <rect x="110" y="86" width="46" height="14" rx="4" fill="#D9DEEA" />
      <rect x="111" y="116" width="44" height="30" fill="#EBB5BD" strokeWidth="2" />
      <path d="M118 128 H148" fill="none" strokeWidth="2" />
    </>
  ),
  mug: (
    <>
      <path d="M60 88 L78 46 H114 L132 88 Z" fill="#EFE2C8" />
      <path d="M96 96 V108" fill="none" stroke="#C4553F" strokeWidth="4" />
      <path d="M52 92 H140 V132 Q140 164 108 164 H84 Q52 164 52 132 Z" fill="#F5ECD9" />
      <path d="M140 104 H154 Q170 104 170 122 Q170 140 154 140 H138" fill="none" strokeWidth="10" />
      <path d="M140 104 H154 Q170 104 170 122 Q170 140 154 140 H138" fill="none" stroke="#F5ECD9" strokeWidth="4" />
      <path d="M76 32 q6 -10 0 -18 M100 30 q6 -10 0 -18" fill="none" strokeWidth="2.6" />
    </>
  ),
  necklace: (
    <>
      <path d="M38 36 C38 150 162 150 162 36" fill="none" strokeWidth="8" />
      <path d="M38 36 C38 150 162 150 162 36" fill="none" stroke="#D9DEEA" strokeWidth="3.6" strokeDasharray="6 3" />
      <circle cx="100" cy="142" r="20" fill="#D9DEEA" />
      <circle cx="100" cy="142" r="7" fill="#F5E39B" strokeWidth="2.4" />
      <path d="M90 130 Q96 126 104 128" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    </>
  ),
};
