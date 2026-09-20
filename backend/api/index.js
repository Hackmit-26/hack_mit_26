/**
 * Vercel serverless entrypoint.
 *
 * `src/server.ts` only seeds and listens when it is the process entrypoint, so the boot work it
 * does there has to be repeated here: a Fastify instance is built once per warm instance, the
 * working set is hydrated, and every request is handed to the underlying Node server.
 *
 * Imports point at `dist/` because the source uses NodeNext `.js` specifiers, which Vercel's
 * function bundler does not resolve back to `.ts`. `npm run build` fills `dist/` first.
 */
import { config } from '../dist/src/config.js';
import { catalogueFromPostgres, hydrateFromPostgres } from '../dist/src/db/postgres.js';
import { setCatalogue } from '../dist/src/products/catalogue.js';
import { demoModeEnabled, resetDemoState } from '../dist/src/routes/demo.js';
import { buildServer } from '../dist/src/server.js';

/** One boot per warm instance; concurrent cold requests share the same promise. */
let booted = null;

async function boot() {
  const app = await buildServer();

  if (config.DB_MODE === 'postgres') {
    await hydrateFromPostgres();
    setCatalogue(await catalogueFromPostgres());
  } else if (demoModeEnabled()) {
    resetDemoState();
  }

  await app.ready();
  return app;
}

export default async function handler(request, response) {
  booted ??= boot().catch((err) => {
    // A failed hydration must not poison every later request on this instance.
    booted = null;
    throw err;
  });

  const app = await booted;
  app.server.emit('request', request, response);
}
