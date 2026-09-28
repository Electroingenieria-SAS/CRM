import { describe, expect, it, vi } from 'vitest';
import type {
  AuthGateway,
  AuthSession,
  AuthSessionEvent,
} from '@/modules/auth/application/auth-gateway';
import { AuthService } from '@/modules/auth/application/auth-service';
import type { SessionRepository } from '@/modules/auth/application/session-repository';
import type { SessionContext } from '@/modules/auth/application/session.schemas';

const context: SessionContext = {
  profile: {
    id: '30000000-0000-0000-0000-000000000001',
    email: 'seller@example.test',
    name: 'Seller',
    employeeCode: 'SELLER-1',
    roles: ['ventas'],
    preferences: {},
  },
  organization: {
    id: '20000000-0000-0000-0000-000000000001',
    code: 'EI',
    name: 'Electroingeniería',
    timezone: 'America/Bogota',
    settings: {},
  },
  modules: [
    {
      code: 'orders',
      name: 'Pedidos',
      sortOrder: 20,
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canApprove: false,
      canAdmin: false,
    },
  ],
  catalogs: {
    orderTypes: [],
    paymentConditions: [],
    deliveryRoutes: [],
    steps: [],
    priorities: [],
  },
  serverTime: '2026-09-28T14:00:00Z',
  contractVersion: '1.0.0',
};

function createGateway(
  session: AuthSession | null = {
    userId: '10000000-0000-0000-0000-000000000001',
    email: 'seller@example.test',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  },
): AuthGateway {
  return {
    signIn: vi.fn(async () => session!),
    signOut: vi.fn(async () => undefined),
    getSession: vi.fn(async () => session),
    requestPasswordReset: vi.fn(async () => undefined),
    exchangeRecoveryCode: vi.fn(async () => session!),
    updatePassword: vi.fn(async () => undefined),
    onSessionChange: vi.fn((listener: (event: AuthSessionEvent) => void) => {
      void listener;
      return () => undefined;
    }),
  };
}

function createSessions(load = vi.fn(async () => context)): SessionRepository {
  return { load };
}

describe('auth service', () => {
  it('normalizes credentials and loads the operational context after login', async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, createSessions());

    const result = await service.signIn({
      email: '  SELLER@EXAMPLE.TEST ',
      password: 'secret',
    });

    expect(result).toEqual(context);
    expect(gateway.signIn).toHaveBeenCalledWith({
      email: 'seller@example.test',
      password: 'secret',
    });
  });

  it('signs out when authentication succeeds but the operational context cannot load', async () => {
    const gateway = createGateway();
    const sessions = createSessions(vi.fn(async () => Promise.reject(new Error('context failed'))));
    const service = new AuthService(gateway, sessions);

    await expect(
      service.signIn({ email: 'seller@example.test', password: 'secret' }),
    ).rejects.toThrow('context failed');
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it('restores an active session and rejects an expired one', async () => {
    const activeGateway = createGateway();
    const active = new AuthService(activeGateway, createSessions());
    await expect(active.restoreContext()).resolves.toEqual(context);

    const expiredGateway = createGateway({
      userId: '10000000-0000-0000-0000-000000000001',
      email: 'seller@example.test',
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });
    const expired = new AuthService(expiredGateway, createSessions());

    await expect(expired.restoreContext()).resolves.toBeNull();
    expect(expiredGateway.signOut).toHaveBeenCalledOnce();
  });

  it('exchanges a recovery code before allowing a password update session', async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, createSessions());

    await service.preparePasswordRecovery({ code: 'recovery-code', flowId: 'flow-1' });

    expect(gateway.exchangeRecoveryCode).toHaveBeenCalledWith('recovery-code', 'flow-1');
  });

  it('does not disclose account existence through the application recovery contract', async () => {
    const gateway = createGateway();
    const service = new AuthService(gateway, createSessions());

    await expect(
      service.requestPasswordReset({ email: 'unknown@example.test' }, 'https://example.test/reset'),
    ).resolves.toBeUndefined();
  });

  it('converts weak password validation into a safe user-facing error', async () => {
    const service = new AuthService(createGateway(), createSessions());

    await expect(service.updatePassword({ password: 'short' })).rejects.toThrow(
      'La nueva contraseña debe tener al menos 12 caracteres.',
    );
  });
});
