import type { SupabaseClient } from '@supabase/supabase-js';
import {
  billingQueueSchema,
  billingReadinessSchema,
} from '@/modules/billing/application/billing.schemas';
import type { BillingRepository } from '@/modules/billing/ports/billing-ports';
import { AppError } from '@/shared/errors/app-error';

function mapBillingError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', error.message ?? 'No tienes permisos de facturación.');
  }
  if (error?.code === '22023' || error?.code === '23514') {
    return new AppError('VALIDATION', error.message ?? 'La facturación no cumple las reglas.');
  }
  return new AppError('DATABASE', error?.message ?? 'No fue posible consultar facturación.');
}

export class SupabaseBillingRepository implements BillingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(search?: string, page = 1, pageSize = 25) {
    const { data, error } = await this.client.rpc('erp_x_billing_queue', {
      p_search: search ?? null,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) throw mapBillingError(error);
    return billingQueueSchema.parse(data);
  }

  async readiness(orderId: string) {
    const { data, error } = await this.client.rpc('erp_x_billing_readiness', {
      p_order_id: orderId,
    });
    if (error) throw mapBillingError(error);
    return billingReadinessSchema.parse(data);
  }
}
