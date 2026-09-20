import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import { AppError } from '../lib/errors.js';
import { passkeyMode } from '../services/giftFlow.js';

/**
 * Minimal WebAuthn ceremony bookkeeping. @simplewebauthn/server plugs in here (§7.6) and
 * replaces the challenge comparison; the stored credential shape already matches.
 */
const challenges = new Map<string, { challenge: string; createdAt: number }>();
const CHALLENGE_TTL_MS = 5 * 60_000;

function issueChallenge(userId: string): string {
  const challenge = randomBytes(32).toString('base64url');
  challenges.set(userId, { challenge, createdAt: Date.now() });
  return challenge;
}

function consumeChallenge(userId: string, challenge: string): void {
  const pending = challenges.get(userId);
  challenges.delete(userId);
  if (!pending || pending.challenge !== challenge) {
    throw new AppError('UNAUTHENTICATED', 401, 'Challenge mismatch');
  }
  if (Date.now() - pending.createdAt > CHALLENGE_TTL_MS) {
    throw new AppError('UNAUTHENTICATED', 401, 'Challenge expired');
  }
}

const registerVerifyBody = z.object({
  challenge: z.string().min(1),
  credentialId: z.string().min(1),
  publicKey: z.string().min(1),
  transports: z.array(z.string()).default([]),
});

export default async function passkeysRoutes(app: FastifyInstance): Promise<void> {
  app.post('/passkeys/register/options', async (request) => {
    const { userId } = requireAuth(request);
    const user = db.users.find((u) => u.id === userId);
    return {
      mode: passkeyMode(),
      challenge: issueChallenge(userId),
      rp: {
        id: process.env.WEBAUTHN_RP_ID ?? 'localhost',
        name: process.env.WEBAUTHN_RP_NAME ?? 'Social Shopping',
      },
      user: { id: userId, name: user?.name ?? userId, displayName: user?.name ?? userId },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      timeout: 60_000,
      attestation: 'none',
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
    };
  });

  app.post('/passkeys/register/verify', async (request) => {
    const { userId } = requireAuth(request);
    const body = registerVerifyBody.parse(request.body);
    consumeChallenge(userId, body.challenge);

    const existing = db.passkeys.find(
      (p) => p.userId === userId && p.credentialId === body.credentialId,
    );
    if (existing) {
      db.passkeys.update((p) => p.userId === userId && p.credentialId === body.credentialId, {
        publicKey: body.publicKey,
        transports: body.transports,
      });
    } else {
      db.passkeys.insert({
        userId,
        credentialId: body.credentialId,
        publicKey: body.publicKey,
        counter: 0,
        transports: body.transports,
      });
    }
    return { verified: true, credentialId: body.credentialId };
  });

  app.post('/passkeys/auth/options', async (request) => {
    const { userId } = requireAuth(request);
    const credentials = db.passkeys.filter((p) => p.userId === userId);
    return {
      mode: passkeyMode(),
      challenge: issueChallenge(userId),
      rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      timeout: 60_000,
      userVerification: 'required',
      allowCredentials: credentials.map((c) => ({
        type: 'public-key',
        id: c.credentialId,
        transports: c.transports,
      })),
    };
  });
}
