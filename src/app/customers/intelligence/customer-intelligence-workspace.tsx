'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CustomerIntelligenceDetail,
  CustomerIntelligenceList,
  ParetoResponse,
} from '@/modules/customers/application/customer-intelligence.schemas';
import {
  CustomerIntelligenceFilters,
  type CustomerIntelligenceFilterValues,
} from '@/modules/customers/ui/customer-intelligence-filters';
import { CustomerIntelligenceDetailPanel } from '@/modules/customers/ui/customer-intelligence-detail';
import { CustomerRanking } from '@/modules/customers/ui/customer-ranking';
import { ParetoChart } from '@/modules/customers/ui/pareto-chart';
import { AppShell } from '@/shared/ui/app-shell';
import styles from './customer-intelligence-page.module.css';

interface Props {
  context: SessionContext;
  ranking: CustomerIntelligenceList | null;
  pareto: ParetoResponse | null;
  detail: CustomerIntelligenceDetail | null;
  filters: CustomerIntelligenceFilterValues;
  loading: boolean;
  recalculating: boolean;
  message: string | null;
  notice: string | null;
  onFiltersChange(filters: CustomerIntelligenceFilterValues): void;
  onSearch(): void;
  onOpenDetail(customerId: string): void;
  onCloseDetail(): void;
  onRecalculate(): Promise<void>;
  onSignOut(): Promise<void>;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Sin cálculo';
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function CustomerIntelligenceWorkspace(props: Props) {
  const canRecalculate = hasModuleCapability(
    props.context,
    'customer_intelligence',
    'admin',
  );

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      currentSection="customer-intelligence"
      onSignOut={props.onSignOut}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Customer Intelligence</p>
          <h1>Ranking y Pareto de clientes</h1>
          <p>
            Clasificación automática y explicable basada únicamente en cantidad de pedidos y valor
            efectivamente pagado mediante facturas registradas.
          </p>
        </div>
        <div className={styles.actions}>
          {canRecalculate ? (
            <button
              className="primary-button"
              type="button"
              disabled={props.recalculating}
              onClick={() => void props.onRecalculate()}
            >
              {props.recalculating ? 'Recalculando…' : 'Recalcular'}
            </button>
          ) : null}
        </div>
      </header>

      <section className={styles.state} aria-label="Estado del modelo">
        <article>
          <small>Versión del algoritmo</small>
          <strong>{props.ranking?.state.algorithmVersion ?? '1.0.0'}</strong>
        </article>
        <article>
          <small>Último cálculo</small>
          <strong>{dateLabel(props.ranking?.state.lastCalculatedAt)}</strong>
        </article>
        <article>
          <small>Estado de datos</small>
          <strong>{props.ranking?.state.dirty ? 'Actualización pendiente' : 'Actualizado'}</strong>
        </article>
      </section>

      <div className={styles.workspace}>
        {props.notice ? (
          <p className={styles.notice} role="status">
            {props.notice}
          </p>
        ) : null}
        {props.message ? (
          <p className={styles.error} role="alert">
            {props.message}
          </p>
        ) : null}

        <section className={styles.panel} aria-labelledby="customer-ranking-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="customer-ranking-title">Ranking de clientes</h2>
              <p>
                Score 50 % pedidos + 50 % valor pagado, ambos normalizados por posición relativa.
              </p>
            </div>
            <span>{props.ranking?.pagination.totalItems ?? 0} clientes</span>
          </div>
          <CustomerIntelligenceFilters
            value={props.filters}
            onChange={props.onFiltersChange}
            onSubmit={props.onSearch}
          />
          {props.loading ? (
            <p className={styles.loading} role="status">
              Consultando inteligencia comercial…
            </p>
          ) : (
            <CustomerRanking
              items={props.ranking?.items ?? []}
              onSelect={props.onOpenDetail}
            />
          )}
        </section>

        {props.pareto ? <ParetoChart data={props.pareto} /> : null}

        {props.detail ? (
          <CustomerIntelligenceDetailPanel
            detail={props.detail}
            onClose={props.onCloseDetail}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
