import { describe, expect, it } from 'vitest';
import { can, type AuthorizationContext } from '@/modules/auth/domain/permission';

describe('central permission guard', () => {
  it('allows only explicit permissions', () => {
    const context: AuthorizationContext = {
      permissions: new Set(['orders.read', 'orders.create']),
    };

    expect(can(context, 'orders.read')).toBe(true);
    expect(can(context, 'roles.manage')).toBe(false);
  });
});
