import type { SupabaseClient } from '@supabase/supabase-js';
import {
  workflowMutationResponseSchema,
  type BlockTaskInput,
  type EvidenceInput,
  type IssueInput,
  type WorkflowMutationResponse,
} from '@/modules/orders/application/order-workflow.schemas';
import type { OrderWorkflowRepository } from '@/modules/orders/application/order-workflow-repository';
import { AppError } from '@/shared/errors/app-error';

function mapWorkflowError(error: { message?: string; code?: string } | null): AppError {
  const message = error?.message?.trim();

  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', message || 'No tienes permisos para esta operación.');
  }

  if (error?.code === '40001') {
    return new AppError(
      'BUSINESS_RULE',
      message || 'El pedido cambió o la tarea ya fue tomada por otro usuario.',
    );
  }

  if (error?.code === 'P0001' || error?.code === '23505') {
    return new AppError(
      'BUSINESS_RULE',
      message || 'La operación no cumple las reglas del pedido.',
    );
  }

  if (error?.code === '22023') {
    return new AppError('VALIDATION', message || 'Uno de los datos enviados no es válido.');
  }

  return new AppError('DATABASE', message || 'No fue posible completar la operación del pedido.');
}

export class SupabaseOrderWorkflowRepository implements OrderWorkflowRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async execute(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw mapWorkflowError(error);
    return workflowMutationResponseSchema.parse(data);
  }

  claim(orderId: string, version: number, idempotencyKey: string) {
    return this.execute('erp_x_claim_order_task', {
      p_order_id: orderId,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  assign(orderId: string, profileId: string, version: number, idempotencyKey: string) {
    return this.execute('erp_x_assign_order_task', {
      p_order_id: orderId,
      p_profile_id: profileId,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  start(orderId: string, version: number, idempotencyKey: string) {
    return this.execute('erp_x_start_order_task', {
      p_order_id: orderId,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  block(orderId: string, input: BlockTaskInput, version: number, idempotencyKey: string) {
    return this.execute('erp_x_block_order_task', {
      p_order_id: orderId,
      p_reason_code: input.reasonCode,
      p_detail: input.detail,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  resume(orderId: string, resolution: string, version: number, idempotencyKey: string) {
    return this.execute('erp_x_resume_order_task', {
      p_order_id: orderId,
      p_resolution: resolution,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  complete(
    orderId: string,
    resultCode: string,
    detail: string,
    version: number,
    idempotencyKey: string,
  ) {
    return this.execute('erp_x_complete_order_task', {
      p_order_id: orderId,
      p_result_code: resultCode,
      p_detail: detail,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  cancel(orderId: string, reason: string, version: number, idempotencyKey: string) {
    return this.execute('erp_x_cancel_order', {
      p_order_id: orderId,
      p_reason: reason,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  reopen(
    orderId: string,
    targetStep: string,
    reason: string,
    version: number,
    idempotencyKey: string,
  ) {
    return this.execute('erp_x_reopen_order', {
      p_order_id: orderId,
      p_target_step: targetStep,
      p_reason: reason,
      p_expected_version: version,
      p_idempotency_key: idempotencyKey,
    });
  }

  createIssue(orderId: string, input: IssueInput, idempotencyKey: string) {
    return this.execute('erp_x_create_order_issue', {
      p_order_id: orderId,
      p_payload: input,
      p_idempotency_key: idempotencyKey,
    });
  }

  resolveIssue(issueId: string, resolution: string, idempotencyKey: string) {
    return this.execute('erp_x_resolve_order_issue', {
      p_issue_id: issueId,
      p_resolution: resolution,
      p_idempotency_key: idempotencyKey,
    });
  }

  addEvidence(orderId: string, input: EvidenceInput, idempotencyKey: string) {
    return this.execute('erp_x_add_order_evidence', {
      p_order_id: orderId,
      p_payload: input,
      p_idempotency_key: idempotencyKey,
    });
  }
}

export type { WorkflowMutationResponse };
