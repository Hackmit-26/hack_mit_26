import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Component tests are the only TSX vitest compiles; Next owns JSX elsewhere.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // The extension is plain JS with no build step; its tests drive jsdom themselves.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "extension/test/*.test.js"],
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    coverage: {
      provider: "v8",
      include: ["src/lib/api.ts", "src/lib/config.ts"],
    },
  },
});
