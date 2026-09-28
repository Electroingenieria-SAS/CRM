import type { SupabaseClient } from '@supabase/supabase-js';
import {
  workforceActivityDetailResponseSchema,
  workforceCatalogResponseSchema,
  workforceIndicatorsResponseSchema,
  workforceMutationResponseSchema,
  workforceScheduleResponseSchema,
  type CreateWorkforceActivityInput,
  type WorkforceEvidenceInput,
} from '@/modules/workforce/application/workforce.schemas';
import type { WorkforceRepository } from '@/modules/workforce/application/workforce-repository';
import { AppError } from '@/shared/errors/app-error';

function mapWorkforceError(error: { code?: string; message?: string } | null): AppError {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para realizar esta operación.');
  }
  if (error?.code === '40001') {
    return new AppError('BUSINESS_RULE', 'La actividad cambió. Actualiza la vista e inténtalo nuevamente.');
  }
  if (error?.code === '23P01') {
    return new AppError('BUSINESS_RULE', 'La persona ya tiene una actividad incompatible en ese horario.');
  }
  if (error?.code === '23514') {
    return new AppError('BUSINESS_RULE', 'Falta cumplir una regla de evidencia o integridad.');
  }
  if (error?.code === 'P0002') {
    return new AppError('BUSINESS_RULE', 'La actividad solicitada no existe o no es visible.');
  }
  if (error?.code === '22023') {
    return new AppError('VALIDATION', error.message ?? 'Los datos de Workforce no son válidos.');
  }
  return new AppError('DATABASE', 'No fue posible completar la operación de Workforce.');
}

export class SupabaseWorkforceRepository implements WorkforceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async catalog() {
    const { data, error } = await this.client.rpc('erp_x_workforce_catalog');
    if (error) throw mapWorkforceError(error);
    return workforceCatalogResponseSchema.parse(data);
  }

  async schedule(from: string, to: string, profileId?: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_schedule', {
      p_from: from,
      p_to: to,
      p_profile_id: profileId ?? null,
    });
    if (error) throw mapWorkforceError(error);
    return workforceScheduleResponseSchema.parse(data);
  }

  async detail(activityId: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_activity_detail', {
      p_activity_id: activityId,
    });
    if (error) throw mapWorkforceError(error);
    return workforceActivityDetailResponseSchema.parse(data);
  }

  async indicators(from: string, to: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_indicators', {
      p_from: from,
      p_to: to,
    });
    if (error) throw mapWorkforceError(error);
    return workforceIndicatorsResponseSchema.parse(data);
  }

  async create(input: CreateWorkforceActivityInput, idempotencyKey: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_create_activity', {
      p_payload: input,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw mapWorkforceError(error);
    return workforceMutationResponseSchema.parse(data);
  }

  async assign(activityId: string, assigneeProfileId: string | null, expectedVersion: number, idempotencyKey: string) {
    const { data, error } = await this.client.rpc('erp_x_workforce_assign_activity', {
      p_activity_id: activityId,
      p_assignee_profile_id: assigneeProfileId,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw mapWorkforceError(error);
    return workforceMutationResponseSchema.parse(data);
  }

  async start(activityId: string, expectedVersion: number, idempotencyKey: string) {
    return this.mutate('erp_x_workforce_start_activity', {
      p_activity_id: activityId,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  async block(activityId: string, reason: string, expectedVersion: number, idempotencyKey: string) {
    return this.mutate('erp_x_workforce_block_activity', {
      p_activity_id: activityId,
      p_reason: reason,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  async resume(activityId: string, expectedVersion: number, idempotencyKey: string) {
    return this.mutate('erp_x_workforce_resume_activity', {
      p_activity_id: activityId,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  async complete(activityId: string, resultNote: string, expectedVersion: number, idempotencyKey: string) {
    return this.mutate('erp_x_workforce_complete_activity', {
      p_activity_id: activityId,
      p_result_note: resultNote,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  async cancel(activityId: string, reason: string, expectedVersion: number, idempotencyKey: string) {
    return this.mutate('erp_x_workforce_cancel_activity', {
      p_activity_id: activityId,
      p_reason: reason,
      p_expected_version: expectedVersion,
      p_idempotency_key: idempotencyKey,
    });
  }

  async addEvidence(activityId: string, evidence: WorkforceEvidenceInput, idempotencyKey: string) {
    return this.mutate('erp_x_workforce_add_evidence', {
      p_activity_id: activityId,
      p_evidence: evidence,
      p_idempotency_key: idempotencyKey,
    });
  }

  private async mutate(fn: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw mapWorkforceError(error);
    return workforceMutationResponseSchema.parse(data);
  }
}
