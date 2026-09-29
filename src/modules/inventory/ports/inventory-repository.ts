import type {
  InventoryAdjustmentResult,
  InventoryAvailability,
  InventoryCountCandidates,
  InventoryCountQueue,
  InventoryCountResult,
  InventoryList,
  InventoryLocation,
  InventoryMaterialDetail,
  InventoryOrderTrace,
  InventoryReceiptResult,
  InventoryReservationResult,
} from '@/modules/inventory/application/inventory.schemas';

export interface InventoryListQuery {
  search?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryMaterialQuery {
  materialId: string;
  variantId?: string;
  page?: number;
  pageSize?: number;
}

export interface InventoryReceiveInput {
  materialId: string;
  variantId?: string;
  locationId: string;
  quantity: number;
  unit: string;
  orderId?: string;
  reference?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryReserveInput {
  orderId?: string;
  orderNumber?: string;
  materialId: string;
  variantId?: string;
  locationId?: string;
  quantity: number;
  unit: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryRepository {
  locations(): Promise<InventoryLocation[]>;
  availability(materialId: string, variantId?: string): Promise<InventoryAvailability>;
  list(query?: InventoryListQuery): Promise<InventoryList>;
  materialDetail(query: InventoryMaterialQuery): Promise<InventoryMaterialDetail>;
  orderTrace(orderId: string, page?: number, pageSize?: number): Promise<InventoryOrderTrace>;
  receive(input: InventoryReceiveInput, key: string): Promise<InventoryReceiptResult>;
  reserve(input: InventoryReserveInput, key: string): Promise<InventoryReservationResult>;
  release(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ): Promise<InventoryReservationResult>;
  pick(
    reservationId: string,
    quantity: number | undefined,
    key: string,
  ): Promise<InventoryReservationResult>;
  consume(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ): Promise<InventoryReservationResult>;
  returnReusable(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ): Promise<InventoryReservationResult>;
  waste(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    key: string,
  ): Promise<InventoryReservationResult>;
  adjust(
    balanceId: string,
    delta: number,
    reason: string,
    key: string,
  ): Promise<InventoryAdjustmentResult>;
  reverseMovement(
    movementId: string,
    reason: string,
    key: string,
  ): Promise<InventoryAdjustmentResult>;
  countCandidates(search?: string, page?: number, pageSize?: number): Promise<InventoryCountCandidates>;
  submitCount(
    balanceId: string,
    countedQuantity: number,
    note: string,
    key: string,
  ): Promise<InventoryCountResult>;
  reviewCount(
    countId: string,
    decision: 'APPROVE' | 'RECOUNT' | 'REJECT',
    note: string,
    key: string,
  ): Promise<InventoryCountResult>;
  listCounts(status?: string, page?: number, pageSize?: number): Promise<InventoryCountQueue>;
}
