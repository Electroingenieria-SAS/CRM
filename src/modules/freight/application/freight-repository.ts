import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type {
  FreightHistoryResponse,
  FreightMetrics,
  RecordFreightActualInput,
  RecordFreightActualResponse,
} from '@/modules/freight/application/freight-history.schemas';
import type {
  FreightPredictionInput,
  FreightPredictionResponse,
} from '@/modules/freight/application/freight-prediction.schemas';

export interface FreightHistoryQuery {
  destinationId?: string;
  departmentKey?: string;
  carrierId?: string;
  routeCode?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface FreightRepository {
  getCatalog(): Promise<FreightCatalog>;
  predict(input: FreightPredictionInput): Promise<FreightPredictionResponse>;
  listHistory(query?: FreightHistoryQuery): Promise<FreightHistoryResponse>;
  getMetrics(): Promise<FreightMetrics>;
  recordActual(input: RecordFreightActualInput): Promise<RecordFreightActualResponse>;
}
