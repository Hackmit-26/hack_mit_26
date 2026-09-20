import { X509Certificate, createPrivateKey } from 'node:crypto';
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
  // The Visa dashboard hands out PKCS#1 (`BEGIN RSA PRIVATE KEY`) and `importPKCS8` only takes
  // PKCS#8. Node reads both, so re-export through it rather than asking anyone to convert a file.
  decryptionKey ??= importPKCS8(
    createPrivateKey(read(config.VISA_MLE_PRIVATE_KEY_PATH, 'the MLE private key')).export({
      type: 'pkcs8',
      format: 'pem',
    }) as string,
    ALG,
  );
  return decryptionKey;
}

/** Loads both keys so a bad path or format surfaces at startup rather than as a Visa error code. */
export async function assertMleKeys(): Promise<void> {
  if (!mleEnabled) return;
  await Promise.all([serverCert(), privateKey()]);
}

export type MleCertInfo = { subject: string; issuer: string; validTo: string; isOurs: boolean };

/**
 * Describes whatever is sitting at VISA_MLE_SERVER_CERT_PATH. The dashboard hands out two
 * certificates and they are easy to swap: the one we want is Visa's server encryption
 * certificate, not the client certificate signed from our own CSR. Encrypting to our own
 * certificate produces a JWE Visa cannot read and answers 9125 all over again - the same
 * symptom as sending no encryption at all, which is a miserable thing to re-diagnose.
 */
export function describeServerCert(): MleCertInfo {
  const cert = new X509Certificate(read(config.VISA_MLE_SERVER_CERT_PATH, 'the Visa MLE certificate'));
  const ours = new X509Certificate(readFileSync(config.VISA_CERT_PATH));
  return {
    subject: cert.subject.replace(/\n/g, ', '),
    issuer: cert.issuer.replace(/\n/g, ', '),
    validTo: cert.validTo,
    isOurs: cert.publicKey.export({ type: 'spki', format: 'pem' }).toString() ===
      ours.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
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
  let plaintext: Uint8Array;
  try {
    ({ plaintext } = await compactDecrypt(encData, await privateKey()));
  } catch (err) {
    throw new Error(
      `Visa encrypted its response to a key we do not hold (${(err as Error).message}). ` +
        'VISA_MLE_PRIVATE_KEY_PATH must be the key minted alongside VISA_MLE_KEY_ID, not the two-way-SSL key.',
    );
  }
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
