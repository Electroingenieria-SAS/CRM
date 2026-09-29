import { describe, expect, it, vi } from 'vitest';
import { logStructured } from '@/shared/observability/logger';

describe('structured logger', () => {
  it('redacts secrets and common PII keys', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const payload = logStructured({
      level: 'info',
      event: 'test_event',
      correlationId: 'corr-test',
      context: {
        email: 'private@example.test',
        token: 'secret',
        safe: 'visible',
        nested: { password: 'hidden', result: 'ok' },
      },
    });

    expect(payload.context).toEqual({ safe: 'visible', nested: { result: 'ok' } });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
