import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.env` carries the live Supabase credentials and a real Anthropic key for `pnpm dev`, and
    // dotenv will not overwrite a variable that is already set. Pinning both here keeps the suite
    // offline and deterministic: the write-through mirror in src/db/mirror.ts is inert unless
    // DB_MODE=postgres, and every LLM call resolves to its registered fixture.
    env: { DB_MODE: 'memory', LLM_MOCK: 'true' },
  },
});
