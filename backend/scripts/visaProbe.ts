import { visaRequest } from '../src/visa/client.js';

const probes: Array<[string, 'GET' | 'POST', string, unknown?]> = [
  ['GET pull status', 'GET', '/visadirect/fundstransfer/v1/pullfundstransactions/12345'],
  ['GET push status', 'GET', '/visadirect/fundstransfer/v1/pushfundstransactions/12345'],
  ['POST pull empty', 'POST', '/visadirect/fundstransfer/v1/pullfundstransactions', {}],
];

for (const [label, method, path, body] of probes) {
  const res = await visaRequest(method, path, body);
  console.log(`${label} -> ${res.status} ${JSON.stringify(res.body)}`);
}
