import { beforeEach, describe, expect, it } from 'vitest';
import { generateRrn, generateStan } from '../src/lib/ids.js';
import { centsToVisaAmount, visaAmountToCents } from '../src/lib/money.js';
import {
  MOCK_DECLINE_AMOUNT_CENTS,
  MOCK_TIMEOUT_AMOUNT_CENTS,
  mockVisaDirect,
  resetMockVisa,
} from '../src/visa/mock.js';

beforeEach(resetMockVisa);

describe('money', () => {
  it('converts cents to Visa amount strings', () => {
    expect(centsToVisaAmount(1200)).toBe('12.00');
    expect(centsToVisaAmount(5)).toBe('0.05');
    expect(centsToVisaAmount(0)).toBe('0.00');
  });

  it('rejects non-integer and negative amounts', () => {
    expect(() => centsToVisaAmount(12.5)).toThrow();
    expect(() => centsToVisaAmount(-1)).toThrow();
  });

  it('round-trips', () => {
    for (const cents of [1, 99, 100, 123_456]) {
      expect(visaAmountToCents(centsToVisaAmount(cents))).toBe(cents);
    }
  });
});

describe('ids', () => {
  it('generates a 6-digit STAN', () => {
    for (let i = 0; i < 100; i++) expect(generateStan()).toMatch(/^\d{6}$/);
  });

  it('generates a 12-character RRN', () => {
    for (let i = 0; i < 100; i++) expect(generateRrn()).toMatch(/^\d{12}$/);
  });
});

describe('visa mock', () => {
  it('approves a pull and returns a txn id, stan and rrn', async () => {
    const res = await mockVisaDirect.pullFunds({
      cardRef: 'test-card-1',
      amountCents: 2500,
      idempotencyKey: 'contribution:a:pull',
    });
    expect(res.ok).toBe(true);
    expect(res.txnId).toBeTruthy();
    expect(res.actionCode).toBe('00');
    expect(res.stan).toMatch(/^\d{6}$/);
    expect(res.rrn).toMatch(/^\d{12}$/);
  });

  it('approves a push and a reversal', async () => {
    const push = await mockVisaDirect.pushFunds({
      cardRef: 'test-card-4',
      amountCents: 7500,
      idempotencyKey: 'thread:t1:push',
    });
    expect(push.ok).toBe(true);

    const reverse = await mockVisaDirect.reverseFunds({
      originalPull: { stan: '123456', rrn: '612345678901', amountCents: 2500, cardRef: 'test-card-1' },
      idempotencyKey: 'contribution:a:reverse',
    });
    expect(reverse.ok).toBe(true);
    expect(reverse.txnId).toBeTruthy();
  });

  it('declines the magic amount so error paths are testable', async () => {
    const res = await mockVisaDirect.pullFunds({
      cardRef: 'test-card-2',
      amountCents: MOCK_DECLINE_AMOUNT_CENTS,
      idempotencyKey: 'contribution:b:pull',
    });
    expect(res.ok).toBe(false);
    expect(res.actionCode).toBe('05');
    expect(res.error).toBeTruthy();
    expect(res.txnId).toBeUndefined();
  });

  it('is idempotent: the same key never moves money twice', async () => {
    const key = 'contribution:c:pull';
    const first = await mockVisaDirect.pullFunds({ cardRef: 'test-card-3', amountCents: 4000, idempotencyKey: key });
    const second = await mockVisaDirect.pullFunds({ cardRef: 'test-card-3', amountCents: 4000, idempotencyKey: key });
    expect(second).toEqual(first);
    expect(second.txnId).toBe(first.txnId);
  });

  it('times out on the magic amount, and queryStatus resolves it', async () => {
    const res = await mockVisaDirect.pullFunds({
      cardRef: 'test-card-1',
      amountCents: MOCK_TIMEOUT_AMOUNT_CENTS,
      idempotencyKey: 'contribution:d:pull',
    });
    expect(res.ok).toBe(false);
    expect(res.statusIdentifier).toBeTruthy();

    const status = await mockVisaDirect.queryStatus({
      statusIdentifier: res.statusIdentifier!,
      kind: 'pull',
    });
    expect(status.ok).toBe(true);
    expect(status.txnId).toBeTruthy();
  });

  it('reports unknown status identifiers rather than inventing a result', async () => {
    const status = await mockVisaDirect.queryStatus({ statusIdentifier: 'nope', kind: 'push' });
    expect(status.ok).toBe(false);
    expect(status.error).toBeTruthy();
  });
});
