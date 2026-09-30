import type { LogisticsBrowserApplication } from '@/composition/logistics-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type { LogisticsCandidates } from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsQueueQuery } from '@/modules/logistics/ports/logistics-ports';

export interface LogisticsPageActionDependencies {
  application: LogisticsBrowserApplication | null;
  context: SessionContext | null;
  candidateSearch: string;
  query: LogisticsQueueQuery;
  execute(operation: () => Promise<unknown>, success: string): Promise<void>;
  loadQueue(query: LogisticsQueueQuery): Promise<void>;
  setCandidates(value: LogisticsCandidates): void;
  setPrediction(value: FreightPredictionResult | null): void;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
  goToLogin(): void;
}
