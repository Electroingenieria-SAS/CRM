'use client';

import type { AnalyticsDashboard } from '@/modules/analytics/application/analytics.schemas';
import styles from './analytics.module.css';

function numeric(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === 'number' ? value : null;
}

export function DashboardKpis({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const items = [
    ['Pedidos', dashboard.summary.ordersTotal],
    ['Activos', dashboard.summary.ordersActive],
    ['Cerrados', dashboard.summary.ordersClosed],
    ['Bloqueados', dashboard.summary.ordersBlocked],
    ['Pendientes financieros', dashboard.summary.financialPending],
    ['Entregas pendientes', dashboard.summary.deliveriesPending],
  ] as const;

  return (
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
        {items.map(([label, value]) => (
          <article className={styles.kpi} key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OrdersByStepPanel({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const maxQueue = Math.max(1, ...dashboard.ordersByStep.map((step) => step.count));
  return (
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
  );
}

export function DashboardAlerts({ dashboard }: { dashboard: AnalyticsDashboard }) {
  return (
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
            <article className={styles.alert} data-severity={alert.severity} key={alert.orderId}>
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
  );
}

export function WorkforcePanel({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const workforce = dashboard.workforce;
  return (
    <section className={styles.panel} aria-labelledby="workforce-title">
      <h2 id="workforce-title">Operación y Workforce</h2>
      {dashboard.sources.workforce && workforce ? (
        <div className={styles.metricGrid}>
          {[
            ['Personas ocupadas', numeric(workforce, 'occupiedPeople')],
            ['Personas disponibles', numeric(workforce, 'availablePeople')],
            ['Actividades activas', numeric(workforce, 'activeActivities')],
            ['Actividades bloqueadas', numeric(workforce, 'blockedActivities')],
          ].map(([label, value]) => (
            <article className={styles.metric} key={String(label)}>
              <small>{label}</small>
              <strong>{value ?? 0}</strong>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>Workforce no está disponible para este perfil.</p>
      )}
    </section>
  );
}

export function DashboardSources({ dashboard }: { dashboard: AnalyticsDashboard }) {
  const inventory = dashboard.inventory;
  return (
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
  );
}
