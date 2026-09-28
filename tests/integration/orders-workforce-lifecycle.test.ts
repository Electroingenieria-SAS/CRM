import { describe, expect, it } from 'vitest';
import { OrdersWorkforceAutomationService } from '@/modules/integrations/orders-workforce/application/orders-workforce-automation-service';
import type {
  OrderWorkforceOutboxPort,
  WorkforceAutomationKeys,
  WorkforceAutomationPort,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';
import type {
  OrderWorkforceEvent,
  WorkforceAutomationResult,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';

const orderId = '91000000-0000-4000-8000-000000000001';
const taskId = '91000000-0000-4000-8000-000000000002';
const sellerId = '91000000-0000-4000-8000-000000000003';
const assigneeA = '91000000-0000-4000-8000-000000000004';
const assigneeB = '91000000-0000-4000-8000-000000000005';
const activityId = '91000000-0000-4000-8000-000000000006';

function integrationEvent(
  orderEventId: number,
  type: OrderWorkforceEvent['integrationEvent'],
  assigneeProfileId: string,
): OrderWorkforceEvent {
  return {
    contractVersion: '1.0.0',
    orderEventId,
    orderId,
    orderTaskId: taskId,
    stepCode: 'CORTE',
    integrationEvent: type,
    workforceCatalogCode: 'LOG_SUPPORT_CUTTING',
    activityTitle: 'Corte de pedido',
    actorProfileId: assigneeProfileId,
    assigneeProfileId,
    sellerProfileId: sellerId,
    occurredAt: `2026-09-28T15:${String(orderEventId).padStart(2, '0')}:00-05:00`,
  };
}

class InMemoryWorkforce implements WorkforceAutomationPort {
  status = 'NONE';
  assignee: string | null = null;
  history: string[] = [];
  eventKeys = new Set<string>();

  async applyOrderEvent(
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
  ): Promise<WorkforceAutomationResult> {
    if (this.eventKeys.has(keys.eventKey)) {
      return { activityId, status: this.status, idempotent: true, metadata: {} };
    }
    this.eventKeys.add(keys.eventKey);

    if (event.integrationEvent === 'OrderTaskClaimed') {
      this.status = 'PLANNED';
      this.assignee = event.assigneeProfileId;
    } else if (event.integrationEvent === 'OrderTaskAssigned') {
      this.history.push(`REASSIGNED:${this.assignee ?? 'none'}->${event.assigneeProfileId}`);
      this.assignee = event.assigneeProfileId;
    } else if (event.integrationEvent === 'OrderTaskStarted') {
      this.status = 'IN_PROGRESS';
    } else if (event.integrationEvent === 'OrderBlocked') {
      this.status = 'BLOCKED';
    } else if (event.integrationEvent === 'OrderTaskResumed') {
      this.status = 'IN_PROGRESS';
    } else if (event.integrationEvent === 'OrderTaskCompleted') {
      this.status = 'COMPLETED';
    } else if (event.integrationEvent === 'OrderCancelled') {
      this.status = 'CANCELLED';
    }

    this.history.push(event.integrationEvent);
    return {
      activityId,
      status: this.status,
      idempotent: false,
      metadata: { assigneeProfileId: this.assignee },
    };
  }
}

class InMemoryOutbox implements OrderWorkforceOutboxPort {
  private readonly events = new Map<string, OrderWorkforceEvent>();
  readonly processed = new Map<string, string>();
  readonly failures = new Map<string, string>();

  add(id: string, event: OrderWorkforceEvent) {
    this.events.set(id, event);
  }

  async health() {
    return {
      summary: { pending: 0, processing: 0, processed: 0, failed: 0, staleProcessing: 0 },
      pendingByStep: {},
      oldestPendingAt: null,
      contractVersion: '1.0.0',
    };
  }

  async listPending() {
    return [];
  }

  async claim(outboxId: string) {
    const activity = this.processed.get(outboxId);
    if (activity) {
      return { idempotent: true, workforceActivityId: activity };
    }

    const event = this.events.get(outboxId);
    if (!event) throw new Error('missing event');
    return {
      idempotent: false,
      event,
      dedupeKey: `order-event:${event.orderEventId}`,
    };
  }

  async markProcessed(outboxId: string, workforceActivityId: string) {
    this.processed.set(outboxId, workforceActivityId);
  }

  async markFailed(outboxId: string, error: string) {
    this.failures.set(outboxId, error);
  }

  async reconcile() {
    return { items: [], repaired: 0 };
  }
}

describe('Orders Workforce synthetic lifecycle', () => {
  it('keeps one activity through claim, reassignment, start, block, resume and complete', async () => {
    const outbox = new InMemoryOutbox();
    const workforce = new InMemoryWorkforce();
    const service = new OrdersWorkforceAutomationService(outbox, workforce);

    const sequence: Array<[string, OrderWorkforceEvent]> = [
      ['event-1', integrationEvent(1, 'OrderTaskClaimed', assigneeA)],
      ['event-2', integrationEvent(2, 'OrderTaskAssigned', assigneeB)],
      ['event-3', integrationEvent(3, 'OrderTaskStarted', assigneeB)],
      ['event-4', integrationEvent(4, 'OrderBlocked', assigneeB)],
      ['event-5', integrationEvent(5, 'OrderTaskResumed', assigneeB)],
      ['event-6', integrationEvent(6, 'OrderTaskCompleted', assigneeB)],
    ];

    for (const [id, event] of sequence) {
      outbox.add(id, event);
      const result = await service.processOutboxItem(id);
      expect(result.activityId).toBe(activityId);
    }

    expect(workforce.assignee).toBe(assigneeB);
    expect(workforce.status).toBe('COMPLETED');
    expect(workforce.history).toContain(`REASSIGNED:${assigneeA}->${assigneeB}`);
    expect(workforce.history).toEqual(
      expect.arrayContaining([
        'OrderTaskClaimed',
        'OrderTaskAssigned',
        'OrderTaskStarted',
        'OrderBlocked',
        'OrderTaskResumed',
        'OrderTaskCompleted',
      ]),
    );
    expect(new Set(outbox.processed.values())).toEqual(new Set([activityId]));
  });

  it('does not duplicate a lifecycle mutation when the same outbox item is retried', async () => {
    const outbox = new InMemoryOutbox();
    const workforce = new InMemoryWorkforce();
    const service = new OrdersWorkforceAutomationService(outbox, workforce);
    const claimed = integrationEvent(11, 'OrderTaskClaimed', assigneeA);

    outbox.add('event-11', claimed);
    await service.processOutboxItem('event-11');
    const historyLength = workforce.history.length;
    const retry = await service.processOutboxItem('event-11');

    expect(retry.idempotent).toBe(true);
    expect(workforce.history).toHaveLength(historyLength);
  });
});
