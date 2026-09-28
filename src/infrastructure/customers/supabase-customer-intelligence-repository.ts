import type { SupabaseClient } from '@supabase/supabase-js';
import {
  customerIntelligenceDetailSchema,
  customerIntelligenceListSchema,
  paretoResponseSchema,
  prioritySignalSchema,
  recalculateResponseSchema,
} from '@/modules/customers/application/customer-intelligence.schemas';
import type {
  CustomerIntelligenceQuery,
  CustomerIntelligenceRepository,
} from '@/modules/customers/ports/customer-intelligence-repository';
import { AppError } from '@/shared/errors/app-error';

function mapError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para consultar esta información.');
  }
  if (error?.code === 'P0002') {
    return new AppError('BUSINESS_RULE', 'El cliente todavía no tiene inteligencia calculada.');
  }
  return new AppError('DATABASE', 'No fue posible consultar la inteligencia de clientes.');
}

export class SupabaseCustomerIntelligenceRepository
  implements CustomerIntelligenceRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async list(query: CustomerIntelligenceQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_customer_intelligence_list', {
      p_search: query.search ?? null,
      p_segment: query.segment || null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 50,
    });

    if (error) throw mapError(error);
    return customerIntelligenceListSchema.parse(data);
  }

  async detail(customerId: string) {
    const { data, error } = await this.client.rpc('erp_x_customer_intelligence_detail', {
      p_customer_id: customerId,
    });

    if (error) throw mapError(error);
    return customerIntelligenceDetailSchema.parse(data);
  }

  async pareto() {
    const { data, error } = await this.client.rpc('erp_x_customer_intelligence_pareto');

    if (error) throw mapError(error);
    return paretoResponseSchema.parse(data);
  }

  async recalculate() {
    const { data, error } = await this.client.rpc('erp_x_customer_intelligence_recalculate');

    if (error) throw mapError(error);
    return recalculateResponseSchema.parse(data);
  }

  async prioritySignal(clientDocument?: string) {
    const { data, error } = await this.client.rpc('erp_x_customer_priority_signal', {
      p_client_document: clientDocument ?? null,
    });

    if (error) throw mapError(error);
    return prioritySignalSchema.parse(data);
  }
}
