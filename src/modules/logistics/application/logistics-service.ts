import type {
  LogisticsEvidencePort,
  LogisticsFreightPort,
  LogisticsInventoryPort,
  LogisticsOrdersPort,
  LogisticsQueueQuery,
  LogisticsReleaseInput,
  LogisticsRepository,
} from '@/modules/logistics/ports/logistics-ports';
import type { OrderEvidenceStoragePort } from '@/shared/evidence/order-evidence-storage';

function requiredKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('La clave de idempotencia es obligatoria.');
  return key;
}

export class LogisticsService {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly freight: LogisticsFreightPort,
    private readonly evidence: LogisticsEvidencePort,
    private readonly orders: LogisticsOrdersPort,
    private readonly storage: OrderEvidenceStoragePort,
    private readonly inventory?: LogisticsInventoryPort,
  ) {}

  candidates(search?: string, page = 1, pageSize = 25) {
    return this.repository.candidates(search?.trim() || undefined, page, pageSize);
  }

  list(query: LogisticsQueueQuery = {}) {
    return this.repository.list({
      ...query,
      search: query.search?.trim() || undefined,
      status: query.status?.trim().toUpperCase() || undefined,
      routeCode: query.routeCode?.trim().toUpperCase() || undefined,
      page: Math.max(query.page ?? 1, 1),
      pageSize: Math.min(Math.max(query.pageSize ?? 25, 1), 100),
    });
  }

  detail(orderId: string) {
    return this.repository.detail(orderId);
  }

  release(orderId: string, input: LogisticsReleaseInput, key: string) {
    return this.repository.release(orderId, input, requiredKey(key));
  }

  saveGuide(shipmentId: string, carrierId: string, tracking: string, key: string) {
    if (!carrierId.trim() || !tracking.trim()) {
      throw new Error('Transportadora y número de guía son obligatorios.');
    }
    return this.repository.saveGuide(
      shipmentId,
      carrierId.trim(),
      tracking.trim(),
      requiredKey(key),
    );
  }

  async uploadEvidence(
    organizationId: string,
    orderId: string,
    evidenceType: string,
    file: File,
    key: string,
  ) {
    const normalizedType = evidenceType.trim().toUpperCase();
    const stored = await this.storage.upload({
      organizationId,
      orderId,
      evidenceType: normalizedType,
      file,
    });
    return this.addEvidence(
      orderId,
      normalizedType,
      stored.storageProvider,
      stored.storageReference,
      stored.fileName,
      stored.mimeType,
      key,
    );
  }

  async addEvidence(
    orderId: string,
    evidenceType: string,
    storageProvider: string,
    storageReference: string,
    fileName: string | undefined,
    mimeType: string | undefined,
    key: string,
  ) {
    if (!storageReference.trim()) throw new Error('La referencia de evidencia es obligatoria.');
    return this.evidence.add(
      orderId,
      evidenceType.trim().toUpperCase(),
      storageProvider.trim() || 'EXTERNAL',
      storageReference.trim(),
      fileName?.trim() || undefined,
      mimeType?.trim() || undefined,
      requiredKey(key),
    );
  }

  async dispatch(
    shipmentId: string,
    orderId: string,
    version: number,
    actualFreight: number | undefined,
    key: string,
  ) {
    const idempotencyKey = requiredKey(key);
    await this.orders.ensureOperationalStarted(orderId, `${idempotencyKey}:orders`);
    const result = await this.repository.dispatch(
      shipmentId,
      version,
      actualFreight,
      idempotencyKey,
    );

    await this.inventory?.onDispatched(orderId, `${idempotencyKey}:inventory`);
    if (result.actualFreight !== null && result.actualFreight !== undefined) {
      await this.syncFreight(result, `${idempotencyKey}:freight`);
    }
    return result;
  }

  async setActualCost(shipmentId: string, cost: number, version: number, key: string) {
    if (!(cost >= 0)) throw new Error('El costo real no puede ser negativo.');
    const idempotencyKey = requiredKey(key);
    const result = await this.repository.setActualCost(
      shipmentId,
      cost,
      version,
      idempotencyKey,
    );
    await this.syncFreight(result, `${idempotencyKey}:freight`);
    return result;
  }

  async failDelivery(
    shipmentId: string,
    orderId: string,
    reason: string,
    observation: string | undefined,
    evidenceId: string | undefined,
    version: number,
    key: string,
  ) {
    if (!reason.trim()) throw new Error('El motivo de no entrega es obligatorio.');
    const idempotencyKey = requiredKey(key);
    await this.orders.ensureOperationalStarted(orderId, `${idempotencyKey}:orders`);
    return this.repository.failDelivery(
      shipmentId,
      reason.trim(),
      observation?.trim() || undefined,
      evidenceId,
      version,
      idempotencyKey,
    );
  }

  reprogram(shipmentId: string, version: number, key: string) {
    return this.repository.reprogram(shipmentId, version, requiredKey(key));
  }

  async deliver(
    shipmentId: string,
    orderId: string,
    receivedBy: string | undefined,
    observation: string | undefined,
    evidenceId: string,
    version: number,
    key: string,
  ) {
    if (!evidenceId) throw new Error('La evidencia de entrega es obligatoria.');
    const idempotencyKey = requiredKey(key);
    await this.orders.ensureOperationalStarted(orderId, `${idempotencyKey}:orders`);
    return this.repository.deliver(
      shipmentId,
      receivedBy?.trim() || undefined,
      observation?.trim() || undefined,
      evidenceId,
      version,
      idempotencyKey,
    );
  }

  async returnShipment(
    shipmentId: string,
    orderId: string,
    reason: string,
    evidenceId: string,
    version: number,
    key: string,
  ) {
    if (!reason.trim() || !evidenceId) {
      throw new Error('La devolución requiere motivo y evidencia.');
    }
    const idempotencyKey = requiredKey(key);
    await this.orders.ensureOperationalStarted(orderId, `${idempotencyKey}:orders`);
    const result = await this.repository.returnShipment(
      shipmentId,
      reason.trim(),
      evidenceId,
      version,
      idempotencyKey,
    );
    await this.inventory?.onReturned(orderId, reason.trim(), `${idempotencyKey}:inventory`);
    return result;
  }

  satisfaction(shipmentId: string, rating: number, comment: string | undefined, key: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('La calificación debe estar entre 1 y 5.');
    }
    return this.repository.satisfaction(
      shipmentId,
      rating,
      comment?.trim() || undefined,
      requiredKey(key),
    );
  }

  private async syncFreight(
    result: {
      shipmentId: string;
      orderId?: string;
      actualFreight?: number | null;
      carrierId?: string | null;
      destinationId?: string | null;
      predictionId?: string | null;
      routeCode?: 'CLIENT_POINT' | 'CLIENT_PICKUP' | 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH';
      dispatchedAt?: string;
    },
    externalKey: string,
  ) {
    if (
      result.actualFreight === null ||
      result.actualFreight === undefined ||
      !result.carrierId ||
      !result.destinationId ||
      !result.routeCode
    ) {
      await this.repository.markFreightSync(result.shipmentId, false, {
        reason: 'MISSING_FREIGHT_DIMENSIONS',
      });
      return;
    }

    try {
      const recorded = await this.freight.recordActual({
        carrierId: result.carrierId,
        destinationId: result.destinationId,
        routeCode: result.routeCode,
        actualCost: result.actualFreight,
        observedAt: result.dispatchedAt ?? new Date().toISOString(),
        orderId: result.orderId,
        predictionId: result.predictionId ?? undefined,
        externalKey,
      });
      await this.repository.markFreightSync(result.shipmentId, true, {
        observationId: recorded.observationId,
        absoluteError: recorded.absoluteError,
        absolutePercentageError: recorded.absolutePercentageError,
      });
    } catch (error) {
      await this.repository.markFreightSync(result.shipmentId, false, {
        reason: error instanceof Error ? error.message : 'FREIGHT_SYNC_FAILED',
      });
    }
  }
}
