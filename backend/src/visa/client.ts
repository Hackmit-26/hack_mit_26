import { readFileSync } from 'node:fs';
import https from 'node:https';
import { URL } from 'node:url';
import { config } from '../config.js';
import { encryptPayload, mleEnabled, unwrapResponse } from './mle.js';

export type VisaResponse = {
  status: number;
  body: unknown;
  durationMs: number;
  correlationId?: string;
};

let agent: https.Agent | undefined;

function loadAgent(): https.Agent {
  if (agent) return agent;

  const read = (path: string, required: boolean): Buffer | undefined => {
    try {
      return readFileSync(path);
    } catch (err) {
      if (required) {
        throw new Error(
          `Could not read ${path}. Download it from the Visa Developer project dashboard.`,
        );
      }
      return undefined;
    }
  };

  agent = new https.Agent({
    cert: read(config.VISA_CERT_PATH, true),
    key: read(config.VISA_KEY_PATH, true),
    ca: read(config.VISA_CA_PATH, false),
    keepAlive: true,
  });
  return agent;
}

function authHeader(): string {
  const raw = `${config.VISA_USER_ID}:${config.VISA_PASSWORD}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

function send(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  extraHeaders: Record<string, string>,
): Promise<VisaResponse> {
  const url = new URL(path, config.VISA_BASE_URL);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        agent: loadAgent(),
        headers: {
          Authorization: authHeader(),
          Accept: 'application/json',
          ...extraHeaders,
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed: unknown = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            // Visa returns HTML on some auth failures; keep the raw text.
          }
          const correlationId = res.headers['x-correlation-id'];
          resolve({
            status: res.statusCode ?? 0,
            body: parsed,
            durationMs: Date.now() - startedAt,
            correlationId: Array.isArray(correlationId) ? correlationId[0] : correlationId,
          });
        });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function visaRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<VisaResponse> {
  if (!mleEnabled) return send(method, path, body, {});

  const headers = { keyId: config.VISA_MLE_KEY_ID as string };
  const res = await send(
    method,
    path,
    body === undefined ? undefined : await encryptPayload(body),
    headers,
  );

  try {
    return { ...res, body: await unwrapResponse(res.body) };
  } catch {
    // Gateway-level rejections come back in the clear; keep them readable.
    return res;
  }
}
