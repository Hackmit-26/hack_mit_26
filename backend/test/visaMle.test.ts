import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeProtectedHeader } from 'jose';
import { describe, expect, it } from 'vitest';

// Visa's MLE certificate and our private key are the same key pair here, which lets one
// throwaway self-signed pair stand in for both halves of the round trip.
const dir = mkdtempSync(join(tmpdir(), 'mle-'));
const keyPath = join(dir, 'key.pem');
const certPath = join(dir, 'cert.pem');

execFileSync(
  'openssl',
  [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=mle-test',
    '-keyout', keyPath, '-out', certPath,
  ],
  { stdio: 'ignore' },
);

process.env.VISA_MLE_KEY_ID = 'test-key-id';
process.env.VISA_MLE_SERVER_CERT_PATH = certPath;
process.env.VISA_MLE_PRIVATE_KEY_PATH = keyPath;

const { decryptPayload, encryptPayload, mleEnabled, unwrapResponse } = await import('../src/visa/mle.js');

describe('visa message level encryption', () => {
  it('turns on once a key id is configured', () => {
    expect(mleEnabled).toBe(true);
  });

  it('round-trips a funds transfer payload', async () => {
    const payload = { amount: '93.00', systemsTraceAuditNumber: 302006 };
    const { encData } = await encryptPayload(payload);

    expect(encData.split('.')).toHaveLength(5);
    await expect(decryptPayload(encData)).resolves.toEqual(payload);
  });

  it('writes the JOSE header Visa requires', async () => {
    const before = Date.now();
    const { encData } = await encryptPayload({ amount: '1.00' });
    const header = decodeProtectedHeader(encData);

    expect(header.alg).toBe('RSA-OAEP-256');
    expect(header.enc).toBe('A128GCM');
    expect(header.kid).toBe('test-key-id');
    // Visa expects `iat` in milliseconds and only honours it for two minutes.
    expect(header.iat).toBeGreaterThanOrEqual(before);
    expect(header.iat).toBeLessThanOrEqual(Date.now());
  });

  it('unwraps an encrypted response envelope', async () => {
    const { encData } = await encryptPayload({ actionCode: '00' });
    await expect(unwrapResponse({ encData })).resolves.toEqual({ actionCode: '00' });
  });

  it('passes through a plaintext gateway error', async () => {
    const error = { responseStatus: { status: 400, code: '9125' } };
    await expect(unwrapResponse(error)).resolves.toEqual(error);
  });
});
