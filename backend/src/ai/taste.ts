import { db } from '../db/index.js';
import type { ItemRow } from '../db/types.js';
import { groupMemberIds } from '../domain/permissions.js';
import { embedDim, embedText, unit } from './embed.js';

export type SignalKind = 'wishlist' | 'heart' | 'bought';
export type SignalItem = { item: ItemRow; weight: number; signal: SignalKind };

/** §1 rule 3: only shared/anonymous items ever feed taste, Wrapped or gifting. */
export const isGroupVisible = (item: ItemRow, groupId: string): boolean =>
  item.groupId === groupId && item.visibility !== 'private';

export function groupSharedItems(groupId: string): ItemRow[] {
  return db.items
    .filter((item) => isGroupVisible(item, groupId))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function cosine(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function itemText(item: ItemRow): string {
  return [item.name, item.category, item.merchant, item.description]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

/**
 * embedImage() is a text fallback (no CLIP), so embedding the image URL would be noise.
 * The item's own text is always the better signal, and the image URL only backs up a blank item.
 */
export async function embedItem(item: ItemRow): Promise<number[]> {
  const text = itemText(item).trim();
  return embedText(text || item.imageUrl || 'item');
}

export async function ensureEmbedding(item: ItemRow): Promise<number[]> {
  if (item.embedding && item.embedding.length === embedDim()) return item.embedding;
  const embedding = await embedItem(item);
  item.embedding = embedding;
  return embedding;
}

export async function ensureEmbeddings(items: ItemRow[]): Promise<void> {
  for (const item of items) await ensureEmbedding(item);
}

const WEIGHTS: Record<SignalKind, number> = { wishlist: 3, heart: 2, bought: 1 };

/**
 * The items that describe a member's taste: what they saved (×3), what they hearted (×2) and
 * what they shared themselves (×1). An item counted twice keeps its strongest signal.
 */
export function signalItems(userId: string, groupId: string): SignalItem[] {
  const strongest = new Map<string, SignalItem>();

  const add = (item: ItemRow, signal: SignalKind): void => {
    const existing = strongest.get(item.id);
    if (existing && existing.weight >= WEIGHTS[signal]) return;
    strongest.set(item.id, { item, weight: WEIGHTS[signal], signal });
  };

  for (const reaction of db.reactions.filter((r) => r.userId === userId)) {
    const item = db.items.find((i) => i.id === reaction.itemId);
    if (item && isGroupVisible(item, groupId)) {
      add(item, reaction.type === 'wishlist' ? 'wishlist' : 'heart');
    }
  }
  for (const item of db.items.filter((i) => i.ownerId === userId && isGroupVisible(i, groupId))) {
    add(item, 'bought');
  }

  return [...strongest.values()].sort((a, b) => b.weight - a.weight || a.item.id.localeCompare(b.item.id));
}

/** Weighted mean of normalised item embeddings, normalised. Null when the member has no signal. */
export async function memberVector(userId: string, groupId: string): Promise<number[] | null> {
  const signals = signalItems(userId, groupId);
  if (signals.length === 0) return null;

  const acc = new Array<number>(embedDim()).fill(0);
  let totalWeight = 0;
  for (const { item, weight } of signals) {
    const vector = unit(await ensureEmbedding(item));
    for (let i = 0; i < acc.length; i += 1) acc[i] = (acc[i] ?? 0) + weight * (vector[i] ?? 0);
    totalWeight += weight;
  }
  if (totalWeight === 0) return null;
  return unit(acc.map((v) => v / totalWeight));
}

export type TasteTwins = {
  userIds: [string, string];
  similarity: number;
  /** Each twin's 5 items closest to the midpoint of the pair, twin A first. */
  itemIdsByUser: Record<string, string[]>;
  itemIds: string[];
};

export async function tasteTwins(groupId: string): Promise<TasteTwins | null> {
  const vectors = new Map<string, number[]>();
  for (const userId of groupMemberIds(groupId)) {
    const vector = await memberVector(userId, groupId);
    if (vector) vectors.set(userId, vector);
  }

  const members = [...vectors.keys()];
  if (members.length < 2) return null;

  let best: { pair: [string, string]; similarity: number } | null = null;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (!a || !b) continue;
      const similarity = cosine(vectors.get(a) ?? [], vectors.get(b) ?? []);
      if (!best || similarity > best.similarity) best = { pair: [a, b], similarity };
    }
  }
  if (!best) return null;

  const [a, b] = best.pair;
  const vectorA = vectors.get(a) ?? [];
  const vectorB = vectors.get(b) ?? [];
  const midpoint = unit(vectorA.map((v, i) => v + (vectorB[i] ?? 0)));

  const nearest = async (userId: string): Promise<string[]> => {
    const scored: { id: string; score: number }[] = [];
    for (const { item } of signalItems(userId, groupId)) {
      scored.push({ id: item.id, score: cosine(await ensureEmbedding(item), midpoint) });
    }
    return scored
      .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
      .slice(0, 5)
      .map((s) => s.id);
  };

  const itemsA = await nearest(a);
  const itemsB = await nearest(b);

  return {
    userIds: [a, b],
    similarity: best.similarity,
    itemIdsByUser: { [a]: itemsA, [b]: itemsB },
    itemIds: [...itemsA, ...itemsB],
  };
}

export type Cluster = { items: ItemRow[]; centroid: number[] };

/**
 * k-means (k=3) over the group's shared items, deterministic: items are id-sorted and the
 * initial centroids are evenly spaced through them, so the same data always yields the same
 * story. Groups are tiny, so plain in-memory maths beats a vector DB (§8.2).
 */
export async function groupClusters(groupId: string, k = 3, iterations = 12): Promise<Cluster[]> {
  const items = groupSharedItems(groupId);
  if (items.length === 0) return [];
  await ensureEmbeddings(items);

  const vectors = items.map((item) => unit(item.embedding ?? []));
  const clusterCount = Math.min(k, items.length);
  let centroids = Array.from({ length: clusterCount }, (_, index) => {
    const pick = vectors[Math.floor((index * items.length) / clusterCount)];
    return pick ? pick.slice() : new Array<number>(embedDim()).fill(0);
  });

  let assignment = new Array<number>(items.length).fill(0);

  for (let round = 0; round < iterations; round += 1) {
    let moved = false;
    const next = vectors.map((vector) => {
      let bestIndex = 0;
      let bestScore = Number.NEGATIVE_INFINITY;
      centroids.forEach((centroid, index) => {
        const score = cosine(vector, centroid);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      return bestIndex;
    });
    moved = next.some((value, index) => value !== assignment[index]);
    assignment = next;
    if (!moved && round > 0) break;

    centroids = centroids.map((centroid, index) => {
      const members = vectors.filter((_, i) => assignment[i] === index);
      if (members.length === 0) return centroid;
      const sum = new Array<number>(centroid.length || embedDim()).fill(0);
      for (const member of members) {
        for (let i = 0; i < sum.length; i += 1) sum[i] = (sum[i] ?? 0) + (member[i] ?? 0);
      }
      return unit(sum);
    });
  }

  return centroids
    .map((centroid, index) => ({
      centroid,
      items: items.filter((_, i) => assignment[i] === index),
    }))
    .filter((cluster) => cluster.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);
}

export async function largestCluster(groupId: string): Promise<Cluster | null> {
  const clusters = await groupClusters(groupId);
  return clusters[0] ?? null;
}
