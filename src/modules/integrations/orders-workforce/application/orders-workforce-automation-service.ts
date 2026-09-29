import type {
  OrderWorkforceOutboxPort,
  WorkforceAutomationPort,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error de integración no identificado';
}

function automationKeys(
  taskId: string | null,
  orderId: string,
  orderEventId: number | undefined,
  dedupeKey: string | undefined,
) {
  const aggregate = taskId ?? orderId;
  return {
    activityKey: `orders-workforce:${aggregate}:activity`,
    eventKey: `orders-workforce:event:${orderEventId ?? dedupeKey ?? aggregate}`,
  };
}

export class OrdersWorkforceAutomationService {
  constructor(
    private readonly outbox: OrderWorkforceOutboxPort,
    private readonly workforce: WorkforceAutomationPort,
  ) {}

  assertOrderCompletionReady(orderId: string) {
    return this.workforce.assertOrderCompletionReady(orderId);
  }

  async processOutboxItem(outboxId: string) {
    const claimed = await this.outbox.claim(outboxId);

    if (claimed.idempotent && claimed.workforceActivityId) {
      return { outboxId, activityId: claimed.workforceActivityId, idempotent: true };
    }

    if (!claimed.event) {
      throw new Error('El evento de integración reclamado no contiene payload.');
    }

    try {
      const keys = automationKeys(
        claimed.event.orderTaskId,
        claimed.event.orderId,
        claimed.event.orderEventId,
        claimed.dedupeKey,
      );
      const existingActivityId = claimed.event.orderTaskId
        ? (await this.outbox.binding(claimed.event.orderTaskId)).workforceActivityId
        : null;
      const result = await this.workforce.applyOrderEvent(claimed.event, keys, existingActivityId);

      await this.outbox.markProcessed(outboxId, result.activityId, {
        status: result.status,
        idempotent: result.idempotent,
        ...result.metadata,
      });

      return { outboxId, activityId: result.activityId, idempotent: result.idempotent };
    } catch (error) {
      await this.outbox.markFailed(outboxId, errorMessage(error));
      throw error;
    }
  }

  async flushOrder(orderId: string) {
    const pending = await this.outbox.listPending(orderId, 50);
    const processed: Array<{ outboxId: string; activityId: string }> = [];

    for (const item of pending) {
      const result = await this.processOutboxItem(item.id);
      processed.push({ outboxId: result.outboxId, activityId: result.activityId });
    }

    return processed;
  }

  reconcile(orderId?: string, repair = false) {
    return this.outbox.reconcile(orderId, repair);
  }
}
