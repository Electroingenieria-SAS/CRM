import type { OrderWorkforceOutboxPort } from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';
import type { OrdersWorkforceIndicatorsPort } from '@/modules/integrations/orders-workforce/application/orders-workforce-indicators';

export class OrdersWorkforceDashboardService {
  constructor(
    private readonly outbox: OrderWorkforceOutboxPort,
    private readonly indicators: OrdersWorkforceIndicatorsPort,
  ) {}

  health() {
    return this.outbox.health();
  }

  indicatorsToday() {
    return this.indicators.snapshot();
  }

  reconcile(orderId?: string, repair = false) {
    return this.outbox.reconcile(orderId, repair);
  }
}
