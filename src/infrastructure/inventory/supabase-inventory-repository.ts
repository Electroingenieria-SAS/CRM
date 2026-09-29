import type { SupabaseClient } from '@supabase/supabase-js';
import {
  inventoryAdjustmentResultSchema,
  inventoryAvailabilitySchema,
  inventoryCountCandidatesSchema,
  inventoryCountQueueSchema,
  inventoryCountResultSchema,
  inventoryListSchema,
  inventoryLocationSchema,
  inventoryMaterialDetailSchema,
  inventoryOrderTraceSchema,
  inventoryReceiptResultSchema,
  inventoryReservationResultSchema,
} from '@/modules/inventory/application/inventory.schemas';
import type {
  InventoryListQuery,
  InventoryMaterialQuery,
  InventoryReceiveInput,
  InventoryRepository,
  InventoryReserveInput,
} from '@/modules/inventory/ports/inventory-repository';
import { AppError } from '@/shared/errors/app-error';

function mapInventoryError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return new AppError(
      'AUTHORIZATION',
      error.message ?? 'No tienes permisos para esta operación.',
    );
  }
  if (error?.code === '23514' || error?.code === '22023') {
    return new AppError(
      'BUSINESS_RULE',
      error.message ?? 'La operación de inventario no es válida.',
    );
  }
  if (error?.code === '23505') {
    return new AppError('BUSINESS_RULE', error.message ?? 'La operación ya fue procesada.');
  }
  if (error?.code === '40001') {
    return new AppError(
      'BUSINESS_RULE',
      'El inventario cambió mientras estaba abierto. Actualiza e inténtalo de nuevo.',
    );
  }
  return new AppError('DATABASE', 'No fue posible completar la operación de inventario.');
}

function rpcPayload<T>(data: T | null, error: { code?: string; message?: string } | null) {
  if (error) throw mapInventoryError(error);
  return data;
}

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async locations() {
    const { data, error } = await this.client.rpc('erp_x_inventory_locations');
    return inventoryLocationSchema.array().parse(rpcPayload(data, error));
  }

  async availability(materialId: string, variantId?: string) {
    const { data, error } = await this.client.rpc('erp_x_inventory_availability', {
      p_material_id: materialId,
      p_variant_id: variantId ?? null,
    });
    return inventoryAvailabilitySchema.parse(rpcPayload(data, error));
  }

  async list(query: InventoryListQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_inventory_list', {
      p_search: query.search ?? null,
      p_location_id: query.locationId ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    return inventoryListSchema.parse(rpcPayload(data, error));
  }

  async materialDetail(query: InventoryMaterialQuery) {
    const { data, error } = await this.client.rpc('erp_x_inventory_material_detail', {
      p_material_id: query.materialId,
      p_variant_id: query.variantId ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    return inventoryMaterialDetailSchema.parse(rpcPayload(data, error));
  }

  async orderTrace(orderId: string, page = 1, pageSize = 50) {
    const { data, error } = await this.client.rpc('erp_x_inventory_order_trace', {
      p_order_id: orderId,
      p_page: page,
      p_page_size: pageSize,
    });
    return inventoryOrderTraceSchema.parse(rpcPayload(data, error));
  }

  async receive(input: InventoryReceiveInput, key: string) {
    const { data, error } = await this.client.rpc('erp_x_inventory_receive', {
      p_payload: input,
      p_idempotency_key: key,
    });
    return inventoryReceiptResultSchema.parse(rpcPayload(data, error));
  }

  async reserve(input: InventoryReserveInput, key: string) {
    const { data, error } = await this.client.rpc('erp_x_inventory_reserve', {
      p_payload: input,
      p_idempotency_key: key,
    });
    return inventoryReservationResultSchema.parse(rpcPayload(data, error));
  }

  async release(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_inventory_release', {
      p_reservation_id: reservationId,
      p_quantity: quantity ?? null,
      p_reason: reason || null,
      p_idempotency_key: key,
    });
    return inventoryReservationResultSchema.parse(rpcPayload(data, error));
  }

  async pick(reservationId: string, quantity: number | undefined, key: string) {
    const { data, error } = await this.client.rpc('erp_x_inventory_pick', {
      p_reservation_id: reservationId,
      p_quantity: quantity ?? null,
      p_idempotency_key: key,
    });
    return inventoryReservationResultSchema.parse(rpcPayload(data, error));
  }

  async consume(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_inventory_consume', {
      p_reservation_id: reservationId,
      p_quantity: quantity ?? null,
      p_reason: reason || null,
      p_idempotency_key: key,
    });
    return inventoryReservationResultSchema.parse(rpcPayload(data, error));
  }

  async returnReusable(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_inventory_return', {
      p_reservation_id: reservationId,
      p_quantity: quantity ?? null,
      p_reason: reason,
      p_idempotency_key: key,
    });
    return inventoryReservationResultSchema.parse(rpcPayload(data, error));
  }

  async waste(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_inventory_waste', {
      p_reservation_id: reservationId,
      p_quantity: quantity ?? null,
      p_reason: reason,
      p_idempotency_key: key,
    });
    return inventoryReservationResultSchema.parse(rpcPayload(data, error));
  }

  async adjust(balanceId: string, delta: number, reason: string, key: string) {
    const { data, error } = await this.client.rpc('erp_x_inventory_adjust', {
      p_balance_id: balanceId,
      p_delta: delta,
      p_reason: reason,
      p_idempotency_key: key,
    });
    return inventoryAdjustmentResultSchema.parse(rpcPayload(data, error));
  }

  async reverseMovement(movementId: string, reason: string, key: string) {
    const { data, error } = await this.client.rpc('erp_x_inventory_reverse_movement', {
      p_movement_id: movementId,
      p_reason: reason,
      p_idempotency_key: key,
    });
    return inventoryAdjustmentResultSchema.parse(rpcPayload(data, error));
  }

  async countCandidates(search?: string, page = 1, pageSize = 25) {
    const { data, error } = await this.client.rpc('erp_x_inventory_count_candidates', {
      p_search: search ?? null,
      p_page: page,
      p_page_size: pageSize,
    });
    return inventoryCountCandidatesSchema.parse(rpcPayload(data, error));
  }

  async submitCount(
    balanceId: string,
    countedQuantity: number,
    note: string,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_inventory_submit_count', {
      p_balance_id: balanceId,
      p_counted_quantity: countedQuantity,
      p_note: note || null,
      p_idempotency_key: key,
    });
    return inventoryCountResultSchema.parse(rpcPayload(data, error));
  }

  async reviewCount(
    countId: string,
    decision: 'APPROVE' | 'RECOUNT' | 'REJECT',
    note: string,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_inventory_review_count', {
      p_count_id: countId,
      p_decision: decision,
      p_note: note,
      p_idempotency_key: key,
    });
    return inventoryCountResultSchema.parse(rpcPayload(data, error));
  }

  async listCounts(status?: string, page = 1, pageSize = 25) {
    const { data, error } = await this.client.rpc('erp_x_inventory_counts', {
      p_status: status ?? null,
      p_page: page,
      p_page_size: pageSize,
    });
    return inventoryCountQueueSchema.parse(rpcPayload(data, error));
  }
}
