/**
 * `pnpm db:check` - hydrates the working set from Supabase and reports what the demo actually has
 * to work with. Read-only: it never writes to the teammates' database.
 */
import { db, resetDb } from '../src/db/index.js';
import { catalogueFromPostgres, closePool, hydrateFromPostgres } from '../src/db/postgres.js';
import { searchCatalogue, setCatalogue } from '../src/products/catalogue.js';
import { signalItems } from '../src/ai/taste.js';

resetDb();
await hydrateFromPostgres();
setCatalogue(await catalogueFromPostgres());

for (const group of db.groups.all()) {
  const members = db.memberships.filter((m) => m.groupId === group.id);
  console.log(`\n${group.emoji} ${group.name} (${group.id}) invite=${group.inviteCode}`);
  for (const { userId } of members) {
    const user = db.users.find((u) => u.id === userId);
    if (!user) continue;
    const owned = db.items.filter((i) => i.ownerId === userId);
    const shared = owned.filter((i) => i.visibility !== 'private').length;
    const signals = signalItems(userId, group.id);
    // Same rule the picker uses: a thing they bought is out, a thing they saved is in.
    const giftable = signals.filter(
      (s) => s.signal !== 'bought' && !(s.item.ownerId === userId && s.item.purchasedAt !== null),
    );
    console.log(
      `  ${user.name.padEnd(8)} birthday=${user.birthday ?? '-'} card=${user.cardLast4 ?? '-'} ` +
        `items=${owned.length}(${shared} shared) signals=${signals.length} giftable=${giftable.length}`,
    );
    for (const s of giftable) {
      console.log(`      ${s.signal.padEnd(8)} ${s.item.name} (${s.item.priceCents ?? '?'}c)`);
    }
  }
}

for (const thread of db.giftThreads.all()) {
  const recipient = db.users.find((u) => u.id === thread.recipientId)?.name ?? thread.recipientId;
  const picks = db.giftPicks.filter((p) => p.threadId === thread.id);
  const contributions = db.contributions.filter((c) => c.threadId === thread.id);
  console.log(
    `\nthread ${thread.id}\n  recipient=${recipient} state=${thread.state} ` +
      `budget=${thread.budgetMinCents}-${thread.budgetMaxCents} deadline=${thread.deadline}`,
  );
  for (const p of picks) {
    console.log(`    pick ${p.priceCents}c ${p.productName} cites=[${p.citedItemIds.join(', ')}]`);
  }
  for (const c of contributions) {
    console.log(`    contribution ${c.userId} ${c.amountCents}c ${c.status}`);
  }
  // The picker can only ever be as good as what the catalogue returns inside the budget.
  const queries = signalItems(thread.recipientId, thread.groupId)
    .slice(0, 3)
    .map((s) => s.item.name);
  const shortlist = searchCatalogue(queries, {
    minCents: thread.budgetMinCents,
    maxCents: thread.budgetMaxCents,
  });
  console.log(`    shortlist=${shortlist.length} for [${queries.join(' | ')}]`);
  for (const p of shortlist.slice(0, 3)) {
    console.log(`      ${p.priceCents}c ${p.name} (${p.merchant})`);
  }
}

const missingCitations = db.giftPicks.all().filter((p) => p.citedItemIds.length === 0);
if (missingCitations.length > 0) {
  console.log(`\nWARNING: ${missingCitations.length} pick(s) cite no real item (§1 rule 5)`);
}

await closePool();
