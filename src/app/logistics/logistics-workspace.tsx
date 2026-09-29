'use client';

import { useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import type {
  LogisticsCandidate,
  LogisticsCandidates,
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type {
  LogisticsQueueQuery,
  LogisticsReleaseInput,
} from '@/modules/logistics/ports/logistics-ports';
import { LogisticsOperationPanel } from '@/modules/logistics/ui/logistics-operation-panel';
import { LogisticsReleasePanel } from '@/modules/logistics/ui/logistics-release-panel';
import { AppShell } from '@/shared/ui/app-shell';
import {
  LogisticsCandidateList,
  LogisticsShipmentList,
  logisticsNavigation,
} from './logistics-workspace-sections';
import styles from '@/modules/logistics/ui/logistics-ui.module.css';

interface LogisticsWorkspaceProps {
  context: SessionContext;
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
  onSignOut(): Promise<void>;
}

export function LogisticsWorkspace(props: LogisticsWorkspaceProps) {
  const [candidate, setCandidate] = useState<LogisticsCandidate | null>(null);
  const canCreate = hasModuleCapability(props.context, 'shipping', 'create');
  const canUpdate = hasModuleCapability(props.context, 'shipping', 'update');
  const canCorrectCost =
    hasModuleCapability(props.context, 'shipping', 'approve') ||
    hasModuleCapability(props.context, 'freight', 'update');
  const canSatisfaction =
    hasModuleCapability(props.context, 'shipping', 'update') ||
    hasModuleCapability(props.context, 'sales', 'create');

  useEffect(() => {
    if (candidate && !props.candidates.items.some((item) => item.orderId === candidate.orderId)) {
      setCandidate(null);
    }
  }, [candidate, props.candidates.items]);

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={logisticsNavigation(props.context)}
      onSignOut={props.onSignOut}
    >
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

        <section className={styles.section} aria-labelledby="release-queue-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="release-queue-title">Por liberar</h2>
              <p>Facturación y Finance ya deben estar listos.</p>
            </div>
            <div className={styles.inlineSearch}>
              <input
                aria-label="Buscar candidatos"
                value={props.candidateSearch}
                onChange={(event) => props.onCandidateSearch(event.target.value)}
                placeholder="Pedido o cliente"
              />
              <button type="button" disabled={props.busy} onClick={props.onSearchCandidates}>
                Buscar
              </button>
            </div>
          </div>
          <div className={styles.twoColumns}>
            <LogisticsCandidateList
              items={props.candidates.items}
              selectedId={candidate?.orderId}
              onSelect={setCandidate}
            />
            <LogisticsReleasePanel
              candidate={candidate}
              catalog={props.catalog}
              prediction={props.prediction}
              busy={props.busy}
              canRelease={canCreate}
              onEstimate={props.onEstimate}
              onRelease={props.onRelease}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="shipping-queue-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="shipping-queue-title">Despachos y entregas</h2>
              <p>Consulta por estado, modalidad, pedido o guía.</p>
            </div>
          </div>

          <div className={styles.filters}>
            <input
              aria-label="Buscar despachos"
              value={props.query.search ?? ''}
              onChange={(event) => props.onQuery({ ...props.query, search: event.target.value })}
              placeholder="Pedido, cliente o guía"
            />
            <select
              aria-label="Estado logístico"
              value={props.query.status ?? ''}
              onChange={(event) =>
                props.onQuery({ ...props.query, status: event.target.value || undefined })
              }
            >
              <option value="">Todos los estados</option>
              {['READY', 'IN_TRANSIT', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED'].map(
                (status) => (
                  <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                ),
              )}
            </select>
            <select
              aria-label="Modalidad"
              value={props.query.routeCode ?? ''}
              onChange={(event) =>
                props.onQuery({ ...props.query, routeCode: event.target.value || undefined })
              }
            >
              <option value="">Todas las modalidades</option>
              {['CLIENT_POINT', 'CLIENT_PICKUP', 'LOCAL_DISPATCH', 'NATIONAL_DISPATCH'].map(
                (route) => (
                  <option key={route} value={route}>{route.replaceAll('_', ' ')}</option>
                ),
              )}
            </select>
            <button type="button" disabled={props.busy} onClick={props.onSearchQueue}>
              Filtrar
            </button>
          </div>

          <div className={styles.twoColumns}>
            <LogisticsShipmentList
              items={props.queue.items}
              selectedOrderId={props.detail?.order.id}
              onSelect={(orderId) => void props.onOpenDetail(orderId)}
            />
            <LogisticsOperationPanel
              detail={props.detail}
              catalog={props.catalog}
              busy={props.busy}
              canUpdate={canUpdate}
              canCorrectCost={canCorrectCost}
              canSatisfaction={canSatisfaction}
              onSaveGuide={props.onSaveGuide}
              onDispatch={props.onDispatch}
              onSetActualCost={props.onSetActualCost}
              onDeliver={props.onDeliver}
              onFail={props.onFail}
              onReprogram={props.onReprogram}
              onReturn={props.onReturn}
              onSatisfaction={props.onSatisfaction}
            />
          </div>
        </section>

        {props.detail?.events.length ? (
          <section className={styles.section} aria-labelledby="trace-title">
            <h2 id="trace-title">Trazabilidad</h2>
            <ol className={styles.timeline}>
              {props.detail.events.slice(0, 20).map((event, index) => (
                <li key={String(event.id ?? index)}>
                  <strong>{String(event.eventType ?? 'EVENTO').replaceAll('_', ' ')}</strong>
                  <span>
                    {event.createdAt
                      ? new Date(String(event.createdAt)).toLocaleString('es-CO')
                      : ''}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {props.busy ? <p role="status">Actualizando logística…</p> : null}
      </div>
    </AppShell>
  );
}
