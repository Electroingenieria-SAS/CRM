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

describe('OrdersWorkforceAutomationService idempotency', () => {
  it('separates stable activity identity from event mutation idempotency', async () => {
    const outbox: OrderWorkforceOutboxPort = {
      health: vi.fn(),
      binding: vi.fn().mockResolvedValue({
        orderTaskId: event.orderTaskId,
        workforceActivityId: null,
        status: 'UNBOUND',
        contractVersion: '1.0.0',
      }),
      listPending: vi.fn(),
      claim: vi.fn().mockResolvedValue({
        idempotent: false,
        event,
        dedupeKey: 'order-event:42',
      }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn(),
    };
    const workforce: WorkforceAutomationPort = {
      assertOrderCompletionReady: vi.fn().mockResolvedValue(undefined),
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
      {
        activityKey: 'orders-workforce:00000000-0000-4000-8000-000000000002:activity',
        eventKey: 'orders-workforce:event:42',
      },
      null,
    );
    expect(outbox.markProcessed).toHaveBeenCalledTimes(1);
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('does not call Workforce again when the outbox row is already processed', async () => {
    const outbox: OrderWorkforceOutboxPort = {
      health: vi.fn(),
      binding: vi.fn().mockResolvedValue({
        orderTaskId: event.orderTaskId,
        workforceActivityId: null,
        status: 'UNBOUND',
        contractVersion: '1.0.0',
      }),
      listPending: vi.fn(),
      claim: vi.fn().mockResolvedValue({
        idempotent: true,
        workforceActivityId: '00000000-0000-4000-8000-000000000005',
      }),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
      reconcile: vi.fn(),
    };
    const workforce: WorkforceAutomationPort = {
      assertOrderCompletionReady: vi.fn().mockResolvedValue(undefined),
      applyOrderEvent: vi.fn(),
    };
    const service = new OrdersWorkforceAutomationService(outbox, workforce);

    const result = await service.processOutboxItem('00000000-0000-4000-8000-000000000006');
    expect(result.idempotent).toBe(true);
    expect(workforce.applyOrderEvent).not.toHaveBeenCalled();
  });
});

describe('OrdersWorkforceAutomationService failure recovery', () => {
  it('marks the durable event failed when Workforce rejects the mutation', async () => {
    const outbox: OrderWorkforceOutboxPort = {
      health: vi.fn(),
      binding: vi.fn().mockResolvedValue({
        orderTaskId: event.orderTaskId,
        workforceActivityId: null,
        status: 'UNBOUND',
        contractVersion: '1.0.0',
      }),
      listPending: vi.fn(),
      claim: vi.fn().mockResolvedValue({
        idempotent: false,
        event,
        dedupeKey: 'order-event:42',
      }),
      markProcessed: vi.fn(),
      markFailed: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn(),
    };
    const workforce: WorkforceAutomationPort = {
      assertOrderCompletionReady: vi.fn().mockResolvedValue(undefined),
      applyOrderEvent: vi.fn().mockRejectedValue(new Error('evidence required')),
    };
    const service = new OrdersWorkforceAutomationService(outbox, workforce);

    await expect(service.processOutboxItem('00000000-0000-4000-8000-000000000006')).rejects.toThrow(
      'evidence required',
    );
    expect(outbox.markFailed).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000006',
      'evidence required',
    );
  });
});
