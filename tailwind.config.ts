import type { Config } from "tailwindcss";

// Tokens mirror the "Design system and page shell" artboard exactly.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#0B0F2A",
        navy: "#141A47",
        cream: "#F5ECD9",
        coral: "#E8806F",
        coralInk: "#C4553F",
        coralDeep: "#B8412F",
        pink: "#EBB5BD",
        lavender: "#BBA9E8",
        mint: "#A8DCC2",
        yellow: "#F5E39B",
        electric: "#4A56FF",
        queen: "#D6455A",
        paper: "#FBF6EA",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;
