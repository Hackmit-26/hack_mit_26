import { config } from '../src/config.js';
import { visaRequest } from '../src/visa/client.js';

const res = await visaRequest('GET', '/vdp/helloworld');

console.log(`${config.VISA_BASE_URL}/vdp/helloworld -> ${res.status} in ${res.durationMs}ms`);
if (res.correlationId) console.log(`x-correlation-id: ${res.correlationId}`);
console.log(JSON.stringify(res.body, null, 2));

process.exit(res.status === 200 ? 0 : 1);
