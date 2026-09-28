import type { SupabaseClient } from '@supabase/supabase-js';
import { freightCatalogSchema } from '@/modules/freight/application/freight-catalog.schemas';
import {
  freightHistoryResponseSchema,
  freightMetricsSchema,
  recordFreightActualResponseSchema,
  type RecordFreightActualInput,
} from '@/modules/freight/application/freight-history.schemas';
import {
  freightPredictionResponseSchema,
  type FreightPredictionInput,
} from '@/modules/freight/application/freight-prediction.schemas';
import type {
  FreightHistoryQuery,
  FreightRepository,
} from '@/modules/freight/application/freight-repository';
import { AppError } from '@/shared/errors/app-error';

function mapFreightError(error: { code?: string; message?: string } | null): AppError {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para esta operación de fletes.');
  }

  if (error?.code === 'P0002') {
    return new AppError('BUSINESS_RULE', 'El destino, transportadora o pedido no es válido.');
  }

  if (error?.code === '23505') {
    return new AppError('BUSINESS_RULE', 'Este costo real ya había sido registrado.');
  }

  return new AppError('DATABASE', 'No fue posible completar la operación de fletes.');
}

export class SupabaseFreightRepository implements FreightRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getCatalog() {
    const { data, error } = await this.client.rpc('erp_x_freight_catalog');
    if (error) throw mapFreightError(error);
    return freightCatalogSchema.parse(data);
  }

  async predict(input: FreightPredictionInput) {
    const { data, error } = await this.client.rpc('erp_x_freight_predict', {
      p_destination_id: input.destinationId,
      p_route_code: input.routeCode,
      p_carrier_id: input.carrierId ?? null,
      p_weight_kg: input.weightKg ?? null,
      p_package_count: input.packageCount ?? null,
      p_volume_m3: input.volumeM3 ?? null,
      p_order_id: input.orderId ?? null,
    });
    if (error) throw mapFreightError(error);
    return freightPredictionResponseSchema.parse(data);
  }

  async listHistory(query: FreightHistoryQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_freight_history', {
      p_destination_id: query.destinationId ?? null,
      p_department_key: query.departmentKey ?? null,
      p_carrier_id: query.carrierId ?? null,
      p_route_code: query.routeCode ?? null,
      p_from: query.from ?? null,
      p_to: query.to ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    if (error) throw mapFreightError(error);
    return freightHistoryResponseSchema.parse(data);
  }

  async getMetrics() {
    const { data, error } = await this.client.rpc('erp_x_freight_metrics');
    if (error) throw mapFreightError(error);
    return freightMetricsSchema.parse(data);
  }

  async recordActual(input: RecordFreightActualInput) {
    const { data, error } = await this.client.rpc('erp_x_record_freight_actual', {
      p_carrier_id: input.carrierId,
      p_destination_id: input.destinationId,
      p_route_code: input.routeCode,
      p_actual_cost: input.actualCost,
      p_observed_at: input.observedAt,
      p_order_id: input.orderId ?? null,
      p_prediction_id: input.predictionId ?? null,
      p_weight_kg: input.weightKg ?? null,
      p_package_count: input.packageCount ?? null,
      p_volume_m3: input.volumeM3 ?? null,
      p_service_type: input.serviceType ?? null,
      p_declared_value: input.declaredValue ?? null,
      p_external_key: input.externalKey ?? null,
    });
    if (error) throw mapFreightError(error);
    return recordFreightActualResponseSchema.parse(data);
  }
}
