import { randomUUID } from 'node:crypto';
import type {
  CommentRow,
  ContributionRow,
  GiftPickRow,
  GiftThreadRow,
  GroupRow,
  ItemRow,
  MembershipRow,
  PasskeyRow,
  ReactionRow,
  UserRow,
  VoteRow,
  WrappedRow,
  WrappedVetoRow,
} from './types.js';

/**
 * In-memory stand-in for the Supabase tables in §6 of the handoff. The DB owner's schema is
 * the eventual source of truth; this exists so the rest of the backend can be built and tested
 * without waiting for it. Swapping to supabase-js means reimplementing Table, nothing above it.
 */
export class Table<T extends object> {
  private rows: T[] = [];

  all(): T[] {
    return this.rows;
  }

  find(predicate: (row: T) => boolean): T | undefined {
    return this.rows.find(predicate);
  }

  filter(predicate: (row: T) => boolean): T[] {
    return this.rows.filter(predicate);
  }

  insert(row: T): T {
    this.rows.push(row);
    return row;
  }

  insertMany(rows: T[]): T[] {
    this.rows.push(...rows);
    return rows;
  }

  update(predicate: (row: T) => boolean, patch: Partial<T>): T | undefined {
    const row = this.rows.find(predicate);
    if (!row) return undefined;
    Object.assign(row, patch);
    return row;
  }

  /**
   * Conditional update, the §12 concurrency primitive. Applies the patch only if the guard
   * still holds, and reports whether this caller won the race.
   */
  claim(
    predicate: (row: T) => boolean,
    guard: (row: T) => boolean,
    patch: Partial<T>,
  ): { claimed: boolean; row?: T } {
    const row = this.rows.find(predicate);
    if (!row) return { claimed: false };
    if (!guard(row)) return { claimed: false, row };
    Object.assign(row, patch);
    return { claimed: true, row };
  }

  remove(predicate: (row: T) => boolean): number {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !predicate(row));
    return before - this.rows.length;
  }

  clear(): void {
    this.rows = [];
  }
}

export const db = {
  users: new Table<UserRow>(),
  groups: new Table<GroupRow>(),
  memberships: new Table<MembershipRow>(),
  items: new Table<ItemRow>(),
  reactions: new Table<ReactionRow>(),
  comments: new Table<CommentRow>(),
  wrapped: new Table<WrappedRow>(),
  wrappedVetoes: new Table<WrappedVetoRow>(),
  giftThreads: new Table<GiftThreadRow>(),
  giftPicks: new Table<GiftPickRow>(),
  votes: new Table<VoteRow>(),
  contributions: new Table<ContributionRow>(),
  passkeys: new Table<PasskeyRow>(),
};

export function resetDb(): void {
  for (const table of Object.values(db)) table.clear();
}

export const newId = (): string => randomUUID();
export const now = (): string => new Date().toISOString();

export function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}
