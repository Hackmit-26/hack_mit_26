type Level = 'info' | 'warn' | 'error';

const REDACT = /\b(\d{13,19})\b/g;

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(REDACT, (pan) => `****${pan.slice(-4)}`);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) =>
        /pan|primaryAccountNumber|password|token|key|secret/i.test(k)
          ? [k, '[redacted]']
          : [k, scrub(v)],
      ),
    );
  }
  return value;
}

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...(fields ? (scrub(fields) as Record<string, unknown>) : {}),
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit('error', message, fields),
};
