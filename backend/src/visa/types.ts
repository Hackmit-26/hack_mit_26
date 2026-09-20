export const VISA_ENDPOINTS = {
  pull: '/visadirect/fundstransfer/v1/pullfundstransactions',
  push: '/visadirect/fundstransfer/v1/pushfundstransactions',
  reverse: '/visadirect/fundstransfer/v1/reversefundstransactions',
} as const;

export type TxnKind = keyof typeof VISA_ENDPOINTS;

export function statusPath(kind: TxnKind, statusIdentifier: string): string {
  return `${VISA_ENDPOINTS[kind]}/${statusIdentifier}`;
}

export type VisaTxnResult = {
  ok: boolean;
  /** Visa's transactionIdentifier. Pass a pull's value into the matching push for reconciliation. */
  txnId?: string;
  stan: string;
  rrn: string;
  actionCode?: string;
  /** Only returned when the POST timed out; use it with queryStatus to find out what happened. */
  statusIdentifier?: string;
  /** Both echoed back on an approval, and both required to reverse it later. */
  approvalCode?: string;
  transmissionDateTime?: string;
  /**
   * Visa's `X-Correlation-Id`. The sandbox keeps no ledger a developer can browse, so this is the
   * only handle Visa support can trace a call by - worth storing on every row, not just failures.
   */
  correlationId?: string;
  raw: unknown;
  error?: string;
};

export type StoredPull = {
  stan: string;
  rrn: string;
  txnId?: string;
  amountCents: number;
  cardRef: string;
  /** From the pull's own response: Visa rejects `originalDataElements` without them. */
  approvalCode?: string;
  transmissionDateTime?: string;
};

export interface VisaDirect {
  pullFunds(p: {
    cardRef: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<VisaTxnResult>;

  pushFunds(p: {
    cardRef: string;
    amountCents: number;
    idempotencyKey: string;
    /** transactionIdentifier from the originating pull, when there is a single one to cite. */
    originalPullTxnId?: string;
  }): Promise<VisaTxnResult>;

  reverseFunds(p: { originalPull: StoredPull; idempotencyKey: string }): Promise<VisaTxnResult>;

  queryStatus(p: { statusIdentifier: string; kind: TxnKind }): Promise<VisaTxnResult>;
}
