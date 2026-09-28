import { describe, expect, it, vi } from 'vitest';
import { OrdersWorkforceHealthService } from '@/modules/integrations/orders-workforce/application/orders-workforce-health-service';
import type { OrderWorkforceOutboxPort } from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';

function outbox(): OrderWorkforceOutboxPort {
  return {
    binding: vi.fn(),
    health: vi.fn().mockResolvedValue({
      summary: {
        pending: 2,
        processing: 1,
        processed: 8,
        failed: 1,
        staleProcessing: 0,
      },
      pendingByStep: { CORTE: 2, LOCAL_DISPATCH: 1 },
      oldestPendingAt: '2026-09-28T14:00:00-05:00',
      contractVersion: '1.0.0',
    }),
    listPending: vi.fn(),
    claim: vi.fn(),
    markProcessed: vi.fn(),
    markFailed: vi.fn(),
    reconcile: vi.fn().mockResolvedValue({
      items: [{ issue: 'MISSING_INTEGRATION_EVENT' }],
      repaired: 0,
    }),
  };
}

describe('OrdersWorkforceHealthService', () => {
  it('returns aggregate bridge health without per-order polling', async () => {
    const repository = outbox();
    const service = new OrdersWorkforceHealthService(repository);
    const snapshot = await service.health();

    expect(snapshot.summary.failed).toBe(1);
    expect(snapshot.pendingByStep.CORTE).toBe(2);
    expect(repository.health).toHaveBeenCalledTimes(1);
  });

  it('keeps detection separate from repair', async () => {
    const repository = outbox();
    const service = new OrdersWorkforceHealthService(repository);

    const result = await service.reconcile(undefined, false);

    expect(result.repaired).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(repository.reconcile).toHaveBeenCalledWith(undefined, false);
  });
});
