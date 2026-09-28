import type {
  OrderWorkforceEvent,
  OrderWorkforceOutboxItem,
  WorkforceAutomationResult,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';

export interface OrderWorkforceOutboxPort {
  listPending(orderId?: string, limit?: number): Promise<readonly OrderWorkforceOutboxItem[]>;
  claim(outboxId: string): Promise<{
    readonly idempotent: boolean;
    readonly event?: OrderWorkforceEvent;
    readonly dedupeKey?: string;
    readonly workforceActivityId?: string | null;
  }>;
  markProcessed(
    outboxId: string,
    workforceActivityId: string,
    result: Readonly<Record<string, unknown>>,
  ): Promise<void>;
  markFailed(outboxId: string, error: string): Promise<void>;
  reconcile(orderId?: string, repair?: boolean): Promise<{
    readonly items: readonly Readonly<Record<string, unknown>>[];
    readonly repaired: number;
  }>;
}

export interface WorkforceAutomationKeys {
  readonly activityKey: string;
  readonly eventKey: string;
}

export interface WorkforceAutomationPort {
  applyOrderEvent(
    event: OrderWorkforceEvent,
    keys: WorkforceAutomationKeys,
  ): Promise<WorkforceAutomationResult>;
}
