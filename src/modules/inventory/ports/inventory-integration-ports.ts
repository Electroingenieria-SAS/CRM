import type {
  InventoryReceiveInput,
  InventoryReserveInput,
} from '@/modules/inventory/ports/inventory-repository';
import type {
  InventoryAvailability,
  InventoryReceiptResult,
  InventoryReservationResult,
} from '@/modules/inventory/application/inventory.schemas';

export interface ReceivingInventoryPort {
  receive(
    input: InventoryReceiveInput,
    idempotencyKey: string,
  ): Promise<InventoryReceiptResult>;
}

export interface PickingInventoryPort {
  reserve(
    input: InventoryReserveInput,
    idempotencyKey: string,
  ): Promise<InventoryReservationResult>;
  release(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryReservationResult>;
  pick(
    reservationId: string,
    quantity: number | undefined,
    idempotencyKey: string,
  ): Promise<InventoryReservationResult>;
}

export interface CuttingInventoryPort {
  consume(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryReservationResult>;
  returnReusable(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryReservationResult>;
  waste(
    reservationId: string,
    quantity: number | undefined,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryReservationResult>;
}

export interface OrdersInventoryAvailabilityPort {
  availability(materialId: string, variantId?: string): Promise<InventoryAvailability>;
}

export interface PurchasingInventoryAvailabilityPort {
  availability(materialId: string, variantId?: string): Promise<InventoryAvailability>;
}

export interface OrdersInventoryTracePort {
  orderTrace(orderId: string): Promise<unknown>;
}
