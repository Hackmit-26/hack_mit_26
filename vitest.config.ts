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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    coverage: {
      provider: "v8",
      include: ["src/lib/api.ts", "src/lib/config.ts"],
    },
  },
});
