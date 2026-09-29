import type {
  LogisticsDetail,
  LogisticsMutation,
  LogisticsQueue,
  LogisticsCandidates,
} from '@/modules/logistics/application/logistics.schemas';
import type {
  RecordFreightActualInput,
  RecordFreightActualResponse,
} from '@/modules/freight/application/freight-history.schemas';

export interface LogisticsQueueQuery {
  status?: string;
  routeCode?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface LogisticsReleaseInput {
  predictionId?: string;
  carrierId?: string;
  destinationId?: string;
  estimatedFreight?: number;
  estimatedFreightLow?: number;
  estimatedFreightHigh?: number;
}

export interface LogisticsRepository {
  candidates(search?: string, page?: number, pageSize?: number): Promise<LogisticsCandidates>;
  list(query?: LogisticsQueueQuery): Promise<LogisticsQueue>;
  detail(orderId: string): Promise<LogisticsDetail>;
  release(orderId: string, input: LogisticsReleaseInput, key: string): Promise<LogisticsMutation>;
  saveGuide(
    shipmentId: string,
    carrierId: string,
    tracking: string,
    key: string,
  ): Promise<LogisticsMutation>;
  dispatch(
    shipmentId: string,
    version: number,
    actualFreight: number | undefined,
    key: string,
  ): Promise<LogisticsMutation>;
  setActualCost(
    shipmentId: string,
    actualFreight: number,
    version: number,
    key: string,
  ): Promise<LogisticsMutation>;
  markFreightSync(
    shipmentId: string,
    success: boolean,
    payload: Record<string, unknown>,
  ): Promise<void>;
  failDelivery(
    shipmentId: string,
    reason: string,
    observation: string | undefined,
    evidenceId: string | undefined,
    version: number,
    key: string,
  ): Promise<LogisticsMutation>;
  reprogram(shipmentId: string, version: number, key: string): Promise<LogisticsMutation>;
  deliver(
    shipmentId: string,
    receivedBy: string | undefined,
    observation: string | undefined,
    evidenceId: string,
    version: number,
    key: string,
  ): Promise<LogisticsMutation>;
  returnShipment(
    shipmentId: string,
    reason: string,
    evidenceId: string,
    version: number,
    key: string,
  ): Promise<LogisticsMutation>;
  satisfaction(
    shipmentId: string,
    rating: number,
    comment: string | undefined,
    key: string,
  ): Promise<void>;
}

export interface LogisticsFreightPort {
  recordActual(input: RecordFreightActualInput): Promise<RecordFreightActualResponse>;
}

export interface LogisticsEvidencePort {
  add(
    orderId: string,
    evidenceType: string,
    storageProvider: string,
    storageReference: string,
    fileName: string | undefined,
    mimeType: string | undefined,
    key: string,
  ): Promise<string | undefined>;
}

export interface LogisticsOrdersPort {
  ensureOperationalStarted(orderId: string, key: string): Promise<void>;
  completeDelivery(orderId: string, key: string): Promise<void>;
}

export interface LogisticsInventoryPort {
  onDispatched(orderId: string, key: string): Promise<void>;
  onReturned(orderId: string, reason: string, key: string): Promise<void>;
}
