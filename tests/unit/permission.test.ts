import { describe, expect, it } from 'vitest';
import {
  can,
  toPermission,
  toResourceCode,
  type AuthorizationContext,
  type Permission,
} from '@/modules/auth/domain/permission';

describe('central permission guard', () => {
  it('allows only explicit permissions', () => {
    const orders = toResourceCode('orders');
    const roles = toResourceCode('roles');
    const context: AuthorizationContext = {
      permissions: new Set<Permission>([
        toPermission(orders, 'read'),
        toPermission(orders, 'create'),
      ]),
    };

    expect(can(context, toPermission(orders, 'read'))).toBe(true);
    expect(can(context, toPermission(roles, 'admin'))).toBe(false);
  });

  it('normalizes resource codes and rejects malformed values', () => {
    expect(toResourceCode('Workforce_Planner')).toBe('workforce_planner');
    expect(() => toResourceCode('../admin')).toThrow('Código de recurso inválido');
  });
});
