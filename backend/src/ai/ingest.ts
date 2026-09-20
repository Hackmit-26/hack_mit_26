import { db, newId, now } from '../db/index.js';
import type { ItemRow } from '../db/types.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { visionJSON } from './llm.js';
import {
  CATEGORIES,
  receiptExtractionPrompt,
  receiptExtractionSchema,
  type Category,
} from './prompts/receiptExtraction.js';
import { ensureEmbedding } from './taste.js';
import type { ExtractedItem } from '../types/api.js';

export { CATEGORIES };

/** Categories a model might invent that we refuse to store at all (§8.3 excluded categories). */
const EXCLUDED_CATEGORIES = new Set([
  'health',
  'healthcare',
  'pharmacy',
  'medicine',
  'medical',
  'medication',
  'wellness',
  'supplements',
  'personal_health',
]);

const HEALTH_PATTERN =
  /\b(pharmac(?:y|ist)|chemist|drugstore|drug store|prescription|medicine|medicinal|medication|ibuprofen|paracetamol|acetaminophen|tylenol|advil|aspirin|antacid|antibiotic|antihistamine|allergy relief|painkiller|pain relief|vitamins?|multivitamin|supplements?|probiotic|melatonin|inhaler|insulin|ointment|antiseptic|bandages?|band-?aid|first aid|cough syrup|cold (?:and|&) flu|lozenges?|pregnancy test|contracepti(?:ve|on)|condoms?|thermometer|blood pressure)\b/i;

/** §8.3: nothing pharmacy or health-related is ever stored. */
export function isExcludedItem(item: Pick<ExtractedItem, 'name' | 'category' | 'description'>): boolean {
  if (EXCLUDED_CATEGORIES.has(item.category.trim().toLowerCase())) return true;
  return HEALTH_PATTERN.test(`${item.name} ${item.description}`);
}

const KNOWN: ReadonlySet<string> = new Set(CATEGORIES);

export function normaliseCategory(raw: string): Category {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return KNOWN.has(value) ? (value as Category) : 'other';
}

const MOCK_RECEIPT = {
  items: [
    {
      name: 'Oversized Linen Shirt',
      category: 'clothing',
      merchant: 'Uniqlo',
      priceCents: 4990,
      purchasedAt: '2026-09-14',
      description: 'Boxy sand-coloured linen shirt',
    },
    {
      name: 'Ceramic Pour-Over Dripper',
      category: 'kitchen',
      merchant: 'Uniqlo',
      priceCents: 2800,
      purchasedAt: '2026-09-14',
      description: 'Matte white ceramic coffee dripper',
    },
    {
      name: 'Ibuprofen 200mg',
      category: 'other',
      merchant: 'Uniqlo',
      priceCents: 799,
      purchasedAt: '2026-09-14',
      description: 'Pharmacy painkiller, 24 count',
    },
  ],
};

/** Vision pass only: returns everything on the receipt, including rows we will later drop. */
export async function extractReceipt(image: string): Promise<ExtractedItem[]> {
  const result = await visionJSON(receiptExtractionSchema, image, receiptExtractionPrompt(), {
    label: 'receipt.extract',
    temperature: 0,
    mock: () => MOCK_RECEIPT,
  });
  return result.items.map((item) => ({
    name: item.name,
    category: normaliseCategory(item.category),
    merchant: item.merchant,
    priceCents: item.priceCents,
    purchasedAt: item.purchasedAt,
    description: item.description,
  }));
}

export async function ingestReceipt(input: {
  ownerId: string;
  groupId: string | null;
  imageUrl?: string;
  imageBase64?: string;
}): Promise<ItemRow[]> {
  const image = input.imageUrl ?? input.imageBase64;
  if (!image) {
    throw new AppError('VALIDATION_ERROR', 400, 'Provide imageUrl or imageBase64');
  }

  const extracted = await extractReceipt(image);
  const kept = extracted.filter((item) => !isExcludedItem(item));
  const dropped = extracted.length - kept.length;
  if (dropped > 0) logger.info('ingest.dropped_health_items', { count: dropped });

  const rows = db.items.insertMany(
    kept.map((item) => ({
      id: newId(),
      ownerId: input.ownerId,
      groupId: input.groupId,
      name: item.name,
      category: item.category,
      merchant: item.merchant || null,
      imageUrl: null,
      description: item.description || null,
      priceCents: item.priceCents,
      purchasedAt: item.purchasedAt,
      // Items are private by default (§1 rule 3); the review screen is where they get shared.
      visibility: 'private' as const,
      embedding: null,
      createdAt: now(),
    })),
  );

  // Embedding is not on the critical path for the review screen, so it happens after the response.
  void (async () => {
    for (const row of rows) {
      try {
        await ensureEmbedding(row);
      } catch (error) {
        logger.warn('ingest.embed_failed', { itemId: row.id, error: (error as Error).message });
      }
    }
  })();

  return rows;
}
