/**
 * `pnpm demo:arm` - drives the seeded gift thread up to the money moment on an *already running*
 * server, over HTTP.
 *
 * `POST /demo/reset` leaves `thread-sabina-birthday` in `picking` with no picks and no
 * contributions, so the three stage approvals are four API calls away. This generates the picks,
 * votes them through as everyone but the recipient, and locks the thread, leaving it `collecting`
 * with three `pending` shares. The approvals themselves are deliberately left for the stage.
 *
 * Unlike `e2e:gift` and `demo:check`, which build their own in-process app, this talks to whatever
 * is listening on BASE - so it arms the server the browser is actually pointed at.
 */
const BASE = process.env.DEMO_BASE ?? 'http://localhost:8081';
const GROUP = 'tea-party';
const ORGANISER = 'kristina';
const VOTERS = ['kristina', 'esh', 'madhav'];

/** Named `GiftPick`, not `Pick`: the root tsconfig also checks this file, where `Pick` is a builtin. */
type GiftPick = { id: string; productName: string; priceCents: number };
type Contribution = { userId: string; status: string; amountCents: number };
type Thread = {
  id: string;
  state: string;
  recipientId: string;
  picks: GiftPick[];
  contributions: Contribution[];
};

async function as<T>(
  method: 'GET' | 'POST',
  path: string,
  userId: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer dev:${userId}`,
      ...(payload ? { 'content-type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} as ${userId} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const threads = await as<Thread[]>('GET', `/groups/${GROUP}/threads`, ORGANISER);
const target = threads.find((t) => t.state === 'picking' || t.state === 'voting');
if (!target) {
  const states = threads.map((t) => `${t.id}=${t.state}`).join(', ');
  throw new Error(`No thread in picking/voting. Run POST ${BASE}/demo/reset first. Have: ${states}`);
}

if (target.state === 'picking') {
  await as<GiftPick[]>('POST', `/threads/${target.id}/picks`, ORGANISER);
}

const withPicks = await as<Thread>('GET', `/threads/${target.id}`, ORGANISER);
const pick = withPicks.picks[0];
if (!pick) throw new Error(`Thread ${target.id} generated no picks`);

for (const voter of VOTERS) {
  if (voter === withPicks.recipientId) continue;
  await as<void>('POST', `/threads/${target.id}/votes`, voter, { pickId: pick.id });
}

const locked = await as<Thread>('POST', `/threads/${target.id}/lock`, ORGANISER);
const shares = locked.contributions
  .map((c) => `${c.userId} ${c.status} ${(c.amountCents / 100).toFixed(2)}`)
  .join(' | ');

console.log(`${locked.id} -> ${locked.state}`);
console.log(`winning pick: ${pick.productName} ($${(pick.priceCents / 100).toFixed(2)})`);
console.log(`shares: ${shares}`);
console.log('Approve on stage as each person, or:');
console.log(
  `  curl -X POST ${BASE}/threads/${locked.id}/contributions/me/approve \\\n` +
    `    -H 'Authorization: Bearer dev:<user>' -H 'content-type: application/json' -d '{"confirm":true}'`,
);

/** Top-level `await` needs this file to be a module; it has no other imports or exports. */
export {};
