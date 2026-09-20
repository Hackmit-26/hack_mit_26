import { z } from 'zod';
import type { ChatMessage } from '../llm.js';

export const tasteMatchCopySchema = z.object({
  lead: z.string().trim().min(20).max(240),
  sharedTags: z.array(z.string().trim().min(2).max(40)).min(2).max(5),
  notes: z.object({
    taste: z.string().trim().min(3).max(40),
    budget: z.string().trim().min(3).max(40),
    timing: z.string().trim().min(3).max(40),
  }),
  disagreements: z
    .array(
      z.object({
        userId: z.string().min(1),
        text: z.string().trim().min(10).max(160),
      }),
    )
    .length(2),
});

export type TasteMatchCopy = z.infer<typeof tasteMatchCopySchema>;

export type MemberFacts = {
  userId: string;
  name: string;
  topCategories: string[];
  itemNames: string[];
  topMerchant: string | null;
  topMerchantCount: number;
  merchantVariety: number;
  itemCount: number;
  peakDay: string;
  /** 'everyday' | 'considered' | 'investment' — a band, never a figure (§1 rule 2). */
  spendShape: string;
};

export type TasteMatchFacts = {
  scores: { taste: number; budget: number; timing: number };
  sharedCategories: string[];
  sharedItemNames: string[];
  members: [MemberFacts, MemberFacts];
};

export function tasteMatchPrompt(facts: TasteMatchFacts): ChatMessage[] {
  const [a, b] = facts.members;

  const describe = (m: MemberFacts): string =>
    [
      `- userId=${m.userId} | ${m.name}`,
      `  shops: ${m.topCategories.join(', ') || 'a bit of everything'}`,
      `  saved/bought: ${m.itemNames.slice(0, 8).map((n) => `"${n}"`).join(', ')}`,
      `  most-visited shop: ${m.topMerchant ?? 'no repeat shop'} (${m.topMerchantCount} times of ${m.itemCount})`,
      `  distinct shops: ${m.merchantVariety}`,
      `  busiest day: ${m.peakDay}`,
      `  spend shape: ${m.spendShape}`,
    ].join('\n');

  return [
    {
      role: 'system',
      content: [
        'You write the copy for one card in a friend group\'s monthly shopping recap: the two',
        'members whose taste is closest, and why.',
        '',
        'Three scores are already computed and are NOT yours to change — you only interpret them:',
        '  taste  = how much their saved items overlap',
        '  budget = how similarly their spending is distributed',
        '  timing = how similarly their weeks are shaped',
        '',
        'HARD RULES:',
        '- Never mention money in any form. No currency symbols, no figures, no "cheap",',
        '  "expensive", "affordable", "budget", "spent", "price". Talk about taste, not cost.',
        '- Only use item names, shops, categories and days that appear in the facts below.',
        '  Never invent one.',
        '- The two disagreement lines must use the exact userIds given, one each.',
        '- Warm, specific, a little funny. Never mean. These are friends.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Computed scores — taste ${facts.scores.taste}, budget ${facts.scores.budget}, timing ${facts.scores.timing} (out of 100).`,
        '',
        'The pair:',
        describe(a),
        describe(b),
        '',
        `Categories they both shop: ${facts.sharedCategories.join(', ') || 'none in common'}`,
        `Items sitting in those shared categories: ${facts.sharedItemNames
          .slice(0, 10)
          .map((n) => `"${n}"`)
          .join(', ')}`,
        '',
        'Write:',
        `- lead: one sentence saying what ${a.name} and ${b.name} both gravitate toward. Name real things.`,
        '- sharedTags: 3 to 5 short style tags describing the overlap (e.g. "silver jewellery", "neutral basics").',
        '- notes.taste / notes.budget / notes.timing: a handwritten-margin phrase under each score.',
        '  Under 5 words each, lowercase, no full stop. The timing note should reference a real day.',
        '- disagreements: exactly 2 lines, one per userId, naming the one way each differs from the other.',
        '  Use their real shop counts or busiest day. This is the joke of the card, so make it land.',
        '',
        'Respond as: {"lead":"…","sharedTags":["…"],"notes":{"taste":"…","budget":"…","timing":"…"},"disagreements":[{"userId":"…","text":"…"},{"userId":"…","text":"…"}]}',
      ].join('\n'),
    },
  ];
}
