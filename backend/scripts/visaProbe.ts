import { config } from '../src/config.js';
import { visaRequest } from '../src/visa/client.js';
import { assertMleKeys, describeServerCert, mleEnabled } from '../src/visa/mle.js';
import { VISA_ENDPOINTS } from '../src/visa/types.js';

/**
 * Tells apart the three ways a Visa Direct call fails before it ever reaches the
 * funds transfer logic:
 *
 *   9611  the project is not entitled to the product
 *   9005  the route does not exist
 *   9125  entitled, but the gateway wants a credential we did not send - with
 *         two-way SSL already answering 200 on helloworld this means Message
 *         Level Encryption is on and the request needs a `keyId` header plus a
 *         JWE `encData` body
 */
const probes: Array<[string, 'GET' | 'POST', string, unknown?]> = [
  ['two-way SSL', 'GET', '/vdp/helloworld'],
  ['pull', 'POST', VISA_ENDPOINTS.pull, {}],
  ['push', 'POST', VISA_ENDPOINTS.push, {}],
  ['reverse', 'POST', VISA_ENDPOINTS.reverse, {}],
  ['unentitled control', 'POST', '/forexrates/v1/foreignexchangerates', {}],
  ['unrouted control', 'POST', '/visadirect/v1/multipushfundstransactions', {}],
];

console.log(`base ${config.VISA_BASE_URL}  mle ${mleEnabled ? `on (${config.VISA_MLE_KEY_ID})` : 'off'}`);

// Checked before any socket opens: a missing or unreadable key is our mistake, and finding it
// here rather than inside a 9125 is the difference between a one-line fix and a re-diagnosis.
try {
  await assertMleKeys();
  if (!mleEnabled) {
    console.log('mle keys   skipped (VISA_MLE_KEY_ID is blank)\n');
  } else {
    const cert = describeServerCert();
    console.log(`mle keys   loaded, both parse`);
    console.log(`  encrypting to  ${cert.subject}`);
    console.log(`  issued by      ${cert.issuer}`);
    console.log(`  expires        ${cert.validTo}`);
    if (cert.isOurs) {
      console.log(
        '  WRONG FILE     this is our own client certificate, not Visa\'s server encryption\n' +
          '                 certificate. Visa cannot decrypt a payload sealed to our own key,\n' +
          '                 so this still answers 9125. Re-download the server certificate.',
      );
    }
    console.log();
  }
} catch (err) {
  console.log(`mle keys   BROKEN - ${(err as Error).message}\n`);
}

for (const [label, method, path, body] of probes) {
  try {
    const res = await visaRequest(method, path, body);
    const raw = JSON.stringify(res.body);
    const code = raw.match(/"code":"?(\d+)"?/)?.[1] ?? '-';
    console.log(`${label.padEnd(20)} ${String(res.status).padEnd(4)} ${code.padEnd(6)} ${raw.slice(0, 96)}`);
  } catch (err) {
    console.log(`${label.padEnd(20)} ERROR ${(err as Error).message}`);
  }
}
