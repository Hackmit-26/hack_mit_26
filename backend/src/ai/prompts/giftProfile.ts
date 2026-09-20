import { z } from 'zod';
import type { ChatMessage } from '../llm.js';

export const giftProfileSchema = z.object({
  summary: z.string().trim().min(10).max(600),
});

export type GiftProfile = z.infer<typeof giftProfileSchema>;

export type ProfileSignal = { name: string; category: string; signal: 'wishlist' | 'heart' | 'bought' };

export function giftProfilePrompt(recipientName: string, signals: ProfileSignal[]): ChatMessage[] {
  const lines = signals.map((s) => `- [${s.signal}] ${s.name} (${s.category})`).join('\n');
  return [
    {
      role: 'system',
      content:
        'You summarise a person\'s taste so a friend can buy them a gift. Be concrete about materials, styles and categories. Never mention prices, budgets or money.',
    },
    {
      role: 'user',
      content: [
        `${recipientName}'s signals — "wishlist" means they saved it, "heart" means they liked a friend's, "bought" means they own it already:`,
        lines,
        '',
        'Write 2-3 sentences describing what they are into and what a great gift for them looks like.',
        'Respond as: {"summary": "..."}',
      ].join('\n'),
    },
  ];
}
