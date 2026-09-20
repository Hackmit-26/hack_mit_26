import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `.env` carries the live Supabase credentials for `pnpm dev`, and dotenv will not overwrite
    // a variable that is already set. Pinning memory mode here keeps the suite offline: the
    // write-through mirror in src/db/mirror.ts is inert unless DB_MODE=postgres.
    env: { DB_MODE: 'memory' },
  },
});
