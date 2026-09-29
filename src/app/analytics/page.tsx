'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AnalyticsDashboard,
  AnalyticsFilters,
} from '@/modules/analytics/application/analytics.schemas';
import { AnalyticsFiltersBar, catalogSteps } from './analytics-controls';
import { AnalyticsShell } from './analytics-shell';
import styles from './analytics.module.css';
import { useAnalyticsSession } from './use-analytics-session';

function numeric(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === 'number' ? value : null;
}

export default function AnalyticsDashboardPage() {
  const session = useAnalyticsSession();
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextFilters: AnalyticsFilters) => {
      if (!session.application) return;
      setLoading(true);
      session.setMessage(null);
      try {
        setDashboard(await session.application.analytics.dashboard(nextFilters));
      } catch (error) {
        session.setMessage(error instanceof Error ? error.message : 'No fue posible cargar el panel.');
      } finally {
        setLoading(false);
      }
    },
    [session.application, session.setMessage],
  );

  useEffect(() => {
    if (!session.context || !session.application) return;
    if (!hasModuleCapability(session.context, 'dashboard', 'read')) {
      session.setMessage('Tu perfil no tiene acceso al centro de operación.');
      return;
    }
    void load({});
  }, [load, session.application, session.context, session.setMessage]);

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Analítica operacional</p>
          <h1>{session.loading ? 'Cargando panel…' : 'No fue posible abrir el panel'}</h1>
          {session.message ? <p role="alert">{session.message}</p> : null}
        </section>
      </main>
    );
  }

  const steps = catalogSteps(session.context.catalogs.steps);
  const maxQueue = Math.max(1, ...(dashboard?.ordersByStep.map((step) => step.count) ?? [1]));
  const workforce = dashboard?.workforce ?? null;
  const inventory = dashboard?.inventory ?? null;

  return (
    <AnalyticsShell context={session.context} current="dashboard" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Centro de operación</p>
          <h1>Qué está pasando ahora</h1>
          <p>Volumen, colas, bloqueos y señales accionables desde read models agregados.</p>
        </div>
      </header>

      <AnalyticsFiltersBar
        value={filters}
        steps={steps}
        onChange={setFilters}
        onSubmit={() => void load(filters)}
      />

      {session.message ? (
        <p className={styles.message} role="alert">
          {session.message}
        </p>
      ) : null}
      {loading ? <p role="status">Actualizando indicadores…</p> : null}

      {dashboard ? (
        <>
          <section aria-labelledby="executive-kpis">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="executive-kpis">Resumen ejecutivo</h2>
                <p>
                  {dashboard.range.from} a {dashboard.range.to} · {dashboard.range.timezone}
                </p>
              </div>
            </div>
            <div className={styles.kpis}>
              {[
                ['Pedidos', dashboard.summary.ordersTotal],
                ['Activos', dashboard.summary.ordersActive],
                ['Cerrados', dashboard.summary.ordersClosed],
                ['Bloqueados', dashboard.summary.ordersBlocked],
                ['Pendientes financieros', dashboard.summary.financialPending],
                ['Entregas pendientes', dashboard.summary.deliveriesPending],
              ].map(([label, value]) => (
                <article className={styles.kpi} key={String(label)}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
          </section>

          <div className={styles.grid}>
            <section className={styles.panel} aria-labelledby="queue-title">
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="queue-title">Pedidos por etapa</h2>
                  <p>¿Dónde se está acumulando la operación?</p>
                </div>
              </div>
              <div className={styles.queue} aria-label="Distribución de pedidos por etapa">
                {dashboard.ordersByStep.length ? (
                  dashboard.ordersByStep.map((step) => (
                    <article className={styles.queueItem} key={step.code}>
                      <div className={styles.queueHeader}>
                        <strong>{step.name}</strong>
                        <span>{step.count} pedidos</span>
                      </div>
                      <div
                        className={styles.barTrack}
                        role="img"
                        aria-label={step.name + ': ' + step.count + ' pedidos'}
                      >
                        <div
                          className={styles.bar}
                          style={{ width: Math.max(2, (step.count / maxQueue) * 100) + '%' }}
                        />
                      </div>
                      <div className={styles.alertMeta}>
                        <span>{step.blocked} bloqueados</span>
                        <span>{step.overdue} fuera de SLA</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className={styles.muted}>No hay pedidos activos en el alcance.</p>
                )}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="alerts-title">
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="alerts-title">Requieren atención</h2>
                  <p>Solo bloqueos y demoras sustentadas por SLA.</p>
                </div>
              </div>
              <div className={styles.alerts}>
                {dashboard.alerts.length ? (
                  dashboard.alerts.map((alert) => (
                    <article
                      className={styles.alert}
                      data-severity={alert.severity}
                      key={alert.orderId}
                    >
                      <div className={styles.rowHeader}>
                        <strong>{alert.orderNumber}</strong>
                        <span>{alert.stepName}</span>
                      </div>
                      <span>{alert.clientName}</span>
                      <div className={styles.alertMeta}>
                        <span>{alert.alertType === 'BLOCKED' ? 'Bloqueado' : 'Fuera de SLA'}</span>
                        <span>{Math.round(alert.ageMinutes)} min desde actualización</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className={styles.muted}>No hay alertas accionables en el alcance.</p>
                )}
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="workforce-title">
              <h2 id="workforce-title">Operación y Workforce</h2>
              {dashboard.sources.workforce && workforce ? (
                <div className={styles.metricGrid}>
                  <article className={styles.metric}>
                    <small>Personas ocupadas</small>
                    <strong>{numeric(workforce, 'occupiedPeople') ?? 0}</strong>
                  </article>
                  <article className={styles.metric}>
                    <small>Personas disponibles</small>
                    <strong>{numeric(workforce, 'availablePeople') ?? 0}</strong>
                  </article>
                  <article className={styles.metric}>
                    <small>Actividades activas</small>
                    <strong>{numeric(workforce, 'activeActivities') ?? 0}</strong>
                  </article>
                  <article className={styles.metric}>
                    <small>Actividades bloqueadas</small>
                    <strong>{numeric(workforce, 'blockedActivities') ?? 0}</strong>
                  </article>
                </div>
              ) : (
                <p className={styles.muted}>Workforce no está disponible para este perfil.</p>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="sources-title">
              <h2 id="sources-title">Fuentes reutilizadas</h2>
              <div className={styles.sourceList}>
                {Object.entries(dashboard.sources).map(([source, active]) => (
                  <span data-active={String(active)} key={source}>
                    {source}: {active ? 'disponible' : 'no disponible'}
                  </span>
                ))}
              </div>
              {dashboard.sources.inventory && inventory ? (
                <div className={styles.metricGrid}>
                  <article className={styles.metric}>
                    <small>Disponible inventario</small>
                    <strong>{numeric(inventory, 'available') ?? 0}</strong>
                  </article>
                  <article className={styles.metric}>
                    <small>Saldos totalmente asignados</small>
                    <strong>{numeric(inventory, 'fullyAllocatedBalances') ?? 0}</strong>
                  </article>
                </div>
              ) : null}
              <p className={styles.muted}>
                No se etiqueta “inventario crítico” hasta disponer de umbrales confiables.
              </p>
            </section>
          </div>
        </>
      ) : null}
    </AnalyticsShell>
  );
}
