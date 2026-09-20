import { describe, expect, it } from 'vitest';
import { safeJson } from '../src/db/mirror.js';

describe('safeJson', () => {
  it('leaves a numeric transactionIdentifier intact and parseable', () => {
    const raw = safeJson({ transactionIdentifier: 132415038047290, actionCode: '00' });
    expect(JSON.parse(raw)).toEqual({ transactionIdentifier: 132415038047290, actionCode: '00' });
  });

  it('masks a PAN by field name', () => {
    const raw = safeJson({ senderPrimaryAccountNumber: '4895142232120006' });
    expect(JSON.parse(raw)).toEqual({ senderPrimaryAccountNumber: '****0006' });
  });

  it('masks a bare PAN-shaped string', () => {
    expect(JSON.parse(safeJson({ card: '4895142232120006' }))).toEqual({ card: '****0006' });
  });

  it('always returns something Postgres can cast to jsonb', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => JSON.parse(safeJson(cyclic))).not.toThrow();
  });
});
