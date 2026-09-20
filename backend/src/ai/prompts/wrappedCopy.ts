import { z } from 'zod';
import type { ChatMessage } from '../llm.js';

export const wrappedCopySchema = z.object({
  aesthetic: z.object({
    title: z.string().trim().min(2).max(60),
    blurb: z.string().trim().min(10).max(400),
  }),
  personas: z
    .array(
      z.object({
        userId: z.string().min(1),
        archetype: z.string().trim().min(2).max(60),
        roast: z.string().trim().min(10).max(400),
      }),
    )
    .min(1),
  findOfTheMonth: z.object({ blurb: z.string().trim().min(10).max(400) }),
  tasteTwins: z.object({
    sharedThemes: z.array(z.string().trim().min(2).max(40)).min(1).max(5),
    blurb: z.string().trim().min(10).max(400),
  }),
});

export type WrappedCopy = z.infer<typeof wrappedCopySchema>;

export type WrappedFacts = {
  groupName: string;
  members: { userId: string; name: string; itemNames: string[]; topCategories: string[] }[];
  clusterItemNames: string[];
  findOfTheMonth: { itemName: string; ownerName: string | null; heartCount: number };
  twins: { names: [string, string]; userIds: [string, string]; itemNames: string[] };
};

const TONE = [
  'Tone: warm, teasing, like a friend who has seen your order history. Short sentences. Specific, never generic.',
  'Always name actual items. Naming the exact product is what makes this funny.',
  'Hard bans, no exceptions:',
  '- No prices, totals, spending, budgets, currency symbols or any number of dollars. Not even "cheap" or "expensive".',
  '- No comments about bodies, weight, appearance, health, medication, relationships or dating.',
  '- Nothing mean. Tease the shopping habit, never the person.',
].join('\n');

export function wrappedCopyPrompt(facts: WrappedFacts, variant: number): ChatMessage[] {
  const members = facts.members
    .map(
      (m) =>
        `- ${m.name} (userId ${m.userId}) — shared: ${m.itemNames.join(', ')} | leans: ${m.topCategories.join(', ') || 'mixed'}`,
    )
    .join('\n');

  const angles = [
    'Lead with the funniest concrete item in the group.',
    'Lead with the pattern the group cannot see about itself.',
    'Lead with the one item that does not fit the rest and tease it.',
  ];

  return [
    {
      role: 'system',
      content: `You write Wrapped-style copy about a friend group's shopping taste.\n\n${TONE}`,
    },
    {
      role: 'user',
      content: [
        `Group: ${facts.groupName}`,
        '',
        'Members and their shared items:',
        members,
        '',
        `The group's biggest taste cluster: ${facts.clusterItemNames.join(', ')}`,
        `Most hearted item: "${facts.findOfTheMonth.itemName}"${
          facts.findOfTheMonth.ownerName ? ` by ${facts.findOfTheMonth.ownerName}` : ' (posted anonymously)'
        }, hearted ${facts.findOfTheMonth.heartCount} times.`,
        `Taste twins: ${facts.twins.names[0]} and ${facts.twins.names[1]} — overlapping items: ${facts.twins.itemNames.join(', ')}`,
        '',
        angles[variant % angles.length] ?? angles[0],
        '',
        'Write JSON exactly like:',
        '{',
        '  "aesthetic": { "title": "3-5 word name for the group aesthetic", "blurb": "2 sentences naming at least two real items" },',
        `  "personas": [ { "userId": "<one of the userIds above>", "archetype": "2-4 words", "roast": "1-2 warm sentences naming one of that member's real items" } ],`,
        '  "findOfTheMonth": { "blurb": "1-2 sentences about why the group fell for that item, by name" },',
        '  "tasteTwins": { "sharedThemes": ["2-4 short themes"], "blurb": "1-2 sentences naming a real item they both circle" }',
        '}',
        '',
        `Include exactly one persona per member listed above (${facts.members.length} personas).`,
      ].join('\n'),
    },
  ];
}
