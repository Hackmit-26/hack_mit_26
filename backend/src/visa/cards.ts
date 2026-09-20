import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { config } from '../config.js';

const cardSchema = z.object({
  pan: z.string().regex(/^\d{13,19}$/),
  expirationDate: z.string().regex(/^\d{4}-\d{2}$/),
  currency: z.string().length(3),
  last4: z.string().length(4),
});

export type TestCard = z.infer<typeof cardSchema>;

let cards: Record<string, TestCard> | undefined;

function load(): Record<string, TestCard> {
  if (cards) return cards;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(config.VISA_TEST_CARDS_JSON, 'utf8'));
  } catch {
    throw new Error(
      `Could not read ${config.VISA_TEST_CARDS_JSON}. Copy the sandbox test cards from the Visa project dashboard.`,
    );
  }

  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([key]) => !key.startsWith('_'),
  );

  cards = Object.fromEntries(
    entries.map(([ref, value]) => [ref, cardSchema.parse(value)]),
  );
  return cards;
}

export function getCard(cardRef: string): TestCard {
  const card = load()[cardRef];
  if (!card) throw new Error(`Unknown cardRef "${cardRef}"`);
  return card;
}

export function listCardRefs(): string[] {
  return Object.keys(load()).filter((ref) => !ref.startsWith('decline') && ref !== 'invalid-pan');
}

/** Never log a full PAN. */
export function maskPan(pan: string): string {
  return `****${pan.slice(-4)}`;
}
