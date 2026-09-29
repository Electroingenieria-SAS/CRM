export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const sensitiveKeys = new Set([
  'password',
  'passwd',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'serviceRole',
  'service_role',
  'secret',
  'jwt',
  'email',
  'phone',
  'address',
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') return value.slice(0, 500);
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(key))
      .slice(0, 30)
      .map(([key, item]) => [key, sanitize(item, depth + 1)]),
  );
}

export interface StructuredLog {
  level: LogLevel;
  event: string;
  correlationId?: string;
  module?: string;
  durationMs?: number;
  context?: Record<string, unknown>;
}

export function correlationId() {
  return crypto.randomUUID();
}

export function logStructured(entry: StructuredLog) {
  const payload = {
    timestamp: new Date().toISOString(),
    level: entry.level,
    event: entry.event.slice(0, 120),
    correlationId: entry.correlationId ?? correlationId(),
    module: entry.module,
    durationMs: entry.durationMs,
    context: sanitize(entry.context ?? {}),
  };
  const line = JSON.stringify(payload);

  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else if (entry.level === 'debug') console.debug(line);
  else console.info(line);

  if (typeof window !== 'undefined' && (entry.level === 'warn' || entry.level === 'error')) {
    window.dispatchEvent(new CustomEvent('crm:telemetry', { detail: payload }));
  }

  return payload;
}
