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
  filmroll: (
    <>
      <path d="M118 62 H176 V150 H118 Z" fill="#EFE2C8" />
      <path d="M124 70 H170 M124 142 H170" fill="none" strokeWidth="2" />
      <rect x="128" y="80" width="14" height="52" fill="#141A47" stroke="none" />
      <rect x="152" y="80" width="14" height="52" fill="#141A47" stroke="none" />
      <rect x="44" y="52" width="76" height="108" rx="12" fill="#E8806F" />
      <rect x="44" y="80" width="76" height="52" fill="#F5ECD9" />
      <path d="M56 92 H108 M56 106 H90" fill="none" strokeWidth="3" />
      <rect x="70" y="34" width="24" height="22" rx="4" fill="#D9DEEA" />
    </>
  ),
  frame: (
    <>
      <rect x="30" y="34" width="140" height="132" rx="8" fill="#C96B50" />
      <rect x="46" y="50" width="108" height="100" fill="#F5ECD9" />
      <circle cx="122" cy="74" r="10" fill="#F5E39B" />
      <path d="M46 150 L86 96 L114 150 Z" fill="#A8DCC2" />
      <path d="M96 150 L128 108 L154 150 Z" fill="#2A2F6B" />
      <path d="M46 150 H154" fill="none" strokeWidth="2" />
    </>
  ),
  book: (
    <>
      <path d="M40 40 H140 Q152 40 152 52 V168 H52 Q40 168 40 156 Z" fill="#BBA9E8" />
      <path d="M40 40 H66 V168 H52 Q40 168 40 156 Z" fill="#9F8BD8" />
      <rect x="82" y="66" width="52" height="40" rx="4" fill="#F5ECD9" />
      <path d="M90 82 H126 M90 94 H114" fill="none" strokeWidth="2" />
      <path d="M82 130 H134 M82 146 H118" fill="none" stroke="#F5ECD9" strokeWidth="4" />
      <path d="M152 52 H166 V148 L159 138 L152 148 Z" fill="#E8806F" />
    </>
  ),
  denim: (
    <>
      <path d="M72 34 L34 56 L46 112 L68 106 V170 H132 V106 L154 112 L166 56 L128 34 L100 62 Z" fill="#4A56FF" />
      <path d="M72 34 L100 62 L128 34" fill="none" />
      <path d="M86 70 V166 M114 70 V166" fill="none" stroke="#F5E39B" strokeWidth="2.5" strokeDasharray="6 5" />
      <rect x="72" y="86" width="14" height="18" rx="3" fill="#2A2F6B" />
      <rect x="114" y="86" width="14" height="18" rx="3" fill="#2A2F6B" />
      <path d="M46 112 L68 106 M154 112 L132 106" fill="none" strokeWidth="2" />
    </>
  ),
  perfume: (
    <>
      <rect x="86" y="30" width="28" height="26" rx="4" fill="#141A47" />
      <rect x="62" y="54" width="76" height="116" rx="14" fill="#F5ECD9" />
      <rect x="62" y="104" width="76" height="66" rx="12" fill="#C96B50" />
      <rect x="78" y="118" width="44" height="34" rx="4" fill="#F5E39B" strokeWidth="2" />
      <circle cx="152" cy="64" r="16" fill="#EBB5BD" />
      <path d="M138 64 H120" fill="none" strokeWidth="4" />
      <path d="M92 76 H108" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    </>
  ),
  synth: (
    <>
      <rect x="20" y="58" width="160" height="88" rx="10" fill="#D9DEEA" />
      <rect x="20" y="58" width="160" height="32" rx="10" fill="#E8806F" />
      <circle cx="44" cy="74" r="8" fill="#F5E39B" />
      <circle cx="72" cy="74" r="8" fill="#F5ECD9" />
      <circle cx="100" cy="74" r="8" fill="#F5E39B" />
      <path d="M126 82 H166" fill="none" strokeWidth="5" />
      <rect x="28" y="96" width="144" height="42" fill="#F5ECD9" />
      <path d="M52 96 V138 M76 96 V138 M100 96 V138 M124 96 V138 M148 96 V138" fill="none" strokeWidth="2.5" />
      <rect x="42" y="96" width="12" height="24" fill="#141A47" stroke="none" />
      <rect x="66" y="96" width="12" height="24" fill="#141A47" stroke="none" />
      <rect x="114" y="96" width="12" height="24" fill="#141A47" stroke="none" />
      <rect x="138" y="96" width="12" height="24" fill="#141A47" stroke="none" />
    </>
  ),
  eurorack: (
    <>
      <rect x="26" y="40" width="148" height="120" rx="8" fill="#2A2F6B" />
      <rect x="38" y="56" width="36" height="88" rx="4" fill="#F5ECD9" />
      <rect x="82" y="56" width="36" height="88" rx="4" fill="#EBB5BD" />
      <rect x="126" y="56" width="36" height="88" rx="4" fill="#A8DCC2" />
      <circle cx="56" cy="76" r="7" fill="#F5E39B" />
      <circle cx="100" cy="76" r="7" fill="#F5E39B" />
      <circle cx="144" cy="76" r="7" fill="#F5E39B" />
      <circle cx="56" cy="124" r="4" fill="#141A47" />
      <circle cx="100" cy="124" r="4" fill="#141A47" />
      <circle cx="144" cy="124" r="4" fill="#141A47" />
      <path d="M56 124 C56 160 100 160 100 124" fill="none" stroke="#E8806F" strokeWidth="4" />
    </>
  ),
  cable: (
    <>
      <path d="M46 40 V70 C46 96 154 104 154 130 V160" fill="none" stroke="#4A56FF" strokeWidth="12" />
      <path d="M46 40 V70 C46 96 154 104 154 130 V160" fill="none" strokeWidth="3" />
      <rect x="32" y="20" width="28" height="30" rx="6" fill="#D9DEEA" />
      <rect x="38" y="10" width="16" height="14" rx="3" fill="#141A47" />
      <rect x="140" y="150" width="28" height="30" rx="6" fill="#D9DEEA" />
      <rect x="146" y="176" width="16" height="14" rx="3" fill="#141A47" />
      <circle cx="96" cy="94" r="7" fill="#F5E39B" />
    </>
  ),
  pedal: (
    <>
      <rect x="34" y="44" width="132" height="120" rx="12" fill="#A8DCC2" />
      <rect x="52" y="112" width="96" height="40" rx="8" fill="#F5ECD9" />
      <circle cx="68" cy="76" r="14" fill="#F5ECD9" />
      <path d="M68 76 L68 64" fill="none" strokeWidth="3" />
      <circle cx="132" cy="76" r="14" fill="#F5ECD9" />
      <path d="M132 76 L142 68" fill="none" strokeWidth="3" />
      <rect x="88" y="62" width="24" height="28" rx="4" fill="#E8806F" />
      <circle cx="100" cy="132" r="11" fill="#141A47" />
      <circle cx="100" cy="132" r="4" fill="#F5E39B" stroke="none" />
    </>
  ),
  keyboard: (
    <>
      <rect x="18" y="62" width="164" height="82" rx="12" fill="#2A2F6B" />
      <rect x="18" y="62" width="164" height="16" rx="8" fill="#4A56FF" />
      <rect x="30" y="86" width="20" height="20" rx="4" fill="#F5ECD9" />
      <rect x="56" y="86" width="20" height="20" rx="4" fill="#F5ECD9" />
      <rect x="82" y="86" width="20" height="20" rx="4" fill="#E8806F" />
      <rect x="108" y="86" width="20" height="20" rx="4" fill="#F5ECD9" />
      <rect x="134" y="86" width="20" height="20" rx="4" fill="#F5ECD9" />
      <rect x="30" y="114" width="20" height="20" rx="4" fill="#F5ECD9" />
      <rect x="56" y="114" width="72" height="20" rx="4" fill="#F5E39B" />
      <rect x="134" y="114" width="20" height="20" rx="4" fill="#F5ECD9" />
    </>
  ),
  solder: (
    <>
      <path d="M150 28 L178 56 L92 142 L56 158 L70 122 Z" fill="#D9DEEA" />
      <path d="M92 142 L56 158 L70 122 Z" fill="#E8806F" />
      <path d="M120 58 L148 86" fill="none" strokeWidth="3" />
      <path d="M56 158 L44 172" fill="none" stroke="#F5E39B" strokeWidth="6" />
      <path d="M22 66 q12 -14 24 0 q12 14 24 0" fill="none" strokeWidth="3" opacity="0.7" />
      <path d="M22 44 q12 -14 24 0 q12 14 24 0" fill="none" strokeWidth="3" opacity="0.5" />
    </>
  ),
  headphones: (
    <>
      <path d="M40 116 V100 C40 66 68 40 100 40 C132 40 160 66 160 100 V116" fill="none" strokeWidth="12" />
      <path d="M40 116 V100 C40 66 68 40 100 40 C132 40 160 66 160 100 V116" fill="none" stroke="#F5E39B" strokeWidth="5" />
      <rect x="20" y="106" width="42" height="62" rx="16" fill="#E8806F" />
      <rect x="138" y="106" width="42" height="62" rx="16" fill="#E8806F" />
      <rect x="30" y="118" width="22" height="38" rx="11" fill="#F5ECD9" />
      <rect x="148" y="118" width="22" height="38" rx="11" fill="#F5ECD9" />
    </>
  ),
  turntable: (
    <>
      <rect x="18" y="52" width="164" height="112" rx="10" fill="#EFE2C8" />
      <circle cx="88" cy="108" r="48" fill="#141A47" />
      <circle cx="88" cy="108" r="22" fill="#E8806F" />
      <circle cx="88" cy="108" r="4" fill="#F5ECD9" stroke="none" />
      <circle cx="88" cy="108" r="36" fill="none" stroke="#F5ECD9" strokeWidth="2" />
      <circle cx="158" cy="72" r="8" fill="#D9DEEA" />
      <path d="M158 72 L128 130" fill="none" strokeWidth="5" />
      <rect x="120" y="126" width="16" height="12" rx="3" fill="#F5E39B" />
    </>
  ),
  arcade: (
    <>
      <rect x="22" y="86" width="156" height="82" rx="12" fill="#2A2F6B" />
      <path d="M62 96 V56" fill="none" strokeWidth="10" />
      <circle cx="62" cy="44" r="18" fill="#E8806F" />
      <circle cx="120" cy="108" r="12" fill="#F5E39B" />
      <circle cx="152" cy="108" r="12" fill="#EBB5BD" />
      <circle cx="120" cy="140" r="12" fill="#A8DCC2" />
      <circle cx="152" cy="140" r="12" fill="#D9DEEA" />
      <circle cx="62" cy="140" r="9" fill="#F5ECD9" />
    </>
  ),
  watch: (
    <>
      <rect x="72" y="14" width="56" height="60" rx="10" fill="#2A2F6B" />
      <rect x="72" y="128" width="56" height="60" rx="10" fill="#2A2F6B" />
      <circle cx="100" cy="100" r="54" fill="#141A47" />
      <circle cx="100" cy="100" r="42" fill="#A8DCC2" />
      <path d="M100 100 V74 M100 100 L122 112" fill="none" strokeWidth="4" />
      <circle cx="100" cy="100" r="4" fill="#141A47" stroke="none" />
      <rect x="150" y="90" width="12" height="20" rx="4" fill="#E8806F" />
    </>
  ),
  socks: (
    <>
      <path d="M44 24 H86 V104 C86 124 106 128 106 150 C106 166 92 176 76 176 C58 176 46 164 46 148 V104 Z" fill="#EBB5BD" />
      <path d="M44 24 H86 V48 H44 Z" fill="#F5ECD9" />
      <path d="M114 44 H156 V120 C156 138 176 142 176 162 C176 176 164 184 150 184" fill="#A8DCC2" />
      <path d="M114 44 H156 V66 H114 Z" fill="#F5ECD9" />
      <path d="M52 132 H84 M120 148 H152" fill="none" strokeWidth="2.5" opacity="0.6" />
    </>
  ),
  flask: (
    <>
      <rect x="86" y="14" width="28" height="22" rx="5" fill="#141A47" />
      <rect x="74" y="30" width="52" height="26" rx="8" fill="#D9DEEA" />
      <rect x="58" y="52" width="84" height="134" rx="18" fill="#4A56FF" />
      <rect x="58" y="96" width="84" height="46" fill="#F5ECD9" />
      <path d="M72 112 H128" fill="none" strokeWidth="3" />
      <path d="M72 126 H110" fill="none" strokeWidth="3" />
      <path d="M142 78 H160 Q170 78 170 90 V104" fill="none" strokeWidth="5" />
    </>
  ),
  sunglasses: (
    <>
      <path d="M14 72 H186" fill="none" strokeWidth="7" />
      <path d="M22 72 H92 V106 C92 128 22 128 22 96 Z" fill="#2A2F6B" />
      <path d="M108 72 H178 V96 C178 128 108 128 108 106 Z" fill="#2A2F6B" />
      <path d="M92 78 H108" fill="none" strokeWidth="6" />
      <path d="M30 82 L46 82 M120 82 L136 82" fill="none" stroke="#F5E39B" strokeWidth="4" />
      <path d="M14 72 L26 58 M186 72 L174 58" fill="none" strokeWidth="5" />
    </>
  ),
  tent: (
    <>
      <path d="M100 30 L172 164 H28 Z" fill="#E8806F" />
      <path d="M100 30 L100 164" fill="none" />
      <path d="M100 54 L74 164 H126 Z" fill="#F5ECD9" />
      <path d="M100 30 V16" fill="none" strokeWidth="4" />
      <path d="M20 164 H180" fill="none" strokeWidth="4" />
      <circle cx="46" cy="44" r="8" fill="#F5E39B" />
      <path d="M146 40 L150 52 L162 52 L152 60 L156 72 L146 64 L136 72 L140 60 L130 52 L142 52 Z" fill="#F5E39B" strokeWidth="2" />
    </>
  ),
  yogamat: (
    <>
      <path d="M52 40 H150 Q170 40 170 74 Q170 108 150 108 H52 Z" fill="#BBA9E8" />
      <ellipse cx="52" cy="74" rx="20" ry="34" fill="#9F8BD8" />
      <ellipse cx="52" cy="74" rx="8" ry="14" fill="#F5ECD9" />
      <path d="M58 132 H164" fill="none" strokeWidth="10" />
      <path d="M58 132 H164" fill="none" stroke="#A8DCC2" strokeWidth="4" />
      <path d="M40 150 C70 168 130 168 162 150" fill="none" strokeWidth="3" strokeDasharray="6 6" />
    </>
  ),
  headlamp: (
    <>
      <path d="M104 96 L186 44 V148 Z" fill="#F5E39B" opacity="0.5" stroke="none" />
      <path d="M44 96 C44 62 20 62 20 96 C20 130 44 130 44 96 Z" fill="#D9DEEA" />
      <rect x="40" y="52" width="68" height="88" rx="16" fill="#E8806F" />
      <circle cx="98" cy="96" r="26" fill="#F5ECD9" />
      <circle cx="98" cy="96" r="12" fill="#F5E39B" />
      <path d="M130 70 H154 M130 96 H162 M130 122 H154" fill="none" strokeWidth="3" />
    </>
  ),
  skillet: (
    <>
      <path d="M22 92 H140 V116 C140 148 114 166 81 166 C48 166 22 148 22 116 Z" fill="#2A2F6B" />
      <ellipse cx="81" cy="92" rx="59" ry="16" fill="#3A4180" />
      <ellipse cx="81" cy="92" rx="44" ry="10" fill="#141A47" stroke="none" />
      <path d="M138 96 L180 62" fill="none" strokeWidth="14" />
      <path d="M138 96 L180 62" fill="none" stroke="#2A2F6B" strokeWidth="7" />
      <circle cx="177" cy="60" r="5" fill="#F5ECD9" />
    </>
  ),
  pot: (
    <>
      <path d="M34 78 H166 V134 C166 158 142 172 100 172 C58 172 34 158 34 134 Z" fill="#E8806F" />
      <rect x="24" y="60" width="152" height="22" rx="10" fill="#C4553F" />
      <rect x="88" y="38" width="24" height="24" rx="8" fill="#141A47" />
      <path d="M24 74 H10 M176 74 H190" fill="none" strokeWidth="8" />
      <path d="M52 140 H148" fill="none" stroke="#F5ECD9" strokeWidth="3" strokeDasharray="5 7" />
    </>
  ),
  knife: (
    <>
      <path d="M20 112 C60 52 120 40 150 40 L150 112 Z" fill="#D9DEEA" />
      <path d="M24 112 C62 62 118 50 148 50" fill="none" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M150 34 H180 Q188 34 188 44 V108 Q188 118 180 118 H150 Z" fill="#2A2F6B" />
      <circle cx="162" cy="76" r="5" fill="#F5E39B" />
      <path d="M20 112 H150" fill="none" strokeWidth="4" />
      <path d="M40 146 H160" fill="none" stroke="#C96B50" strokeWidth="10" />
    </>
  ),
  bottle: (
    <>
      <rect x="88" y="16" width="24" height="18" rx="4" fill="#141A47" />
      <path d="M90 32 H110 V66 L134 100 V168 Q134 180 122 180 H78 Q66 180 66 168 V100 L90 66 Z" fill="#A8DCC2" />
      <path d="M66 112 H134 V150 H66 Z" fill="#F5ECD9" />
      <path d="M78 126 H122 M78 138 H108" fill="none" strokeWidth="2.5" />
      <path d="M96 76 V96" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    </>
  ),
  plant: (
    <>
      <path d="M100 108 C60 100 52 56 58 32 C88 40 102 70 100 108 Z" fill="#A8DCC2" />
      <path d="M100 108 C138 96 146 58 140 36 C112 46 98 74 100 108 Z" fill="#8CC9A8" />
      <path d="M100 108 V64" fill="none" strokeWidth="3" />
      <path d="M58 104 H142 L130 156 Q129 164 120 164 H80 Q71 164 70 156 Z" fill="#C96B50" />
      <path d="M52 96 H148 V110 H52 Z" fill="#E8806F" />
      <path d="M62 166 H138 V178 H62 Z" fill="#C96B50" />
    </>
  ),
  bread: (
    <>
      <path d="M26 132 C26 78 60 48 100 48 C140 48 174 78 174 132 Q174 152 152 152 H48 Q26 152 26 132 Z" fill="#EFE2C8" />
      <path d="M62 116 C74 96 90 88 108 86" fill="none" strokeWidth="5" />
      <path d="M88 122 C100 100 118 92 136 92" fill="none" strokeWidth="5" />
      <path d="M26 152 H174" fill="none" strokeWidth="4" />
      <path d="M40 170 H160" fill="none" stroke="#C96B50" strokeWidth="8" />
      <circle cx="152" cy="46" r="7" fill="#F5E39B" />
    </>
  ),
  mokapot: (
    <>
      <path d="M62 104 H138 L128 170 H72 Z" fill="#C96B50" />
      <path d="M66 98 H134 L128 60 H72 Z" fill="#E8806F" />
      <path d="M58 98 H142" fill="none" strokeWidth="5" />
      <path d="M72 60 H104 L100 34 H76 Z" fill="#141A47" />
      <path d="M134 78 L162 62 L158 78 Z" fill="#141A47" />
      <path d="M138 110 H162 Q172 110 172 124 Q172 140 158 140 H136" fill="none" strokeWidth="9" />
      <rect x="86" y="24" width="28" height="12" rx="5" fill="#F5E39B" />
    </>
  ),
  jeans: (
    <>
      <path d="M56 26 H144 L138 174 H108 L100 96 L92 174 H62 Z" fill="#4A56FF" />
      <path d="M56 26 H144 V44 H56 Z" fill="#2A2F6B" />
      <path d="M100 96 L92 174 M100 96 L108 174" fill="none" />
      <path d="M68 58 H88 V76 H68 Z" fill="none" stroke="#F5E39B" strokeWidth="2.5" />
      <path d="M112 58 H132 V76 H112 Z" fill="none" stroke="#F5E39B" strokeWidth="2.5" />
      <circle cx="100" cy="35" r="5" fill="#F5E39B" />
    </>
  ),
  tee: (
    <>
      <path d="M76 32 L30 58 L46 96 L66 86 V170 H134 V86 L154 96 L170 58 L124 32 Q100 54 76 32 Z" fill="#F5ECD9" />
      <path d="M76 32 Q100 54 124 32" fill="none" />
      <circle cx="100" cy="116" r="22" fill="#E8806F" />
      <path d="M66 156 H134" fill="none" strokeWidth="2" opacity="0.5" />
    </>
  ),
  groovebox: (
    <>
      <rect x="30" y="46" width="140" height="110" rx="12" fill="#F5E39B" />
      <rect x="44" y="60" width="112" height="26" rx="4" fill="#141A47" />
      <path d="M54 74 H86 M96 74 H120" fill="none" stroke="#A8DCC2" strokeWidth="3" />
      <rect x="44" y="98" width="24" height="24" rx="4" fill="#F5ECD9" />
      <rect x="76" y="98" width="24" height="24" rx="4" fill="#E8806F" />
      <rect x="108" y="98" width="24" height="24" rx="4" fill="#F5ECD9" />
      <rect x="44" y="128" width="24" height="18" rx="4" fill="#F5ECD9" />
      <rect x="76" y="128" width="24" height="18" rx="4" fill="#F5ECD9" />
      <rect x="108" y="128" width="24" height="18" rx="4" fill="#EBB5BD" />
      <circle cx="152" cy="120" r="12" fill="#BBA9E8" />
    </>
  ),
  keycap: (
    <>
      <path d="M44 96 L70 70 H134 L160 96 V134 L134 160 H70 L44 134 Z" fill="#EBB5BD" />
      <path d="M70 70 H134 L160 96 H70 Z" fill="#F5ECD9" />
      <path d="M70 70 V96 L44 96" fill="none" />
      <path d="M70 96 H160 M70 96 V160" fill="none" />
      <path d="M96 118 L112 118 M104 110 V134" fill="none" stroke="#141A47" strokeWidth="4" />
      <path d="M50 52 L74 28 H126 L104 52 Z" fill="#A8DCC2" />
    </>
  ),
  switch: (
    <>
      <path d="M52 92 H148 L162 150 H38 Z" fill="#D9DEEA" />
      <rect x="82" y="46" width="36" height="50" rx="6" fill="#E8806F" />
      <path d="M92 58 V84 M108 58 V84" fill="none" stroke="#F5ECD9" strokeWidth="4" />
      <path d="M64 150 V172 M136 150 V172" fill="none" strokeWidth="6" />
      <path d="M64 150 V172 M136 150 V172" fill="none" stroke="#F5E39B" strokeWidth="2.5" />
      <circle cx="100" cy="122" r="7" fill="#F5ECD9" />
    </>
  ),
  roller: (
    <>
      <path d="M52 52 H148 Q172 52 172 100 Q172 148 148 148 H52 Z" fill="#A8DCC2" />
      <ellipse cx="52" cy="100" rx="24" ry="48" fill="#8CC9A8" />
      <ellipse cx="52" cy="100" rx="9" ry="18" fill="#141A47" />
      <path d="M78 52 V148 M104 52 V148 M130 52 V148" fill="none" strokeWidth="3" opacity="0.7" />
      <rect x="86" y="72" width="14" height="14" rx="3" fill="#F5ECD9" strokeWidth="2" />
      <rect x="112" y="112" width="14" height="14" rx="3" fill="#F5ECD9" strokeWidth="2" />
    </>
  ),
  massager: (
    <>
      <circle cx="132" cy="62" r="34" fill="#E8806F" />
      <circle cx="132" cy="62" r="16" fill="#F5ECD9" />
      <path d="M120 88 L74 152" fill="none" strokeWidth="18" />
      <path d="M120 88 L74 152" fill="none" stroke="#2A2F6B" strokeWidth="10" />
      <rect x="40" y="132" width="44" height="46" rx="12" fill="#D9DEEA" transform="rotate(-36 62 155)" />
      <circle cx="58" cy="150" r="5" fill="#F5E39B" />
    </>
  ),
  sandal: (
    <>
      <path d="M26 118 C26 96 52 88 100 88 C148 88 174 96 174 118 C174 146 144 162 100 162 C56 162 26 146 26 118 Z" fill="#EFE2C8" />
      <path d="M30 132 C50 152 150 152 170 132" fill="none" strokeWidth="2.5" />
      <path d="M40 106 C64 62 136 62 160 106" fill="none" strokeWidth="18" />
      <path d="M40 106 C64 62 136 62 160 106" fill="none" stroke="#BBA9E8" strokeWidth="9" />
      <circle cx="100" cy="72" r="7" fill="#F5E39B" />
    </>
  ),
  poles: (
    <>
      <path d="M62 24 L34 172" fill="none" strokeWidth="9" />
      <path d="M62 24 L34 172" fill="none" stroke="#D9DEEA" strokeWidth="4" />
      <rect x="48" y="14" width="28" height="24" rx="8" fill="#E8806F" transform="rotate(-11 62 26)" />
      <path d="M26 148 L50 154" fill="none" strokeWidth="4" />
      <path d="M126 24 L154 172" fill="none" strokeWidth="9" />
      <path d="M126 24 L154 172" fill="none" stroke="#D9DEEA" strokeWidth="4" />
      <rect x="112" y="14" width="28" height="24" rx="8" fill="#E8806F" transform="rotate(11 126 26)" />
      <path d="M138 154 L162 148" fill="none" strokeWidth="4" />
    </>
  ),
  plate: (
    <>
      <ellipse cx="100" cy="146" rx="76" ry="22" fill="#D9DEEA" />
      <ellipse cx="100" cy="116" rx="70" ry="20" fill="#F5ECD9" />
      <ellipse cx="100" cy="88" rx="62" ry="18" fill="#EFE2C8" />
      <ellipse cx="100" cy="60" rx="54" ry="16" fill="#F5ECD9" />
      <ellipse cx="100" cy="60" rx="30" ry="8" fill="none" stroke="#E8806F" strokeWidth="2.5" />
    </>
  ),
  grinder: (
    <>
      <path d="M62 84 H138 V158 Q138 170 126 170 H74 Q62 170 62 158 Z" fill="#C96B50" />
      <rect x="54" y="66" width="92" height="22" rx="8" fill="#D9DEEA" />
      <path d="M100 66 V38" fill="none" strokeWidth="6" />
      <path d="M100 38 H146" fill="none" strokeWidth="6" />
      <circle cx="150" cy="38" r="10" fill="#141A47" />
      <path d="M78 118 H122" fill="none" stroke="#F5ECD9" strokeWidth="3" strokeDasharray="5 6" />
      <circle cx="100" cy="144" r="10" fill="#F5E39B" />
    </>
  ),
  instant: (
    <>
      <path d="M30 56 H170 Q180 56 180 68 V150 Q180 162 170 162 H30 Q20 162 20 150 V68 Q20 56 30 56 Z" fill="#F5ECD9" />
      <path d="M20 84 H180 V118 H20 Z" fill="#E8806F" />
      <path d="M20 122 H180 V150 Q180 162 170 162 H30 Q20 162 20 150 Z" fill="#D9DEEA" />
      <circle cx="100" cy="101" r="26" fill="#141A47" />
      <circle cx="100" cy="101" r="14" fill="#4A56FF" />
      <rect x="38" y="66" width="22" height="12" rx="3" fill="#F5E39B" />
      <rect x="52" y="138" width="96" height="42" rx="4" fill="#F5ECD9" />
      <rect x="60" y="146" width="80" height="26" fill="#A8DCC2" strokeWidth="2" />
    </>
  ),
  wok: (
    <>
      <path d="M16 74 H184 C184 132 147 166 100 166 C53 166 16 132 16 74 Z" fill="#2A2F6B" />
      <ellipse cx="100" cy="74" rx="84" ry="18" fill="#3A4180" />
      <ellipse cx="100" cy="74" rx="62" ry="11" fill="#141A47" stroke="none" />
      <path d="M22 62 C4 56 4 40 22 36" fill="none" strokeWidth="9" />
      <path d="M178 62 C196 56 196 40 178 36" fill="none" strokeWidth="9" />
      <path d="M62 108 q38 26 76 0" fill="none" stroke="#F5E39B" strokeWidth="3" />
    </>
  ),
};
