import { z } from 'zod';
import type { ChatMessage } from '../llm.js';

export const giftReasonsSchema = z.object({
  picks: z
    .array(
      z.object({
        candidateId: z.string().min(1),
        reason: z.string().trim().min(10).max(400),
        citedItemIds: z.array(z.string().min(1)).min(1).max(3),
      }),
    )
    .min(1)
    .max(3),
});

export type GiftReasons = z.infer<typeof giftReasonsSchema>;

export type ReasonCandidate = {
  id: string;
  name: string;
  merchant: string;
  description: string;
  band: 'low' | 'mid' | 'high';
  fromWishlist: boolean;
};

export type ReasonSignal = { id: string; name: string; signal: 'wishlist' | 'heart' | 'bought' };

export function giftReasonsPrompt(input: {
  recipientName: string;
  summary: string;
  candidates: ReasonCandidate[];
  signals: ReasonSignal[];
  wanted: number;
}): ChatMessage[] {
  const candidates = input.candidates
    .map(
      (c) =>
        `- id=${c.id} | ${c.name} from ${c.merchant || 'unknown shop'} | band=${c.band}${
          c.fromWishlist ? ' | ALREADY ON THEIR WISHLIST' : ''
        } | ${c.description}`,
    )
    .join('\n');

  const signals = input.signals.map((s) => `- id=${s.id} | "${s.name}" (${s.signal})`).join('\n');

  return [
    {
      role: 'system',
      content: [
        'You choose gifts for a friend and justify each one with evidence.',
        'Every reason MUST name at least one of the recipient\'s real items, spelled exactly as given, and every id you cite must come from the evidence list.',
        'Never invent an item or an id. Never mention prices, budgets or money. One or two sentences per reason, warm and plain.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Recipient: ${input.recipientName}`,
        `Taste summary: ${input.summary}`,
        '',
        'Evidence — items they saved, hearted or already own:',
        signals,
        '',
        'Candidate gifts:',
        candidates,
        '',
        `Choose ${input.wanted} candidate${input.wanted === 1 ? '' : 's'}. Spread them across the bands (one low, one mid, one high) when the bands allow it, and prefer a wishlist candidate for one of them.`,
        'Respond as: {"picks": [{"candidateId": "...", "reason": "...", "citedItemIds": ["..."]}]}',
      ].join('\n'),
    },
  ];
}
