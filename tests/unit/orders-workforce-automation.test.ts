import { describe, expect, it, vi } from 'vitest';
import { OrdersWorkforceAutomationService } from '@/modules/integrations/orders-workforce/application/orders-workforce-automation-service';
import type {
  OrderWorkforceOutboxPort,
  WorkforceAutomationPort,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';

const event = {
  contractVersion: '1.0.0' as const,
  orderEventId: 42,
  orderId: '00000000-0000-4000-8000-000000000001',
  orderTaskId: '00000000-0000-4000-8000-000000000002',
  stepCode: 'CORTE',
  integrationEvent: 'OrderTaskClaimed' as const,
  workforceCatalogCode: 'LOG_SUPPORT_CUTTING',
  activityTitle: 'Corte de pedido',
  actorProfileId: '00000000-0000-4000-8000-000000000003',
  assigneeProfileId: '00000000-0000-4000-8000-000000000003',
  sellerProfileId: '00000000-0000-4000-8000-000000000004',
  occurredAt: '2026-09-28T15:00:00-05:00',
};

describe('OrdersWorkforceAutomationService', () => {
  it('processes an event once and preserves a stable task-level idempotency key', async () => {
    const outbox: OrderWorkforceOutboxPort = {
      listPending: vi.fn(),
      claim: vi.fn().mockResolvedValue({ idempotent: false, event }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn(),
    };
    const workforce: WorkforceAutomationPort = {
      applyOrderEvent: vi.fn().mockResolvedValue({
        activityId: '00000000-0000-4000-8000-000000000005',
        status: 'PLANNED',
        idempotent: false,
        metadata: {},
      }),
    };

    const service = new OrdersWorkforceAutomationService(outbox, workforce);
    await service.processOutboxItem('00000000-0000-4000-8000-000000000006');

    expect(workforce.applyOrderEvent).toHaveBeenCalledWith(
      event,
      'orders-workforce:00000000-0000-4000-8000-000000000002',
    );
    expect(outbox.markProcessed).toHaveBeenCalledTimes(1);
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('does not call Workforce again when the outbox row is already processed', async () => {
    const outbox: OrderWorkforceOutboxPort = {
      listPending: vi.fn(),
      claim: vi.fn().mockResolvedValue({
        idempotent: true,
        workforceActivityId: '00000000-0000-4000-8000-000000000005',
      }),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
      reconcile: vi.fn(),
    };
    const workforce: WorkforceAutomationPort = { applyOrderEvent: vi.fn() };
    const service = new OrdersWorkforceAutomationService(outbox, workforce);

    const result = await service.processOutboxItem('00000000-0000-4000-8000-000000000006');
    expect(result.idempotent).toBe(true);
    expect(workforce.applyOrderEvent).not.toHaveBeenCalled();
  });

  it('marks the durable event failed when Workforce rejects the mutation', async () => {
    const outbox: OrderWorkforceOutboxPort = {
      listPending: vi.fn(),
      claim: vi.fn().mockResolvedValue({ idempotent: false, event }),
      markProcessed: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn(),
    };
    const workforce: WorkforceAutomationPort = {
      applyOrderEvent: vi.fn().mockRejectedValue(new Error('evidence required')),
    };
    const service = new OrdersWorkforceAutomationService(outbox, workforce);

    await expect(
      service.processOutboxItem('00000000-0000-4000-8000-000000000006'),
    ).rejects.toThrow('evidence required');
    expect(outbox.markFailed).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000006',
      'evidence required',
    );
  });
});
