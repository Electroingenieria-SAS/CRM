import { describe, expect, it } from 'vitest';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';

const context: Pick<SessionContext, 'modules'> = {
  modules: [
    {
      code: 'orders',
      name: 'Pedidos',
      sortOrder: 20,
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canApprove: false,
      canAdmin: false,
    },
  ],
};

describe('session permissions', () => {
  it('authorizes from module capabilities instead of role-name checks', () => {
    expect(hasModuleCapability(context, 'orders', 'read')).toBe(true);
    expect(hasModuleCapability(context, 'orders', 'create')).toBe(false);
    expect(hasModuleCapability(context, 'admin', 'read')).toBe(false);
  });
});
