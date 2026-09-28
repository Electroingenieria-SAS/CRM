import type { SupabaseClient } from '@supabase/supabase-js';
import {
  orderWorkforcePendingResponseSchema,
  outboxClaimResponseSchema,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';
import type {
  OrderWorkforceOutboxPort,
} from '@/modules/integrations/orders-workforce/application/orders-workforce.ports';
import { AppError } from '@/shared/errors/app-error';

function mapError(error: { code?: string; message?: string } | null): AppError {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para sincronizar Orders y Workforce.');
  }
  if (error?.code === '40001') {
    return new AppError('BUSINESS_RULE', 'Otro proceso ya está sincronizando este evento.');
  }
  return new AppError('DATABASE', 'No fue posible completar la sincronización Orders–Workforce.');
}

export class SupabaseOrderWorkforceOutboxRepository implements OrderWorkforceOutboxPort {
  constructor(private readonly client: SupabaseClient) {}

  async listPending(orderId?: string, limit = 20) {
    const { data, error } = await this.client.rpc('erp_x_order_workforce_pending', {
      p_order_id: orderId ?? null,
      p_limit: limit,
    });
    if (error) throw mapError(error);
    return orderWorkforcePendingResponseSchema.parse(data).items;
  }

  async claim(outboxId: string) {
    const { data, error } = await this.client.rpc('erp_x_order_workforce_claim_outbox', {
      p_outbox_id: outboxId,
    });
    if (error) throw mapError(error);
    const parsed = outboxClaimResponseSchema.parse(data);
    return {
      idempotent: parsed.idempotent,
      event: parsed.event,
      workforceActivityId: parsed.workforceActivityId,
    };
  }

  async markProcessed(
    outboxId: string,
    workforceActivityId: string,
    result: Readonly<Record<string, unknown>>,
  ) {
    const { error } = await this.client.rpc('erp_x_order_workforce_mark_processed', {
      p_outbox_id: outboxId,
      p_workforce_activity_id: workforceActivityId,
      p_result: result,
    });
    if (error) throw mapError(error);
  }

  async markFailed(outboxId: string, failure: string) {
    const { error } = await this.client.rpc('erp_x_order_workforce_mark_failed', {
      p_outbox_id: outboxId,
      p_error: failure,
    });
    if (error) throw mapError(error);
  }

  async reconcile(orderId?: string, repair = false) {
    const { data, error } = await this.client.rpc('erp_x_order_workforce_reconcile', {
      p_order_id: orderId ?? null,
      p_repair: repair,
    });
    if (error) throw mapError(error);
    const payload = (data ?? {}) as { items?: Readonly<Record<string, unknown>>[]; repaired?: number };
    return { items: payload.items ?? [], repaired: payload.repaired ?? 0 };
  }
}
