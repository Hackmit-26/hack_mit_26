import { z } from 'zod';
import type { ChatMessage } from '../llm.js';

export const giftQueriesSchema = z.object({
  queries: z.array(z.string().trim().min(2).max(80)).min(3).max(5),
});

export type GiftQueries = z.infer<typeof giftQueriesSchema>;

export function giftQueriesPrompt(summary: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You turn a taste summary into product search queries. Each query is 2-5 words, the kind of thing typed into a shop search box. No brand guesses unless the summary names the brand. No prices.',
    },
    {
      role: 'user',
      content: [
        `Taste summary: ${summary}`,
        '',
        'Write 3-5 varied search queries covering different gift angles.',
        'Respond as: {"queries": ["...", "..."]}',
      ].join('\n'),
    },
  ];
}
