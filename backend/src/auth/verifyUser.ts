import type { FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { AppError } from '../lib/errors.js';

export type AuthedUser = { userId: string; token: string };

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthedUser;
  }
}

/**
 * Local stub for Supabase Auth. The frontend sends `Authorization: Bearer dev:<userId>`;
 * when the DB owner's Supabase project lands this becomes supabase.auth.getUser(token)
 * and nothing above it changes.
 */
export function verifyToken(token: string): AuthedUser {
  const userId = token.startsWith('dev:') ? token.slice(4) : token;
  if (!userId) throw new AppError('UNAUTHENTICATED', 401, 'Missing token');
  if (!db.users.find((u) => u.id === userId)) {
    throw new AppError('UNAUTHENTICATED', 401, 'Unknown user');
  }
  return { userId, token };
}

export async function verifyUser(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHENTICATED', 401, 'Missing bearer token');
  }
  request.auth = verifyToken(header.slice('Bearer '.length).trim());
}

export function requireAuth(request: FastifyRequest): AuthedUser {
  if (!request.auth) throw new AppError('UNAUTHENTICATED', 401, 'Not authenticated');
  return request.auth;
}
