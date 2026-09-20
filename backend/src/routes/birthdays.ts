import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/verifyUser.js';
import { db } from '../db/index.js';
import { assertMember, groupMemberIds } from '../domain/permissions.js';
import { isTerminal } from '../domain/threadStateMachine.js';
import { notFound } from '../lib/errors.js';
import type { Birthday } from '../types/api.js';

const idParams = z.object({ id: z.string().min(1) });

const HORIZON_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Everything is UTC (§17). The next occurrence rolls into next year on its own, so a birthday
 * in early January is still "soon" when today is in December.
 */
function nextOccurrence(birthday: string, today: Date): { daysUntil: number; date: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return null;
  const [, , month, day] = match;
  if (!month || !day) return null;

  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  let next = Date.UTC(today.getUTCFullYear(), Number(month) - 1, Number(day));
  if (next < startOfToday) {
    next = Date.UTC(today.getUTCFullYear() + 1, Number(month) - 1, Number(day));
  }

  return {
    daysUntil: Math.round((next - startOfToday) / DAY_MS),
    date: new Date(next).toISOString().slice(0, 10),
  };
}

export default async function birthdaysRoutes(app: FastifyInstance): Promise<void> {
  app.get('/groups/:id/birthdays', async (request) => {
    const { userId } = requireAuth(request);
    const { id } = idParams.parse(request.params);

    const group = db.groups.find((g) => g.id === id);
    if (!group) throw notFound('Group not found');
    assertMember(group.id, userId);

    const today = new Date();
    const birthdays: Birthday[] = [];

    for (const memberId of groupMemberIds(group.id)) {
      if (memberId === userId) continue;

      const member = db.users.find((u) => u.id === memberId);
      if (!member?.birthday) continue;

      const next = nextOccurrence(member.birthday, today);
      if (!next || next.daysUntil > HORIZON_DAYS) continue;

      const thread = db.giftThreads.find(
        (t) => t.groupId === group.id && t.recipientId === memberId && !isTerminal(t.state),
      );

      birthdays.push({
        userId: member.id,
        name: member.name,
        date: next.date,
        daysUntil: next.daysUntil,
        existingThreadId: thread?.id ?? null,
      });
    }

    return birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
  });
}
