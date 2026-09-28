const sensitiveKeyPattern =
  /password|passwd|secret|service[_-]?role|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|session[_-]?token|api[_-]?key/i;

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface LogEvent {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly correlationId?: string;
  readonly context?: unknown;
}

export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactLogValue(item, seen);
  }
  return output;
}

export function createLogEvent(
  level: LogLevel,
  message: string,
  context?: unknown,
  correlationId?: string,
): LogEvent {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(correlationId ? { correlationId } : {}),
    ...(context === undefined ? {} : { context: redactLogValue(context) }),
  };
}

export function writeLog(event: LogEvent): void {
  const serialized = JSON.stringify(event);
  if (event.level === 'ERROR' || event.level === 'SECURITY') {
    console.error(serialized);
    return;
  }
  if (event.level === 'WARN') {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
}
