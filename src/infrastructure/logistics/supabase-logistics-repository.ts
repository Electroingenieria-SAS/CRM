import type { SupabaseClient } from '@supabase/supabase-js';
import {
  logisticsCandidatesSchema,
  logisticsDetailSchema,
  logisticsMutationSchema,
  logisticsQueueSchema,
} from '@/modules/logistics/application/logistics.schemas';
import type {
  LogisticsQueueQuery,
  LogisticsReleaseInput,
  LogisticsRepository,
} from '@/modules/logistics/ports/logistics-ports';
import { mapLogisticsError } from '@/infrastructure/logistics/logistics-rpc-error';

export class SupabaseLogisticsRepository implements LogisticsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async candidates(search?: string, page = 1, pageSize = 25) {
    const { data, error } = await this.client.rpc('erp_x_logistics_candidates', {
      p_search: search ?? null,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsCandidatesSchema.parse(data);
  }

  async list(query: LogisticsQueueQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_logistics_queue', {
      p_status: query.status ?? null,
      p_route_code: query.routeCode ?? null,
      p_search: query.search ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsQueueSchema.parse(data);
  }

  async detail(orderId: string) {
    const { data, error } = await this.client.rpc('erp_x_logistics_detail', {
      p_order_id: orderId,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsDetailSchema.parse(data);
  }

  async release(orderId: string, input: LogisticsReleaseInput, key: string) {
    const { data, error } = await this.client.rpc('erp_x_logistics_release', {
      p_order_id: orderId,
      p_payload: input,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async saveGuide(shipmentId: string, carrierId: string, tracking: string, key: string) {
    const { data, error } = await this.client.rpc('erp_x_logistics_save_guide', {
      p_shipment_id: shipmentId,
      p_carrier_id: carrierId,
      p_tracking_number: tracking,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async dispatch(
    shipmentId: string,
    version: number,
    actualFreight: number | undefined,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_logistics_dispatch', {
      p_shipment_id: shipmentId,
      p_expected_version: version,
      p_actual_freight: actualFreight ?? null,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async setActualCost(shipmentId: string, cost: number, version: number, key: string) {
    const { data, error } = await this.client.rpc('erp_x_logistics_set_actual_cost', {
      p_shipment_id: shipmentId,
      p_actual_freight: cost,
      p_expected_version: version,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async markFreightSync(shipmentId: string, success: boolean, payload: Record<string, unknown>) {
    const { error } = await this.client.rpc('erp_x_logistics_mark_freight_sync', {
      p_shipment_id: shipmentId,
      p_success: success,
      p_payload: payload,
    });
    if (error) throw mapLogisticsError(error);
  }

  async failDelivery(
    shipmentId: string,
    reason: string,
    observation: string | undefined,
    evidenceId: string | undefined,
    version: number,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_logistics_delivery_failed', {
      p_shipment_id: shipmentId,
      p_reason: reason,
      p_observation: observation ?? null,
      p_evidence_id: evidenceId ?? null,
      p_expected_version: version,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async reprogram(shipmentId: string, version: number, key: string) {
    const { data, error } = await this.client.rpc('erp_x_logistics_reprogram', {
      p_shipment_id: shipmentId,
      p_expected_version: version,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async deliver(
    shipmentId: string,
    receivedBy: string | undefined,
    observation: string | undefined,
    evidenceId: string,
    version: number,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_logistics_deliver', {
      p_shipment_id: shipmentId,
      p_received_by: receivedBy ?? null,
      p_observation: observation ?? null,
      p_evidence_id: evidenceId,
      p_expected_version: version,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async returnShipment(
    shipmentId: string,
    reason: string,
    evidenceId: string,
    version: number,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_logistics_return', {
      p_shipment_id: shipmentId,
      p_reason: reason,
      p_evidence_id: evidenceId,
      p_expected_version: version,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
    return logisticsMutationSchema.parse(data);
  }

  async satisfaction(shipmentId: string, rating: number, comment: string | undefined, key: string) {
    const { error } = await this.client.rpc('erp_x_logistics_satisfaction', {
      p_shipment_id: shipmentId,
      p_rating: rating,
      p_comment: comment ?? null,
      p_idempotency_key: key,
    });
    if (error) throw mapLogisticsError(error);
  }
}
