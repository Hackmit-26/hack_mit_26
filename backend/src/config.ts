import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    PORT: z.coerce.number().default(8080),
    API_BASE_URL: z.url().default('http://localhost:8080'),
    FRONTEND_ORIGIN: z.url().default('http://localhost:3000'),

    VISA_MODE: z.enum(['mock', 'sandbox']).default('mock'),
    VISA_BASE_URL: z.url().default('https://sandbox.api.visa.com'),
    VISA_USER_ID: z.string().optional(),
    VISA_PASSWORD: z.string().optional(),
    VISA_CERT_PATH: z.string().default('./secrets/cert.pem'),
    VISA_KEY_PATH: z.string().default('./secrets/key.pem'),
    VISA_CA_PATH: z.string().default('./secrets/visa-sandbox-ca.pem'),
    VISA_ACQUIRING_BIN: z.string().optional(),
    VISA_ACQUIRER_COUNTRY_CODE: z.string().default('840'),
    VISA_TEST_CARDS_JSON: z.string().default('./secrets/test-cards.json'),

    /** Set when the Visa project has Message Level Encryption on. Without it the gateway answers 9125. */
    VISA_MLE_KEY_ID: z.string().optional(),
    /** Visa's MLE certificate, downloaded from the project dashboard. Encrypts our requests. */
    VISA_MLE_SERVER_CERT_PATH: z.string().default('./secrets/mle-server-cert.pem'),
    /** Our private key. Visa encrypts responses to our client certificate, so this defaults to it. */
    VISA_MLE_PRIVATE_KEY_PATH: z.string().optional(),

    DATABASE_URL: z.string().optional(),
    DB_MODE: z.enum(['memory', 'postgres']).default('memory'),

    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    DEADLINE_SWEEP_INTERVAL_MS: z.coerce.number().default(60_000),
  })
  .superRefine((v, ctx) => {
    if (v.DB_MODE === 'postgres' && !v.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DB_MODE=postgres',
      });
    }
    if (v.VISA_MODE !== 'sandbox') return;
    for (const key of ['VISA_USER_ID', 'VISA_PASSWORD', 'VISA_ACQUIRING_BIN'] as const) {
      if (!v[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when VISA_MODE=sandbox`,
        });
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
