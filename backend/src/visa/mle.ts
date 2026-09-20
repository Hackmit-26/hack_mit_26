import { readFileSync } from 'node:fs';
import { CompactEncrypt, compactDecrypt, importPKCS8, importX509 } from 'jose';
import type { CryptoKey } from 'jose';
import { config } from '../config.js';

/**
 * Visa Message Level Encryption.
 *
 * When MLE is on for a project, the gateway rejects plaintext bodies with
 * `400 9125 Expected input credential was not present` - the missing credential
 * is the `keyId` header, not the client certificate. Requests carry
 * `{ encData: <compact JWE> }` encrypted to Visa's MLE certificate; responses
 * come back the same way, encrypted to our client certificate's public key, so
 * our own private key decrypts them.
 */

const ALG = 'RSA-OAEP-256';
const ENC = 'A128GCM';

export const mleEnabled = Boolean(config.VISA_MLE_KEY_ID);

let encryptionKey: Promise<CryptoKey> | undefined;
let decryptionKey: Promise<CryptoKey> | undefined;

function read(path: string, what: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Could not read ${what} at ${path}. Download it from the Visa Developer project dashboard.`);
  }
}

function serverCert(): Promise<CryptoKey> {
  encryptionKey ??= importX509(read(config.VISA_MLE_SERVER_CERT_PATH, 'the Visa MLE certificate'), ALG);
  return encryptionKey;
}

function privateKey(): Promise<CryptoKey> {
  const path = config.VISA_MLE_PRIVATE_KEY_PATH ?? config.VISA_KEY_PATH;
  decryptionKey ??= importPKCS8(read(path, 'the MLE private key'), ALG);
  return decryptionKey;
}

/** Wraps a request body as `{ encData }`. `iat` is milliseconds and Visa only honours it for two minutes. */
export async function encryptPayload(body: unknown): Promise<{ encData: string }> {
  const jwe = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(body)))
    .setProtectedHeader({
      alg: ALG,
      enc: ENC,
      kid: config.VISA_MLE_KEY_ID,
      iat: Date.now(),
    })
    .encrypt(await serverCert());

  return { encData: jwe };
}

export async function decryptPayload(encData: string): Promise<unknown> {
  const { plaintext } = await compactDecrypt(encData, await privateKey());
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/** Visa encrypts error envelopes too, so unwrap whatever carries `encData`. */
export async function unwrapResponse(body: unknown): Promise<unknown> {
  if (body && typeof body === 'object' && 'encData' in body) {
    const { encData } = body as { encData: unknown };
    if (typeof encData === 'string') return decryptPayload(encData);
  }
  return body;
}
