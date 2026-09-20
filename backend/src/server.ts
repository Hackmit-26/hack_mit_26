import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { verifyUser } from './auth/verifyUser.js';
import { config } from './config.js';
import { catalogueFromPostgres, hydrateFromPostgres } from './db/postgres.js';
import { startJobs } from './jobs/scheduler.js';
import { setCatalogue } from './products/catalogue.js';
import { AppError } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { demoModeEnabled, resetDemoState } from './routes/demo.js';
import { registerRoutes } from './routes/index.js';

// /demo/reset is public because it wipes the users you would authenticate against; it is
// already inert unless DEMO_MODE=true, and the route itself 404s outside a demo.
const PUBLIC_ROUTES = new Set(['/health', '/demo/reset']);

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: config.FRONTEND_ORIGIN, credentials: true });

  app.addHook('onRequest', async (request) => {
    if (PUBLIC_ROUTES.has(request.routeOptions.url ?? request.url)) return;
    await verifyUser(request);
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.httpStatus).send({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
      });
    }
    logger.error('unhandled error', {
      path: request.url,
      message: err instanceof Error ? err.message : String(err),
    });
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });

  app.get('/health', async () => ({
    ok: true,
    visaMode: config.VISA_MODE,
    llmMode: process.env.LLM_MOCK === 'true' ? 'mock' : (process.env.LLM_PROVIDER ?? 'unset'),
  }));

  await registerRoutes(app);

  return app;
}

const isEntrypoint = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');

if (isEntrypoint) {
  const app = await buildServer();
  // Seeding lives here rather than in buildServer() so tests and scripts own their own fixtures.
  if (config.DB_MODE === 'postgres') {
    // Real data wins over the fixtures: hydrate the working set and shop from their catalogue.
    await hydrateFromPostgres();
    setCatalogue(await catalogueFromPostgres());
  } else if (demoModeEnabled()) {
    resetDemoState();
  }
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  startJobs();
  logger.info('listening', { port: config.PORT, visaMode: config.VISA_MODE });
}
