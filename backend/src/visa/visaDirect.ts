import { config } from '../config.js';
import { generateRrn, generateStan, localTransactionDateTime } from '../lib/ids.js';
import { centsToVisaAmount } from '../lib/money.js';
import { getCard, maskPan } from './cards.js';
import { visaRequest } from './client.js';
import { VISA_ENDPOINTS, statusPath } from './types.js';
import type { StoredPull, TxnKind, VisaDirect, VisaTxnResult } from './types.js';

/** Account-to-account, per the sandbox Test Data tab. */
const BUSINESS_APPLICATION_ID = 'AA';
const MERCHANT_CATEGORY_CODE = 6012;

const CARD_ACCEPTOR = {
  pull: { idCode: 'VMT200911086070', terminalId: '365529' },
  push: { idCode: 'VMT200911026070', terminalId: '375539' },
  reverse: { idCode: 'VMT200911086070', terminalId: '365529' },
} as const;

function cardAcceptor(kind: TxnKind) {
  return {
    name: 'Social Shopping Gift Pool',
    idCode: CARD_ACCEPTOR[kind].idCode,
    terminalId: CARD_ACCEPTOR[kind].terminalId,
    address: { country: 'USA', state: 'CA', county: 'San Mateo', zipCode: '94404' },
  };
}

function base(kind: TxnKind, amountCents: number, stan: string, rrn: string) {
  return {
    acquirerCountryCode: config.VISA_ACQUIRER_COUNTRY_CODE,
    acquiringBin: Number(config.VISA_ACQUIRING_BIN),
    amount: centsToVisaAmount(amountCents),
    businessApplicationId: BUSINESS_APPLICATION_ID,
    cardAcceptor: cardAcceptor(kind),
    localTransactionDateTime: localTransactionDateTime(),
    merchantCategoryCode: MERCHANT_CATEGORY_CODE,
    retrievalReferenceNumber: rrn,
    systemsTraceAuditNumber: Number(stan),
  };
}

type VisaBody = {
  actionCode?: string;
  transactionIdentifier?: number | string;
  statusIdentifier?: string;
  responseCode?: string;
  errorMessage?: string;
  message?: string;
};

function interpret(
  status: number,
  body: unknown,
  stan: string,
  rrn: string,
  correlationId?: string,
): VisaTxnResult {
  const parsed = (body ?? {}) as VisaBody;
  const actionCode = parsed.actionCode;
  const ok = status === 200 && actionCode === '00';

  return {
    ok,
    txnId: parsed.transactionIdentifier ? String(parsed.transactionIdentifier) : undefined,
    stan,
    rrn,
    actionCode,
    statusIdentifier: parsed.statusIdentifier,
    raw: body,
    error: ok
      ? undefined
      : (parsed.errorMessage ??
        parsed.message ??
        `Visa returned HTTP ${status}${actionCode ? ` actionCode ${actionCode}` : ''}` +
          (correlationId ? ` (correlation ${correlationId})` : '')),
  };
}

export const sandboxVisaDirect: VisaDirect = {
  async pullFunds({ cardRef, amountCents }) {
    const card = getCard(cardRef);
    const stan = generateStan();
    const rrn = generateRrn();

    const payload = {
      ...base('pull', amountCents, stan, rrn),
      senderPrimaryAccountNumber: card.pan,
      senderCardExpiryDate: card.expirationDate,
      senderCurrencyCode: 'USD',
    };

    const res = await visaRequest('POST', VISA_ENDPOINTS.pull, payload);
    console.log(`visa pull ${maskPan(card.pan)} ${centsToVisaAmount(amountCents)} -> ${res.status} in ${res.durationMs}ms`);
    return interpret(res.status, res.body, stan, rrn, res.correlationId);
  },

  async pushFunds({ cardRef, amountCents, originalPullTxnId }) {
    const card = getCard(cardRef);
    const stan = generateStan();
    const rrn = generateRrn();

    const payload = {
      ...base('push', amountCents, stan, rrn),
      recipientPrimaryAccountNumber: card.pan,
      recipientCardExpiryDate: card.expirationDate,
      transactionCurrencyCode: 'USD',
      sourceOfFundsCode: '05',
      senderName: 'Social Shopping',
      senderAddress: '901 Metro Center Blvd',
      senderCity: 'Foster City',
      senderStateCode: 'CA',
      senderCountryCode: 'USA',
      ...(originalPullTxnId ? { transactionIdentifier: Number(originalPullTxnId) } : {}),
    };

    const res = await visaRequest('POST', VISA_ENDPOINTS.push, payload);
    console.log(`visa push ${maskPan(card.pan)} ${centsToVisaAmount(amountCents)} -> ${res.status} in ${res.durationMs}ms`);
    return interpret(res.status, res.body, stan, rrn, res.correlationId);
  },

  async reverseFunds({ originalPull }: { originalPull: StoredPull; idempotencyKey: string }) {
    const card = getCard(originalPull.cardRef);
    const stan = generateStan();
    const rrn = generateRrn();

    const payload = {
      ...base('reverse', originalPull.amountCents, stan, rrn),
      senderPrimaryAccountNumber: card.pan,
      senderCardExpiryDate: card.expirationDate,
      originalDataElements: {
        acquiringBin: Number(config.VISA_ACQUIRING_BIN),
        acquirerCountryCode: config.VISA_ACQUIRER_COUNTRY_CODE,
        systemsTraceAuditNumber: Number(originalPull.stan),
        approvalCode: undefined,
      },
      ...(originalPull.txnId ? { transactionIdentifier: Number(originalPull.txnId) } : {}),
    };

    const res = await visaRequest('POST', VISA_ENDPOINTS.reverse, payload);
    console.log(`visa reverse ${maskPan(card.pan)} ${centsToVisaAmount(originalPull.amountCents)} -> ${res.status} in ${res.durationMs}ms`);
    return interpret(res.status, res.body, stan, rrn, res.correlationId);
  },

  async queryStatus({ statusIdentifier, kind }) {
    const res = await visaRequest('GET', statusPath(kind, statusIdentifier));
    return interpret(res.status, res.body, '', '', res.correlationId);
  },
};

export { VISA_ENDPOINTS };
