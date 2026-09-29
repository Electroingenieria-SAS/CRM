import {
  assertInventoryAdjustment,
  assertPositiveInventoryQuantity,
  normalizeInventoryUnit,
} from '@/modules/inventory/domain/inventory-balance';
import type {
  InventoryListQuery,
  InventoryMaterialQuery,
  InventoryReceiveInput,
  InventoryRepository,
  InventoryReserveInput,
} from '@/modules/inventory/ports/inventory-repository';

function requiredKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('La clave de idempotencia es obligatoria.');
  return key;
}

function optionalPositiveQuantity(quantity: number | undefined) {
  if (quantity === undefined) return undefined;
  return assertPositiveInventoryQuantity(quantity);
}

function reasonRequired(reason: string, message: string) {
  const value = reason.trim();
  if (!value) throw new Error(message);
  return value;
}

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  locations() {
    return this.repository.locations();
  }

  availability(materialId: string, variantId?: string) {
    return this.repository.availability(materialId, variantId);
  }

  list(query: InventoryListQuery = {}) {
    return this.repository.list({
      ...query,
      search: query.search?.trim() || undefined,
      page: Math.max(query.page ?? 1, 1),
      pageSize: Math.min(Math.max(query.pageSize ?? 25, 1), 100),
    });
  }

  materialDetail(query: InventoryMaterialQuery) {
    return this.repository.materialDetail({
      ...query,
      page: Math.max(query.page ?? 1, 1),
      pageSize: Math.min(Math.max(query.pageSize ?? 25, 1), 100),
    });
  }

  orderTrace(orderId: string, page = 1, pageSize = 50) {
    return this.repository.orderTrace(
      orderId,
      Math.max(page, 1),
      Math.min(Math.max(pageSize, 1), 100),
    );
  }

  receive(input: InventoryReceiveInput, key: string) {
    return this.repository.receive(
      {
        ...input,
        quantity: assertPositiveInventoryQuantity(input.quantity),
        unit: normalizeInventoryUnit(input.unit),
      },
      requiredKey(key),
    );
  }

  reserve(input: InventoryReserveInput, key: string) {
    if (!input.orderId && !input.orderNumber?.trim()) {
      throw new Error('La reserva requiere un pedido.');
    }
    return this.repository.reserve(
      {
        ...input,
        orderNumber: input.orderNumber?.trim() || undefined,
        quantity: assertPositiveInventoryQuantity(input.quantity),
        unit: normalizeInventoryUnit(input.unit),
      },
      requiredKey(key),
    );
  }

  release(reservationId: string, quantity: number | undefined, reason: string, key: string) {
    return this.repository.release(
      reservationId,
      optionalPositiveQuantity(quantity),
      reason.trim(),
      requiredKey(key),
    );
  }

  pick(reservationId: string, quantity: number | undefined, key: string) {
    return this.repository.pick(reservationId, optionalPositiveQuantity(quantity), requiredKey(key));
  }

  consume(reservationId: string, quantity: number | undefined, reason: string, key: string) {
    return this.repository.consume(
      reservationId,
      optionalPositiveQuantity(quantity),
      reason.trim(),
      requiredKey(key),
    );
  }

  returnReusable(reservationId: string, quantity: number | undefined, reason: string, key: string) {
    return this.repository.returnReusable(
      reservationId,
      optionalPositiveQuantity(quantity),
      reasonRequired(reason, 'La devolución requiere un motivo.'),
      requiredKey(key),
    );
  }

  waste(reservationId: string, quantity: number | undefined, reason: string, key: string) {
    return this.repository.waste(
      reservationId,
      optionalPositiveQuantity(quantity),
      reasonRequired(reason, 'El desperdicio requiere un motivo.'),
      requiredKey(key),
    );
  }

  adjust(balanceId: string, delta: number, reason: string, key: string) {
    assertInventoryAdjustment(delta, reason);
    return this.repository.adjust(balanceId, delta, reason.trim(), requiredKey(key));
  }

  reverseMovement(movementId: string, reason: string, key: string) {
    return this.repository.reverseMovement(
      movementId,
      reasonRequired(reason, 'El reverso requiere un motivo.'),
      requiredKey(key),
    );
  }

  countCandidates(search?: string, page = 1, pageSize = 25) {
    return this.repository.countCandidates(
      search?.trim() || undefined,
      Math.max(page, 1),
      Math.min(Math.max(pageSize, 1), 100),
    );
  }

  submitCount(balanceId: string, countedQuantity: number, note: string, key: string) {
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      throw new Error('El conteo físico no puede ser negativo.');
    }
    return this.repository.submitCount(balanceId, countedQuantity, note.trim(), requiredKey(key));
  }

  reviewCount(
    countId: string,
    decision: 'APPROVE' | 'RECOUNT' | 'REJECT',
    note: string,
    key: string,
  ) {
    return this.repository.reviewCount(
      countId,
      decision,
      reasonRequired(note, 'La revisión del conteo requiere una nota.'),
      requiredKey(key),
    );
  }

  listCounts(status?: string, page = 1, pageSize = 25) {
    return this.repository.listCounts(
      status?.trim() || undefined,
      Math.max(page, 1),
      Math.min(Math.max(pageSize, 1), 100),
    );
  }
}
