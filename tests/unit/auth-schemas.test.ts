import { describe, expect, it } from 'vitest';
import { passwordUpdateSchema, signInSchema } from '@/modules/auth/application/auth.schemas';

describe('auth schemas', () => {
  it('normalizes email and preserves password', () => {
    const result = signInSchema.parse({
      email: '  USER@EI.COM.CO ',
      password: 'secret',
    });

    expect(result.email).toBe('user@ei.com.co');
    expect(result.password).toBe('secret');
  });

  it('requires a stronger replacement password', () => {
    expect(() => passwordUpdateSchema.parse({ password: 'short' })).toThrow();
    expect(passwordUpdateSchema.parse({ password: 'correct-horse-battery-staple' }).password).toBe(
      'correct-horse-battery-staple',
    );
  });
});
