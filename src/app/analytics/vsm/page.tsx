'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AnalyticsFilters,
  AnalyticsOrderVsm,
  AnalyticsVsmSummary,
} from '@/modules/analytics/application/analytics.schemas';
import { AnalyticsFiltersBar, catalogSteps } from '../analytics-controls';
import { AnalyticsShell } from '../analytics-shell';
import styles from '../analytics.module.css';
import { useAnalyticsSession } from '../use-analytics-session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AnalyticsVsmPage() {
  const session = useAnalyticsSession();
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [summary, setSummary] = useState<AnalyticsVsmSummary | null>(null);
  const [detail, setDetail] = useState<AnalyticsOrderVsm | null>(null);
  const [lookup, setLookup] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(
    async (next: AnalyticsFilters) => {
      if (!session.application) return;
      setLoading(true);
      session.setMessage(null);
      try {
        setSummary(await session.application.analytics.vsmSummary(next));
      } catch (error) {
        session.setMessage(error instanceof Error ? error.message : 'No fue posible cargar el VSM.');
      } finally {
        setLoading(false);
      }
    },
    [session.application, session.setMessage],
  );

  useEffect(() => {
    if (!session.context || !session.application) return;
    if (!hasModuleCapability(session.context, 'vsm', 'read')) {
      session.setMessage('Tu perfil no tiene acceso a VSM y tiempos.');
      return;
    }
    void loadSummary({});
  }, [loadSummary, session.application, session.context, session.setMessage]);

  async function openOrder() {
    if (!session.application || !lookup.trim()) return;
    session.setMessage(null);
    setLoading(true);
    try {
      const value = lookup.trim();
      setDetail(
        await session.application.analytics.orderVsm(
          uuidPattern.test(value) ? value : undefined,
          uuidPattern.test(value) ? undefined : value,
        ),
      );
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'No fue posible consultar el pedido.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Value Stream Mapping</p>
          <h1>{session.loading ? 'Cargando VSM…' : 'No fue posible abrir VSM'}</h1>
          {session.message ? <p role="alert">{session.message}</p> : null}
        </section>
      </main>
    );
  }

  const steps = catalogSteps(session.context.catalogs.steps);
  const maxWaiting = Math.max(
    1,
    ...(summary?.stages.map((stage) => stage.averageWaitingMinutes ?? 0) ?? [1]),
  );

  return (
    <AnalyticsShell context={session.context} current="vsm" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Value Stream Mapping</p>
          <h1>Tiempos y cuellos de botella</h1>
          <p>Espera, proceso, bloqueo y tránsito se mantienen como conceptos distintos.</p>
        </div>
      </header>

      <AnalyticsFiltersBar
        value={filters}
        steps={steps}
        includeSource
        onChange={setFilters}
        onSubmit={() => void loadSummary(filters)}
      />

      {session.message ? (
        <p className={styles.message} role="alert">
          {session.message}
        </p>
      ) : null}
      {loading ? <p role="status">Actualizando VSM…</p> : null}

      {summary ? (
        <>
          <section className={styles.kpis} aria-label="Resumen VSM">
            <article className={styles.kpi}>
              <small>Pedidos analizados</small>
              <strong>{summary.overall.orders}</strong>
            </article>
            <article className={styles.kpi}>
              <small>Mediana ciclo etapas</small>
              <strong>{summary.overall.medianStageCycleMinutes} min</strong>
            </article>
            <article className={styles.kpi}>
              <small>P90 ciclo etapas</small>
              <strong>{summary.overall.p90StageCycleMinutes} min</strong>
            </article>
            <article className={styles.kpi}>
              <small>Espera promedio</small>
              <strong>{summary.overall.averageWaitingMinutes} min</strong>
            </article>
            <article className={styles.kpi}>
              <small>Proceso promedio</small>
              <strong>{summary.overall.averageProcessingMinutes} min</strong>
            </article>
            <article className={styles.kpi}>
              <small>Bloqueo promedio</small>
              <strong>{summary.overall.averageBlockedMinutes} min</strong>
            </article>
          </section>

          <div className={styles.grid}>
            <section className={styles.panel} aria-labelledby="stage-times-title">
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="stage-times-title">Espera por etapa</h2>
                  <p>¿Qué etapas concentran mayor espera?</p>
                </div>
              </div>
              <div className={styles.stageList}>
                {summary.stages.map((stage) => (
                  <article className={styles.stage} key={stage.stepCode}>
                    <div className={styles.stageHeader}>
                      <strong>{stage.stepName}</strong>
                      <span>{stage.averageWaitingMinutes ?? 0} min espera</span>
                    </div>
                    <div
                      className={styles.barTrack}
                      role="img"
                      aria-label={
                        stage.stepName +
                        ': espera promedio ' +
                        (stage.averageWaitingMinutes ?? 0) +
                        ' minutos'
                      }
                    >
                      <div
                        className={styles.bar}
                        style={{
                          width:
                            Math.max(
                              2,
                              ((stage.averageWaitingMinutes ?? 0) / maxWaiting) * 100,
                            ) + '%',
                        }}
                      />
                    </div>
                    <div className={styles.stageMeta}>
                      <span>mediana {stage.medianMinutes ?? 0} min</span>
                      <span>P90 {stage.p90Minutes ?? 0} min</span>
                      <span>proceso {stage.averageProcessingMinutes ?? 0} min</span>
                      <span>bloqueo {stage.averageBlockedMinutes ?? 0} min</span>
                      <span>cola {stage.currentQueue ?? 0}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="bottlenecks-title">
              <h2 id="bottlenecks-title">Evidencia de cuellos de botella</h2>
              <p>No atribuye responsabilidad a personas; muestra evidencia objetiva por etapa.</p>
              {summary.bottlenecks.map((item) => (
                <article className={styles.bottleneck} key={item.stepCode}>
                  <strong>{item.stepName}</strong>
                  <span>
                    Espera {item.evidence.averageWaitingMinutes} min · P90{' '}
                    {item.evidence.p90Minutes} min
                  </span>
                  <span>
                    Cola {item.evidence.currentQueue} · Bloqueados {item.evidence.blockedOrders} ·{' '}
                    {item.evidence.samples} muestras
                  </span>
                </article>
              ))}
            </section>
          </div>
        </>
      ) : null}

      <section className={styles.panel} aria-labelledby="order-vsm-title">
        <h2 id="order-vsm-title">VSM por pedido</h2>
        <p>Consulta por UUID de pedido o por clave externa de un histórico importado.</p>
        <form
          className={styles.lookup}
          onSubmit={(event) => {
            event.preventDefault();
            void openOrder();
          }}
        >
          <label>
            Pedido o clave histórica
            <input
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              placeholder="UUID o externalOrderKey"
            />
          </label>
          <button type="submit" className="primary-button">
            Consultar
          </button>
        </form>

        {detail ? (
          <>
            <div className={styles.metricGrid}>
              <article className={styles.metric}>
                <small>Pedido</small>
                <strong>{detail.orderNumber}</strong>
              </article>
              <article className={styles.metric}>
                <small>Lead time laboral</small>
                <strong>{detail.leadTimeMinutes} min</strong>
              </article>
              <article className={styles.metric}>
                <small>Fuente</small>
                <strong>{detail.source}</strong>
              </article>
            </div>
            <div className={styles.timeline} aria-label={'VSM del pedido ' + detail.orderNumber}>
              {detail.stages.map((stage, index) => (
                <article className={styles.timelineItem} key={stage.stepCode + '-' + index}>
                  <div className={styles.rowHeader}>
                    <strong>{stage.stepName}</strong>
                    <span>{stage.status}</span>
                  </div>
                  <div className={styles.stageMeta}>
                    <span>espera {stage.waitingMinutes} min</span>
                    <span>proceso {stage.processingMinutes} min</span>
                    <span>bloqueo {stage.blockedMinutes} min</span>
                    {stage.transitMinutes !== null ? (
                      <span>tránsito {stage.transitMinutes} min</span>
                    ) : null}
                    <span>total {stage.totalMinutes} min</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </AnalyticsShell>
  );
}
