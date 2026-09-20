import { describe, expect, it } from 'vitest';
import {
  assertSplitBalances,
  canOptOut,
  evenSplit,
  recomputeSplit,
  type ContributionRow,
} from '../src/domain/splits.js';
import {
  THREAD_STATES,
  canTransition,
  isTerminal,
  marksPickTaken,
  transition,
  type ThreadEvent,
  type ThreadState,
} from '../src/domain/threadStateMachine.js';

const asOrganiser = { isOrganiser: true };
const asMember = { isOrganiser: false };

describe('thread state machine', () => {
  it('walks the happy path to revealed', () => {
    let state: ThreadState = 'picking';
    state = transition(state, 'picks_generated', asMember);
    expect(state).toBe('voting');
    state = transition(state, 'lock', asOrganiser);
    expect(state).toBe('collecting');
    state = transition(state, 'all_pulled', asMember);
    expect(state).toBe('funded');
    state = transition(state, 'mark_bought', asOrganiser);
    expect(state).toBe('bought');
    state = transition(state, 'reveal', asOrganiser);
    expect(state).toBe('revealed');
    expect(isTerminal(state)).toBe(true);
  });

  it('cancels straight to refunded before any money moved', () => {
    expect(transition('picking', 'cancel', asOrganiser)).toBe('refunded');
    expect(transition('voting', 'cancel', asOrganiser)).toBe('refunded');
  });

  it('cancels into refunding once collecting has started', () => {
    const state = transition('collecting', 'cancel', asOrganiser);
    expect(state).toBe('refunding');
    expect(transition(state, 'all_reversed', asMember)).toBe('refunded');
  });

  it('lets the sweeper refund a missed deadline without an organiser', () => {
    expect(transition('collecting', 'deadline_missed', asMember)).toBe('refunding');
  });

  it('blocks organiser-only events for ordinary members', () => {
    for (const event of ['lock', 'cancel'] as const) {
      const from: ThreadState = event === 'lock' ? 'voting' : 'collecting';
      expect(() => transition(from, event, asMember)).toThrow(/organiser/);
    }
    expect(() => transition('funded', 'mark_bought', asMember)).toThrow(/organiser/);
    expect(() => transition('bought', 'reveal', asMember)).toThrow(/organiser/);
  });

  it('rejects every event from terminal states', () => {
    const events: ThreadEvent[] = [
      'picks_generated',
      'lock',
      'all_pulled',
      'mark_bought',
      'reveal',
      'cancel',
      'deadline_missed',
      'all_reversed',
    ];
    for (const state of ['revealed', 'refunded'] as const) {
      for (const event of events) {
        expect(canTransition(state, event)).toBe(false);
        expect(() => transition(state, event, asOrganiser)).toThrow();
      }
    }
  });

  it('never allows skipping collection: funded is unreachable without all_pulled', () => {
    for (const state of THREAD_STATES) {
      if (state === 'collecting') continue;
      expect(canTransition(state, 'all_pulled')).toBe(false);
    }
  });

  it('marks the pick taken only while the group is committed to it', () => {
    expect(['collecting', 'funded', 'bought'].every(
      (s) => marksPickTaken(s as ThreadState),
    )).toBe(true);
    expect(['picking', 'voting', 'refunding', 'refunded', 'revealed'].some(
      (s) => marksPickTaken(s as ThreadState),
    )).toBe(false);
  });
});

describe('splits', () => {
  it('splits evenly when it divides cleanly', () => {
    const shares = evenSplit(9000, ['c', 'a', 'b']);
    expect(shares).toEqual([
      { userId: 'a', amountCents: 3000 },
      { userId: 'b', amountCents: 3000 },
      { userId: 'c', amountCents: 3000 },
    ]);
  });

  it('gives remainder cents to the earliest userIds, deterministically', () => {
    const shares = evenSplit(1000, ['c', 'a', 'b']);
    expect(shares).toEqual([
      { userId: 'a', amountCents: 334 },
      { userId: 'b', amountCents: 333 },
      { userId: 'c', amountCents: 333 },
    ]);
    expect(evenSplit(1000, ['b', 'c', 'a'])).toEqual(shares);
  });

  it('always balances, for any total and contributor count', () => {
    for (let n = 1; n <= 12; n++) {
      const ids = Array.from({ length: n }, (_, i) => `user-${i}`);
      for (const total of [0, 1, 99, 100, 4999, 123_457]) {
        assertSplitBalances(total, evenSplit(total, ids));
      }
    }
  });

  it('rejects nonsense inputs', () => {
    expect(() => evenSplit(100, [])).toThrow();
    expect(() => evenSplit(-1, ['a'])).toThrow();
    expect(() => evenSplit(10.5, ['a'])).toThrow();
  });

  it('redistributes an opt-out across the remaining contributors', () => {
    const rows: ContributionRow[] = [
      { userId: 'a', amountCents: 2500, status: 'pending' },
      { userId: 'b', amountCents: 2500, status: 'pending' },
      { userId: 'c', amountCents: 2500, status: 'pending' },
      { userId: 'd', amountCents: 2500, status: 'opted_out' },
    ];
    const shares = recomputeSplit(10_000, rows);
    expect(shares).toHaveLength(3);
    assertSplitBalances(10_000, shares);
    expect(shares.every((s) => s.amountCents > 3000)).toBe(true);
  });

  it('never rewrites an amount already pulled at Visa', () => {
    const rows: ContributionRow[] = [
      { userId: 'a', amountCents: 2500, status: 'pulled' },
      { userId: 'b', amountCents: 2500, status: 'pending' },
      { userId: 'c', amountCents: 2500, status: 'pending' },
      { userId: 'd', amountCents: 2500, status: 'removed' },
    ];
    const shares = recomputeSplit(10_000, rows);
    expect(shares.find((s) => s.userId === 'a')?.amountCents).toBe(2500);
    assertSplitBalances(10_000, shares);
  });

  it('floors uncommitted shares at zero when pulls already cover the total', () => {
    const rows: ContributionRow[] = [
      { userId: 'a', amountCents: 6000, status: 'pulled' },
      { userId: 'b', amountCents: 6000, status: 'pulled' },
      { userId: 'c', amountCents: 2000, status: 'pending' },
    ];
    const shares = recomputeSplit(10_000, rows);
    expect(shares.find((s) => s.userId === 'c')?.amountCents).toBe(0);
  });

  it('allows opt-out only while no money is in flight', () => {
    expect(canOptOut([{ userId: 'a', amountCents: 100, status: 'pending' }])).toBe(true);
    expect(canOptOut([{ userId: 'a', amountCents: 100, status: 'failed' }])).toBe(true);
    expect(canOptOut([{ userId: 'a', amountCents: 100, status: 'pulled' }])).toBe(false);
    expect(canOptOut([{ userId: 'a', amountCents: 100, status: 'pulling' }])).toBe(false);
  });
});
