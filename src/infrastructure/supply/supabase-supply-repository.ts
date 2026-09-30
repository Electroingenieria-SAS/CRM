import type { SupabaseClient } from '@supabase/supabase-js';
import {
  supplyMutationSchema,
  supplyQueueSchema,
  type CuttingJobInput,
  type OrderReceptionInput,
  type PickingJobInput,
  type PurchaseOrderInput,
  type PurchaseRequestInput,
  type ReceiptInput,
  type SupplyArea,
} from '@/modules/supply/application/supply.schemas';
import type { SupplyRepository } from '@/modules/supply/ports/supply-repository';
import { AppError } from '@/shared/errors/app-error';

function mapSupplyError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.trim();
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', message || 'No tienes permisos para esta operación.');
  }
  if (error?.code === '40001') {
    return new AppError(
      'BUSINESS_RULE',
      message || 'La operación cambió mientras estaba abierta. Actualiza e inténtalo de nuevo.',
    );
  }
  if (error?.code === '22023' || error?.code === '23514' || error?.code === '23505') {
    return new AppError('BUSINESS_RULE', message || 'La operación no cumple las reglas del proceso.');
  }
  return new AppError('DATABASE', message || 'No fue posible completar la operación.');
}

export class SupabaseSupplyRepository implements SupplyRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async mutation(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw mapSupplyError(error);
    return supplyMutationSchema.parse(data);
  }

  async queue(area: SupplyArea, status?: string, search?: string, page = 1, pageSize = 25) {
    const { data, error } = await this.client.rpc('erp_x_supply_queue', {
      p_area: area,
      p_status: status ?? null,
      p_search: search ?? null,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) throw mapSupplyError(error);
    return supplyQueueSchema.parse(data);
  }

  createOrderReception(input: OrderReceptionInput, key: string) {
    return this.mutation('erp_x_order_reception_create', {
      p_payload: input,
      p_idempotency_key: key,
    });
  }

  confirmOrderReception(receptionId: string, key: string) {
    return this.mutation('erp_x_order_reception_confirm', {
      p_reception_id: receptionId,
      p_idempotency_key: key,
    });
  }

  createPurchaseRequest(input: PurchaseRequestInput, key: string) {
    return this.mutation('erp_x_procurement_request', {
      p_payload: input,
      p_idempotency_key: key,
    });
  }

  issuePurchaseOrder(input: PurchaseOrderInput, key: string) {
    return this.mutation('erp_x_procurement_issue_order', {
      p_payload: input,
      p_idempotency_key: key,
    });
  }

  createReceipt(input: ReceiptInput, key: string) {
    return this.mutation('erp_x_receiving_create', {
      p_payload: input,
      p_idempotency_key: key,
    });
  }

  confirmReceiptLine(lineId: string, movementId: string | undefined, key: string) {
    return this.mutation('erp_x_receiving_confirm_line', {
      p_line_id: lineId,
      p_inventory_movement_id: movementId ?? null,
      p_idempotency_key: key,
    });
  }

  createPickingJob(input: PickingJobInput, key: string) {
    return this.mutation('erp_x_picking_create', {
      p_payload: input,
      p_idempotency_key: key,
    });
  }

  syncPickingLine(lineId: string, reservationId: string, pickedQuantity: number, key: string) {
    return this.mutation('erp_x_picking_sync_line', {
      p_line_id: lineId,
      p_reservation_id: reservationId,
      p_picked_quantity: pickedQuantity,
      p_idempotency_key: key,
    });
  }

  createCuttingJob(input: CuttingJobInput, key: string) {
    return this.mutation('erp_x_cutting_create', {
      p_payload: input,
      p_idempotency_key: key,
    });
  }

  startCutting(jobId: string, key: string) {
    return this.mutation('erp_x_cutting_start', {
      p_job_id: jobId,
      p_idempotency_key: key,
    });
  }

  syncCuttingLine(
    lineId: string,
    consumed: number,
    reusable: number,
    waste: number,
    key: string,
  ) {
    return this.mutation('erp_x_cutting_sync_line', {
      p_line_id: lineId,
      p_consumed: consumed,
      p_reusable: reusable,
      p_waste: waste,
      p_idempotency_key: key,
    });
  }

  completeCutting(jobId: string, evidenceId: string | undefined, key: string) {
    return this.mutation('erp_x_cutting_complete', {
      p_job_id: jobId,
      p_evidence_id: evidenceId ?? null,
      p_idempotency_key: key,
    });
  }
}
