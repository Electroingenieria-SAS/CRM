import type { OrderWorkflowMutationObserver } from '@/modules/orders/application/order-workflow-observer';
import type { WorkflowMutationResponse } from '@/modules/orders/application/order-workflow.schemas';
import { OrdersWorkforceAutomationService } from '@/modules/integrations/orders-workforce/application/orders-workforce-automation-service';

export class OrdersWorkforceMutationObserver implements OrderWorkflowMutationObserver {
  constructor(private readonly automation: OrdersWorkforceAutomationService) {}

  beforeComplete(orderId: string): Promise<void> {
    return this.automation.assertOrderCompletionReady(orderId);
  }

  async onWorkflowMutation(result: WorkflowMutationResponse): Promise<void> {
    await this.automation.flushOrder(result.orderId);
  }
}
