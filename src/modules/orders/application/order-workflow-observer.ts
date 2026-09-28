import type { WorkflowMutationResponse } from '@/modules/orders/application/order-workflow.schemas';

export interface OrderWorkflowMutationObserver {
  onWorkflowMutation(result: WorkflowMutationResponse): Promise<void>;
}
