import type {
  CuttingInventoryPort,
  PickingInventoryPort,
  ReceivingInventoryPort,
} from '@/modules/inventory/ports/inventory-integration-ports';
import {
  cuttingJobInputSchema,
  orderReceptionInputSchema,
  pickingJobInputSchema,
  purchaseOrderInputSchema,
  purchaseRequestInputSchema,
  receiptInputSchema,
  type SupplyArea,
} from '@/modules/supply/application/supply.schemas';
import type { SupplyRepository } from '@/modules/supply/ports/supply-repository';

function requiredKey(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error('La clave de idempotencia es obligatoria.');
  return normalized;
}

export class SupplyService {
  constructor(
    private readonly repository: SupplyRepository,
    private readonly receivingInventory: ReceivingInventoryPort,
    private readonly pickingInventory: PickingInventoryPort,
    private readonly cuttingInventory: CuttingInventoryPort,
  ) {}

  queue(area: SupplyArea, status?: string, search?: string, page = 1, pageSize = 25) {
    return this.repository.queue(
      area,
      status?.trim() || undefined,
      search?.trim() || undefined,
      Math.max(page, 1),
      Math.min(Math.max(pageSize, 1), 100),
    );
  }

  createOrderReception(input: unknown, idempotencyKey: string) {
    return this.repository.createOrderReception(
      orderReceptionInputSchema.parse(input),
      requiredKey(idempotencyKey),
    );
  }

  confirmOrderReception(receptionId: string, idempotencyKey: string) {
    return this.repository.confirmOrderReception(receptionId, requiredKey(idempotencyKey));
  }

  createPurchaseRequest(input: unknown, idempotencyKey: string) {
    return this.repository.createPurchaseRequest(
      purchaseRequestInputSchema.parse(input),
      requiredKey(idempotencyKey),
    );
  }

  issuePurchaseOrder(input: unknown, idempotencyKey: string) {
    return this.repository.issuePurchaseOrder(
      purchaseOrderInputSchema.parse(input),
      requiredKey(idempotencyKey),
    );
  }

  createReceipt(input: unknown, idempotencyKey: string) {
    return this.repository.createReceipt(
      receiptInputSchema.parse(input),
      requiredKey(idempotencyKey),
    );
  }

  async receiveLine(
    line: {
      lineId: string;
      materialId: string;
      variantId?: string;
      locationId: string;
      quantity: number;
      unit: string;
      orderId?: string;
      reference?: string;
    },
    idempotencyKey: string,
  ) {
    const operationKey = requiredKey(idempotencyKey);
    if (!(line.quantity > 0)) throw new Error('La cantidad aceptada debe ser mayor que cero.');

    const receipt = await this.receivingInventory.receive(
      {
        materialId: line.materialId,
        variantId: line.variantId,
        locationId: line.locationId,
        quantity: line.quantity,
        unit: line.unit,
        orderId: line.orderId,
        reference: line.reference,
        reason: 'Recepción de mercancía',
        metadata: { source: 'SUPPLY_RECEIVING', receiptLineId: line.lineId },
      },
      `${operationKey}:inventory`,
    );

    return this.repository.confirmReceiptLine(
      line.lineId,
      receipt.movementId,
      `${operationKey}:domain`,
    );
  }

  createPickingJob(input: unknown, idempotencyKey: string) {
    return this.repository.createPickingJob(
      pickingJobInputSchema.parse(input),
      requiredKey(idempotencyKey),
    );
  }

  async pickLine(
    line: {
      lineId: string;
      orderId: string;
      orderNumber?: string;
      materialId: string;
      variantId?: string;
      locationId?: string;
      quantity: number;
      unit: string;
    },
    idempotencyKey: string,
  ) {
    const operationKey = requiredKey(idempotencyKey);
    const reserved = await this.pickingInventory.reserve(
      {
        orderId: line.orderId,
        orderNumber: line.orderNumber,
        materialId: line.materialId,
        variantId: line.variantId,
        locationId: line.locationId,
        quantity: line.quantity,
        unit: line.unit,
        reference: 'Picking',
        metadata: { source: 'SUPPLY_PICKING', pickingLineId: line.lineId },
      },
      `${operationKey}:reserve`,
    );
    const picked = await this.pickingInventory.pick(
      reserved.reservationId,
      line.quantity,
      `${operationKey}:pick`,
    );

    return this.repository.syncPickingLine(
      line.lineId,
      reserved.reservationId,
      picked.quantity ?? line.quantity,
      `${operationKey}:domain`,
    );
  }

  createCuttingJob(input: unknown, idempotencyKey: string) {
    return this.repository.createCuttingJob(
      cuttingJobInputSchema.parse(input),
      requiredKey(idempotencyKey),
    );
  }

  startCutting(jobId: string, idempotencyKey: string) {
    return this.repository.startCutting(jobId, requiredKey(idempotencyKey));
  }

  async completeCutLine(
    line: {
      lineId: string;
      reservationId: string;
      consumed: number;
      reusable: number;
      waste: number;
    },
    idempotencyKey: string,
  ) {
    const operationKey = requiredKey(idempotencyKey);
    if ([line.consumed, line.reusable, line.waste].some((value) => value < 0)) {
      throw new Error('Las cantidades de corte no pueden ser negativas.');
    }
    if (line.consumed + line.reusable + line.waste <= 0) {
      throw new Error('Registra al menos un resultado de corte.');
    }

    if (line.consumed > 0) {
      await this.cuttingInventory.consume(
        line.reservationId,
        line.consumed,
        'Consumo en corte',
        `${operationKey}:consume`,
      );
    }
    if (line.reusable > 0) {
      await this.cuttingInventory.returnReusable(
        line.reservationId,
        line.reusable,
        'Sobrante reutilizable de corte',
        `${operationKey}:return`,
      );
    }
    if (line.waste > 0) {
      await this.cuttingInventory.waste(
        line.reservationId,
        line.waste,
        'Desperdicio de corte',
        `${operationKey}:waste`,
      );
    }

    return this.repository.syncCuttingLine(
      line.lineId,
      line.consumed,
      line.reusable,
      line.waste,
      `${operationKey}:domain`,
    );
  }

  completeCutting(jobId: string, evidenceId: string, idempotencyKey: string) {
    if (!evidenceId.trim()) throw new Error('Corte requiere evidencia fotográfica.');
    return this.repository.completeCutting(jobId, evidenceId, requiredKey(idempotencyKey));
  }
}
