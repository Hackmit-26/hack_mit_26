import { z } from 'zod';

/** Fixed category list from §8.3. The model must choose from it; anything else is coerced. */
export const CATEGORIES = [
  'clothing',
  'shoes',
  'accessories',
  'beauty',
  'home',
  'kitchen',
  'books',
  'music',
  'tech',
  'games',
  'stationery',
  'food_drink',
  'sports_outdoors',
  'art_crafts',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const extractedItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60),
  merchant: z.string().trim().max(120),
  priceCents: z.int().nonnegative().nullable(),
  purchasedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
    .nullable(),
  description: z.string().trim().max(500),
});

export const receiptExtractionSchema = z.object({
  items: z.array(extractedItemSchema).max(40),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export function receiptExtractionPrompt(): string {
  return [
    'You are reading a photo of a shopping receipt or an order confirmation.',
    'Extract every purchased line item. Ignore subtotals, taxes, tips, shipping, discounts and loyalty lines.',
    '',
    'For each item return:',
    '- name: the product as a person would say it, title case, no SKU codes or abbreviations',
    '- category: exactly one of ' + CATEGORIES.join(', '),
    '- merchant: the shop name from the receipt (empty string if unreadable)',
    '- priceCents: the line price as an integer number of cents, or null if unreadable',
    '- purchasedAt: the receipt date as YYYY-MM-DD, or null',
    '- description: one short phrase describing the item (colour, material, style). Never invent details you cannot see.',
    '',
    'If an item is pharmacy, medicine, supplement or other health-related merchandise, still report it honestly with category "other" and say so in the description; it will be filtered out downstream.',
    '',
    'Respond as: {"items": [ ... ]}',
  ].join('\n');
}
