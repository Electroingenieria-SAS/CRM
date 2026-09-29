import type { WorkflowMutationResponse } from '@/modules/orders/application/order-workflow.schemas';

export interface OrderWorkflowMutationObserver {
  beforeComplete?(orderId: string): Promise<void>;
  onWorkflowMutation(result: WorkflowMutationResponse): Promise<void>;
}
