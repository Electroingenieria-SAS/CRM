'use client';

import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type {
  LogisticsCandidates,
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type {
  LogisticsQueueQuery,
  LogisticsReleaseInput,
} from '@/modules/logistics/ports/logistics-ports';
import { LogisticsReleaseSection } from './logistics-release-section';
import { LogisticsShippingSection } from './logistics-shipping-section';
import { LogisticsTraceSection } from './logistics-trace-section';
import styles from '@/modules/logistics/ui/logistics-ui.module.css';

export interface LogisticsWorkspaceBodyProps {
  candidates: LogisticsCandidates;
  queue: LogisticsQueue;
  catalog: FreightCatalog;
  detail: LogisticsDetail | null;
  prediction: FreightPredictionResult | null;
  query: LogisticsQueueQuery;
  candidateSearch: string;
  busy: boolean;
  message: string | null;
  notice: string | null;
  canRelease: boolean;
  canUpdate: boolean;
  canCorrectCost: boolean;
  canSatisfaction: boolean;
  onQuery(query: LogisticsQueueQuery): void;
  onCandidateSearch(value: string): void;
  onSearchCandidates(): void;
  onSearchQueue(): void;
  onOpenDetail(orderId: string): Promise<void>;
  onEstimate(
    orderId: string,
    routeCode: 'LOCAL_DISPATCH' | 'NATIONAL_DISPATCH',
    destinationId: string,
    carrierId?: string,
  ): Promise<void>;
  onRelease(orderId: string, input: LogisticsReleaseInput): Promise<void>;
  onSaveGuide(shipmentId: string, carrierId: string, tracking: string): Promise<void>;
  onDispatch(shipmentId: string, orderId: string, version: number, cost?: number): Promise<void>;
  onSetActualCost(shipmentId: string, version: number, cost: number): Promise<void>;
  onDeliver(
    shipmentId: string,
    orderId: string,
    version: number,
    file: File,
    receivedBy?: string,
    observation?: string,
  ): Promise<void>;
  onFail(
    shipmentId: string,
    orderId: string,
    version: number,
    reason: string,
    observation?: string,
    file?: File,
  ): Promise<void>;
  onReprogram(shipmentId: string, version: number): Promise<void>;
  onReturn(
    shipmentId: string,
    orderId: string,
    version: number,
    reason: string,
    file: File,
  ): Promise<void>;
  onSatisfaction(shipmentId: string, rating: number, comment?: string): Promise<void>;
}

export function LogisticsWorkspaceBody(props: LogisticsWorkspaceBodyProps) {
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Tramo final del pedido</p>
          <h1>Logística y entrega</h1>
          <p>Libera, despacha y confirma entregas con evidencia y trazabilidad completa.</p>
        </div>
      </header>

      {props.message ? <p className={styles.error} role="alert">{props.message}</p> : null}
      {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}

      <LogisticsReleaseSection
        candidates={props.candidates}
        catalog={props.catalog}
        prediction={props.prediction}
        candidateSearch={props.candidateSearch}
        busy={props.busy}
        canRelease={props.canRelease}
        onCandidateSearch={props.onCandidateSearch}
        onSearchCandidates={props.onSearchCandidates}
        onEstimate={props.onEstimate}
        onRelease={props.onRelease}
      />

      <LogisticsShippingSection
        queue={props.queue}
        catalog={props.catalog}
        detail={props.detail}
        query={props.query}
        busy={props.busy}
        canUpdate={props.canUpdate}
        canCorrectCost={props.canCorrectCost}
        canSatisfaction={props.canSatisfaction}
        onQuery={props.onQuery}
        onSearchQueue={props.onSearchQueue}
        onOpenDetail={props.onOpenDetail}
        onSaveGuide={props.onSaveGuide}
        onDispatch={props.onDispatch}
        onSetActualCost={props.onSetActualCost}
        onDeliver={props.onDeliver}
        onFail={props.onFail}
        onReprogram={props.onReprogram}
        onReturn={props.onReturn}
        onSatisfaction={props.onSatisfaction}
      />

      <LogisticsTraceSection detail={props.detail} />
      {props.busy ? <p role="status">Actualizando logística…</p> : null}
    </div>
  );
}
