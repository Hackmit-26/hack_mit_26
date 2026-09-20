import { invalidState } from '../lib/errors.js';

export const THREAD_STATES = [
  'picking',
  'voting',
  'collecting',
  'funded',
  'bought',
  'revealed',
  'refunding',
  'refunded',
] as const;

export type ThreadState = (typeof THREAD_STATES)[number];

export type ThreadEvent =
  | 'picks_generated'
  | 'lock'
  | 'all_pulled'
  | 'mark_bought'
  | 'reveal'
  | 'cancel'
  | 'deadline_missed'
  | 'all_reversed';

export type TransitionContext = {
  isOrganiser: boolean;
};

type Rule = {
  from: ThreadState;
  to: ThreadState;
  organiserOnly: boolean;
};

const RULES: Record<ThreadEvent, Rule[]> = {
  picks_generated: [{ from: 'picking', to: 'voting', organiserOnly: false }],
  lock: [{ from: 'voting', to: 'collecting', organiserOnly: true }],
  all_pulled: [{ from: 'collecting', to: 'funded', organiserOnly: false }],
  mark_bought: [{ from: 'funded', to: 'bought', organiserOnly: true }],
  reveal: [{ from: 'bought', to: 'revealed', organiserOnly: true }],
  // Nothing has been pulled before `collecting`, so there is nothing to reverse.
  cancel: [
    { from: 'picking', to: 'refunded', organiserOnly: true },
    { from: 'voting', to: 'refunded', organiserOnly: true },
    { from: 'collecting', to: 'refunding', organiserOnly: true },
  ],
  // Raised by the sweeper job, which acts on behalf of the system rather than a member.
  deadline_missed: [{ from: 'collecting', to: 'refunding', organiserOnly: false }],
  all_reversed: [{ from: 'refunding', to: 'refunded', organiserOnly: false }],
};

export function canTransition(from: ThreadState, event: ThreadEvent): boolean {
  return RULES[event].some((rule) => rule.from === from);
}

export function transition(
  from: ThreadState,
  event: ThreadEvent,
  ctx: TransitionContext,
): ThreadState {
  const rule = RULES[event].find((r) => r.from === from);
  if (!rule) {
    throw invalidState(`Cannot ${event} a thread in state "${from}"`);
  }
  if (rule.organiserOnly && !ctx.isOrganiser) {
    throw invalidState(`Only the organiser can ${event} this thread`);
  }
  return rule.to;
}

const TERMINAL: ReadonlySet<ThreadState> = new Set<ThreadState>(['revealed', 'refunded']);

export function isTerminal(state: ThreadState): boolean {
  return TERMINAL.has(state);
}

/** States in which the winning pick is committed to, so the item counts as "taken" (§7.10). */
const TAKEN_STATES: ReadonlySet<ThreadState> = new Set<ThreadState>([
  'collecting',
  'funded',
  'bought',
]);

export function marksPickTaken(state: ThreadState): boolean {
  return TAKEN_STATES.has(state);
}
