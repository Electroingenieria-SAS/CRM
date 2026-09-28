'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type {
  FreightHistoryResponse,
  FreightMetrics,
} from '@/modules/freight/application/freight-history.schemas';
import type {
  FreightPredictionInput,
  FreightPredictionResult,
} from '@/modules/freight/application/freight-prediction.schemas';
import type { FreightHistoryQuery } from '@/modules/freight/application/freight-repository';
import { FreightHistory } from '@/modules/freight/ui/freight-history';
import { FreightQuoteForm } from '@/modules/freight/ui/freight-quote-form';
import { FreightResults } from '@/modules/freight/ui/freight-results';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from '@/modules/freight/ui/freight-ui.module.css';

interface FreightWorkspaceViewProps {
  context: SessionContext;
  catalog: FreightCatalog;
  history: FreightHistoryResponse;
  metrics: FreightMetrics;
  historyFilters: FreightHistoryQuery;
  results: readonly FreightPredictionResult[];
  loading: boolean;
  predicting: boolean;
  message: string | null;
  onHistoryFiltersChange(filters: FreightHistoryQuery): void;
  onSearchHistory(): void;
  onPageHistory(page: number): void;
  onPredict(input: FreightPredictionInput): Promise<void>;
  onSignOut(): Promise<void>;
}

function navigationFor(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) {
    items.push({ href: '/orders', label: 'Pedidos' });
  }
  items.push({ href: '/freight', label: 'Fletes', current: true });
  return items;
}

export function FreightWorkspaceView(props: FreightWorkspaceViewProps) {
  const canPredict = hasModuleCapability(props.context, 'freight', 'create');
  const coverage = props.catalog.coverage;

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigationFor(props.context)}
      onSignOut={props.onSignOut}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Logística basada en evidencia</p>
          <h1>Freight Intelligence</h1>
          <p>
            Estima costos con histórico real, fallback transparente y aprendizaje por costos
            finales.
          </p>
        </div>
        <span className={styles.badge}>{props.catalog.algorithmVersion}</span>
      </header>

      <section className={styles.coverage} aria-label="Cobertura histórica">
        <div className={styles.metric}>
          <strong>{coverage.historicalSamples}</strong>
          <span>despachos históricos</span>
        </div>
        <div className={styles.metric}>
          <strong>{coverage.cities}</strong>
          <span>destinos normalizados</span>
        </div>
        <div className={styles.metric}>
          <strong>{coverage.carriers}</strong>
          <span>transportadoras</span>
        </div>
        <div className={styles.metric}>
          <strong>{props.metrics.summary.evaluatedPredictions}</strong>
          <span>predicciones evaluadas</span>
        </div>
      </section>

      {props.message ? (
        <p className={styles.status} role="alert">
          {props.message}
        </p>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="freight-estimate-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="freight-estimate-title">Solicitar estimación</h2>
              <p>Las variables opcionales solo influyen cuando el histórico las respalda.</p>
            </div>
          </div>
          {canPredict ? (
            <FreightQuoteForm
              carriers={props.catalog.carriers}
              destinations={props.catalog.destinations}
              disabled={props.predicting}
              onPredict={props.onPredict}
            />
          ) : (
            <div className={styles.empty}>Tu perfil tiene acceso de lectura, no de predicción.</div>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="freight-result-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="freight-result-title">Resultado explicable</h2>
              <p>Estimación central, rango, evidencia, muestras y fallback utilizado.</p>
            </div>
          </div>
          {props.predicting ? (
            <p className={styles.status} role="status">
              Calculando con el histórico disponible…
            </p>
          ) : (
            <FreightResults results={props.results} />
          )}
        </section>
      </div>

      {props.loading ? (
        <p className={styles.status} role="status">
          Consultando histórico…
        </p>
      ) : (
        <FreightHistory
          history={props.history}
          carriers={props.catalog.carriers}
          destinations={props.catalog.destinations}
          filters={props.historyFilters}
          onFiltersChange={props.onHistoryFiltersChange}
          onSearch={props.onSearchHistory}
          onPage={props.onPageHistory}
        />
      )}
    </AppShell>
  );
}
