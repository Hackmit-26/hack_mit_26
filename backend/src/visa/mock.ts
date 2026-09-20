import { generateRrn, generateStan } from '../lib/ids.js';
import { centsToVisaAmount } from '../lib/money.js';
import type { StoredPull, TxnKind, VisaDirect, VisaTxnResult } from './types.js';

/** Any call for this amount fails, so error paths are testable without touching the network. */
export const MOCK_DECLINE_AMOUNT_CENTS = 1313;
/** Any call for this amount times out, exercising the statusIdentifier recovery path. */
export const MOCK_TIMEOUT_AMOUNT_CENTS = 1414;

type MockRecord = VisaTxnResult & { kind: TxnKind; amountCents: number };

const byIdempotencyKey = new Map<string, MockRecord>();
const byStatusIdentifier = new Map<string, MockRecord>();

let counter = 0;
function nextTxnId(): string {
  counter += 1;
  return String(4_000_000_000_000 + counter);
}

function record(kind: TxnKind, amountCents: number, idempotencyKey: string): VisaTxnResult {
  const existing = byIdempotencyKey.get(idempotencyKey);
  if (existing) return existing;

  const stan = generateStan();
  const rrn = generateRrn();

  let result: MockRecord;
  if (amountCents === MOCK_DECLINE_AMOUNT_CENTS) {
    result = {
      kind,
      amountCents,
      ok: false,
      stan,
      rrn,
      actionCode: '05',
      error: 'Do not honour (mock decline)',
      raw: { mock: true, kind, actionCode: '05' },
    };
  } else if (amountCents === MOCK_TIMEOUT_AMOUNT_CENTS) {
    const statusIdentifier = `mock-status-${nextTxnId()}`;
    result = {
      kind,
      amountCents,
      ok: false,
      stan,
      rrn,
      statusIdentifier,
      error: 'Timeout (mock)',
      raw: { mock: true, kind, statusIdentifier },
    };
    byStatusIdentifier.set(statusIdentifier, {
      ...result,
      ok: true,
      actionCode: '00',
      txnId: nextTxnId(),
      error: undefined,
    });
  } else {
    result = {
      kind,
      amountCents,
      ok: true,
      txnId: nextTxnId(),
      stan,
      rrn,
      actionCode: '00',
      raw: { mock: true, kind, amount: centsToVisaAmount(amountCents) },
    };
  }

  byIdempotencyKey.set(idempotencyKey, result);
  return result;
}

export const mockVisaDirect: VisaDirect = {
  async pullFunds({ amountCents, idempotencyKey }) {
    return record('pull', amountCents, idempotencyKey);
  },

  async pushFunds({ amountCents, idempotencyKey }) {
    return record('push', amountCents, idempotencyKey);
  },

  async reverseFunds({ originalPull, idempotencyKey }: { originalPull: StoredPull; idempotencyKey: string }) {
    return record('reverse', originalPull.amountCents, idempotencyKey);
  },

  async queryStatus({ statusIdentifier }) {
    const found = byStatusIdentifier.get(statusIdentifier);
    if (found) return found;
    return {
      ok: false,
      stan: generateStan(),
      rrn: generateRrn(),
      error: 'Unknown statusIdentifier (mock)',
      raw: { mock: true, statusIdentifier },
    };
  },
};

/** Test helper: wipe the in-memory ledger between cases. */
export function resetMockVisa(): void {
  byIdempotencyKey.clear();
  byStatusIdentifier.clear();
  counter = 0;
}
