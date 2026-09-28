import { describe, expect, it } from 'vitest';
import { createLogEvent, redactLogValue } from '@/shared/observability/logger';

describe('secure logger', () => {
  it('redacts sensitive keys recursively', () => {
    const result = redactLogValue({
      user: 'qa@example.com',
      password: 'do-not-log',
      nested: {
        access_token: 'token-value',
        safe: 'visible',
      },
    });

    expect(result).toEqual({
      user: 'qa@example.com',
      password: '[REDACTED]',
      nested: {
        access_token: '[REDACTED]',
        safe: 'visible',
      },
    });
  });

  it('creates structured events without leaking context secrets', () => {
    const event = createLogEvent('SECURITY', 'Auth rejected', { authorization: 'Bearer x' }, 'c-1');
    expect(event.level).toBe('SECURITY');
    expect(event.correlationId).toBe('c-1');
    expect(event.context).toEqual({ authorization: '[REDACTED]' });
  });
});
