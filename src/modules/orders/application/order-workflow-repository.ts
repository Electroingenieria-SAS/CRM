import type {
  BlockTaskInput,
  EvidenceInput,
  IssueInput,
  WorkflowMutationResponse,
} from '@/modules/orders/application/order-workflow.schemas';

export interface OrderWorkflowRepository {
  claim(orderId: string, version: number, idempotencyKey: string): Promise<WorkflowMutationResponse>;
  assign(
    orderId: string,
    profileId: string,
    version: number,
    idempotencyKey: string,
  ): Promise<WorkflowMutationResponse>;
  start(orderId: string, version: number, idempotencyKey: string): Promise<WorkflowMutationResponse>;
  block(
    orderId: string,
    input: BlockTaskInput,
    version: number,
    idempotencyKey: string,
  ): Promise<WorkflowMutationResponse>;
  resume(
    orderId: string,
    resolution: string,
    version: number,
    idempotencyKey: string,
  ): Promise<WorkflowMutationResponse>;
  complete(
    orderId: string,
    resultCode: string,
    detail: string,
    version: number,
    idempotencyKey: string,
  ): Promise<WorkflowMutationResponse>;
  cancel(
    orderId: string,
    reason: string,
    version: number,
    idempotencyKey: string,
  ): Promise<WorkflowMutationResponse>;
  reopen(
    orderId: string,
    targetStep: string,
    reason: string,
    version: number,
    idempotencyKey: string,
  ): Promise<WorkflowMutationResponse>;
  createIssue(orderId: string, input: IssueInput, idempotencyKey: string): Promise<WorkflowMutationResponse>;
  resolveIssue(issueId: string, resolution: string, idempotencyKey: string): Promise<WorkflowMutationResponse>;
  addEvidence(orderId: string, input: EvidenceInput, idempotencyKey: string): Promise<WorkflowMutationResponse>;
}
