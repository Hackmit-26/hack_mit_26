import { sandboxVisaDirect } from '../src/visa/visaDirect.js';

const pull = await sandboxVisaDirect.pullFunds({
  cardRef: 'test-card-1',
  amountCents: 2500,
  idempotencyKey: 'smoke:pull',
});
console.log('pull:', JSON.stringify(pull, null, 2));

if (!pull.ok) process.exit(1);

const push = await sandboxVisaDirect.pushFunds({
  cardRef: 'test-card-2',
  amountCents: 2500,
  idempotencyKey: 'smoke:push',
  originalPullTxnId: pull.txnId,
});
console.log('push:', JSON.stringify(push, null, 2));

const reverse = await sandboxVisaDirect.reverseFunds({
  originalPull: {
    stan: pull.stan,
    rrn: pull.rrn,
    txnId: pull.txnId,
    amountCents: 2500,
    cardRef: 'test-card-1',
    approvalCode: pull.approvalCode,
    transmissionDateTime: pull.transmissionDateTime,
  },
  idempotencyKey: 'smoke:reverse',
});
console.log('reverse:', JSON.stringify(reverse, null, 2));

process.exit(push.ok && reverse.ok ? 0 : 1);
