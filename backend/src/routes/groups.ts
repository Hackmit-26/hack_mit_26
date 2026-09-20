import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db, inviteCode, newId, now } from '../db/index.js';
import type { GroupRow, UserRow } from '../db/types.js';
import { assertMember } from '../domain/permissions.js';
import { notFound } from '../lib/errors.js';
import type { Group, GroupMember } from '../types/api.js';

const createBody = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().min(1).max(8),
});

const joinBody = z.object({
  inviteCode: z.string().trim().min(1).max(16),
});

const idParams = z.object({ id: z.string().min(1) });

export function toGroup(group: GroupRow): Group {
  const members: GroupMember[] = db.memberships
    .filter((m) => m.groupId === group.id)
    .map((m) => db.users.find((u) => u.id === m.userId))
    .filter((u): u is UserRow => u !== undefined)
    .map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      hasBirthday: Boolean(u.birthday),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    members,
  };
}

function join(groupId: string, userId: string): void {
  if (db.memberships.find((m) => m.groupId === groupId && m.userId === userId)) return;
  db.memberships.insert({ groupId, userId, joinedAt: now() });
}

function freshInviteCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = inviteCode();
    if (!db.groups.find((g) => g.inviteCode === code)) return code;
  }
  throw new Error('Could not allocate a unique invite code');
}

export default async function groupsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/groups', async (request) => {
    const { userId } = requireAuth(request);
    const body = createBody.parse(request.body);

    const group = db.groups.insert({
      id: newId(),
      name: body.name,
      emoji: body.emoji,
      inviteCode: freshInviteCode(),
      createdAt: now(),
    });
    join(group.id, userId);

    return toGroup(group);
  });

  app.post('/groups/join', async (request) => {
    const { userId } = requireAuth(request);
    const body = joinBody.parse(request.body);

    const code = body.inviteCode.toUpperCase();
    const group = db.groups.find((g) => g.inviteCode.toUpperCase() === code);
    if (!group) throw notFound('No group with that invite code');

    join(group.id, userId);
    return toGroup(group);
  });

  app.get('/groups/:id', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);

    const group = db.groups.find((g) => g.id === id);
    if (!group) throw notFound('Group not found');
    assertMember(group.id, userId);

    return toGroup(group);
  });
}
