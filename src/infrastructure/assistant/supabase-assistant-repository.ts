import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assistantAlertsSchema,
  assistantMutationSchema,
  assistantRateLimitSchema,
} from '@/modules/assistant/application/assistant.schemas';
import type { AssistantRepository } from '@/modules/assistant/ports/assistant-repository';
import { AppError } from '@/shared/errors/app-error';

function assistantError(error: { code?: string } | null) {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'PACO no tiene permiso para realizar esta operación.');
  }
  if (error?.code === 'P0002') {
    return new AppError('BUSINESS_RULE', 'La alerta ya no está disponible.');
  }
  return new AppError('DATABASE', 'PACO no pudo completar la operación.');
}

export class SupabaseAssistantRepository implements AssistantRepository {
  constructor(private readonly client: SupabaseClient) {}

  async rateLimit(operation: string) {
    const { data, error } = await this.client.rpc('erp_x_assistant_rate_limit', {
      p_operation: operation,
    });
    if (error) throw assistantError(error);
    const parsed = assistantRateLimitSchema.parse(data);
    return { allowed: parsed.allowed, retryAfterSeconds: parsed.retryAfterSeconds };
  }

  async alerts(refresh = true) {
    const { data, error } = await this.client.rpc('erp_x_assistant_alerts', {
      p_refresh: refresh,
      p_limit: 20,
    });
    if (error) throw assistantError(error);
    return assistantAlertsSchema.parse(data).items;
  }

  async acknowledgeAlert(alertId: string) {
    const { data, error } = await this.client.rpc('erp_x_assistant_ack_alert', {
      p_alert_id: alertId,
    });
    if (error) throw assistantError(error);
    assistantMutationSchema.parse(data);
  }

  async recordAction(
    action: string,
    resourceType: string,
    resourceId: string | null,
    result: 'SUCCESS' | 'FAILED' | 'DENIED' | 'REQUESTED' | 'ACKNOWLEDGED',
    metadata: Record<string, unknown> = {},
  ) {
    const { data, error } = await this.client.rpc('erp_x_assistant_record_action', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_result: result,
      p_metadata: metadata,
    });
    if (error) throw assistantError(error);
    assistantMutationSchema.parse(data);
  }
}
