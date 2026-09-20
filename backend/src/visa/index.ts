import { config } from '../config.js';
import { mockVisaDirect } from './mock.js';
import type { VisaDirect } from './types.js';
import { sandboxVisaDirect } from './visaDirect.js';

export const visa: VisaDirect = config.VISA_MODE === 'sandbox' ? sandboxVisaDirect : mockVisaDirect;

export * from './types.js';
