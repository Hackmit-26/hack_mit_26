/**
 * `pnpm demo:check` - rehearses the §15 stage script against a live-ish server and asserts the
 * three moments that have to land: the birthday nudge, a top pick the recipient actually hearted,
 * and the reversal thread refunding the shares that were pulled. Run this before going on stage.
 */
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import type { Birthday, Thread, WrappedCards } from '../src/types/api.js';

const KRISTINA = 'kristina';
const SABINA = 'sabina';
const MADHAV = 'madhav';
const GROUP = 'tea-party';

const app = await buildServer();

async function as<T>(
  method: 'GET' | 'POST',
  url: string,
  userId: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const res = await app.inject({
    method,
    url,
    headers: { authorization: `Bearer dev:${userId}` },
    payload,
  });
  if (res.statusCode >= 300) throw new Error(`${method} ${url} -> ${res.statusCode} ${res.body}`);
  return JSON.parse(res.body) as T;
}

await app.inject({ method: 'POST', url: '/demo/reset', headers: { authorization: `Bearer dev:${KRISTINA}` } });

const birthdays = await as<Birthday[]>('GET', `/groups/${GROUP}/birthdays`, KRISTINA);
const sabina = birthdays.find((b) => b.userId === SABINA);
assert.ok(sabina, 'Sabina must appear in the birthday nudge');
assert.ok(sabina.daysUntil <= 30, `nudge window blown: ${sabina.daysUntil} days`);
assert.ok(sabina.existingThreadId, 'the demo birthday thread must already exist');
console.log(`  nudge: ${sabina.name} in ${sabina.daysUntil} days -> thread ${sabina.existingThreadId}`);

const wrapped = await as<{ cards: WrappedCards }>('POST', `/groups/${GROUP}/wrapped`, KRISTINA);
const blob = JSON.stringify(wrapped.cards);
assert.ok(wrapped.cards.aesthetic.title, 'aesthetic card must have a title');
assert.ok(wrapped.cards.personas.length > 0, 'personas card must not be empty');
assert.ok(wrapped.cards.findOfTheMonth.itemId, 'find of the month must cite an item');
assert.doesNotMatch(blob, /\$\d|\bcents\b|priceCents/i, '§1 rule 2: Wrapped must never mention prices');
console.log(`  wrapped: "${wrapped.cards.aesthetic.title}", ${wrapped.cards.personas.length} personas, no prices`);

const picks = await as<Thread['picks']>('POST', `/threads/${sabina.existingThreadId}/picks`, KRISTINA);
console.log('  all picks:', picks.map((p) => `${p.productName} ${p.priceCents}`).join(' | '));
const top = picks[0];
assert.ok(top, 'the birthday thread must produce picks');
assert.ok(
  picks.some((p) => /polaroid|sx-70/i.test(p.productName)),
  `the hearted Polaroid must be on the board, got "${picks.map((p) => p.productName).join(', ')}"`,
);
assert.ok(top.citedItemIds.length > 0, '§1 rule 5: every pick must cite a real item');
console.log(`  top pick: ${top.productName} - "${top.reason}"`);

const hidden = await app.inject({
  method: 'GET',
  url: `/threads/${sabina.existingThreadId}`,
  headers: { authorization: `Bearer dev:${SABINA}` },
});
assert.equal(hidden.statusCode, 404, 'the recipient must never see her own thread');
console.log('  recipient blind: 404');

const reversal = (await as<Thread[]>('GET', `/groups/${GROUP}/threads`, KRISTINA)).find(
  (t) => t.state === 'collecting',
);
assert.ok(reversal, 'the pre-made collecting thread must exist for the reversal moment');
// Nothing is pre-pulled any more: two people approve for real, which is the stage script.
for (const who of [SABINA, MADHAV]) {
  await as('POST', `/threads/${reversal.id}/contributions/me/approve`, who, { confirm: true });
}
const pulled = (await as<Thread>('GET', `/threads/${reversal.id}`, KRISTINA)).contributions.filter(
  (c) => c.status === 'pulled',
);
assert.equal(pulled.length, 2, `expected 2 pulled shares, got ${pulled.length}`);

const cancelled = await as<Thread>('POST', `/threads/${reversal.id}/cancel`, KRISTINA);
const after = await as<Thread>('GET', `/threads/${reversal.id}`, KRISTINA);
assert.equal(after.state, 'refunded', `cancel left thread in ${cancelled.state}/${after.state}`);
assert.equal(
  after.contributions.filter((c) => c.status === 'refunded').length,
  2,
  'exactly the two pulled shares must be reversed',
);
console.log('  reversal: 2 shares refunded, thread refunded');

await app.close();
console.log('demo:check OK');
