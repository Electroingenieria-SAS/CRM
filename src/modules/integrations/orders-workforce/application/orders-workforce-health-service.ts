import type { OrderWorkforceOutboxPort } from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';

export class OrdersWorkforceHealthService {
  constructor(private readonly outbox: OrderWorkforceOutboxPort) {}

  health() {
    return this.outbox.health();
  }

  reconcile(orderId?: string, repair = false) {
    return this.outbox.reconcile(orderId, repair);
  }
}
