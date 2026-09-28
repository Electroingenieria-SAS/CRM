import {
  recordFreightActualInputSchema,
  type RecordFreightActualInput,
} from '@/modules/freight/application/freight-history.schemas';
import {
  freightPredictionInputSchema,
  type FreightPredictionInput,
} from '@/modules/freight/application/freight-prediction.schemas';
import type { FreightQuotePort } from '@/modules/freight/application/freight-quote-port';
import type {
  FreightHistoryQuery,
  FreightRepository,
} from '@/modules/freight/application/freight-repository';

function normalizeHistoryQuery(query: FreightHistoryQuery): FreightHistoryQuery {
  return {
    ...query,
    page: Math.max(1, query.page ?? 1),
    pageSize: Math.min(100, Math.max(1, query.pageSize ?? 25)),
    departmentKey: query.departmentKey?.trim() || undefined,
    routeCode: query.routeCode?.trim().toUpperCase() || undefined,
  };
}

export class FreightService implements FreightQuotePort {
  constructor(private readonly repository: FreightRepository) {}

  getCatalog() {
    return this.repository.getCatalog();
  }

  quote(input: FreightPredictionInput) {
    return this.predict(input);
  }

  predict(input: FreightPredictionInput) {
    return this.repository.predict(freightPredictionInputSchema.parse(input));
  }

  listHistory(query: FreightHistoryQuery = {}) {
    return this.repository.listHistory(normalizeHistoryQuery(query));
  }

  getMetrics() {
    return this.repository.getMetrics();
  }

  recordActual(input: RecordFreightActualInput) {
    return this.repository.recordActual(recordFreightActualInputSchema.parse(input));
  }
}
