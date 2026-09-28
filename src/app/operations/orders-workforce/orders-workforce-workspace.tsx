'use client';

import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { OrderWorkforceHealth } from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from './orders-workforce-page.module.css';

interface Props {
  context: SessionContext;
  health: OrderWorkforceHealth;
  repairing: boolean;
  message: string | null;
  notice: string | null;
  canRepair: boolean;
  onReconcile(repair: boolean): Promise<void>;
  onSignOut(): Promise<void>;
}

function navigation(): AppShellNavigationItem[] {
  return [
    { href: '/orders', label: 'Pedidos' },
    { href: '/operations/orders-workforce', label: 'Integración operativa', current: true },
  ];
}

function StatusMessages({ notice, message }: Pick<Props, 'notice' | 'message'>) {
  return (
    <>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {message ? <p className={styles.error} role="alert">{message}</p> : null}
    </>
  );
}

function IntegrationMetrics({ health }: { health: OrderWorkforceHealth }) {
  const metrics = [
    ['Pendientes', health.summary.pending],
    ['Procesando', health.summary.processing],
    ['Procesados', health.summary.processed],
    ['Fallidos', health.summary.failed],
    ['Locks obsoletos', health.summary.staleProcessing],
  ] as const;

  return (
    <section className={styles.metrics} aria-label="Estado de integración">
      {metrics.map(([label, value]) => (
        <article key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function PendingSteps({ health }: { health: OrderWorkforceHealth }) {
  const pendingSteps = Object.entries(health.pendingByStep).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const oldest = health.oldestPendingAt
    ? new Date(health.oldestPendingAt).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'Sin pendientes';

  return (
    <section className={styles.panel} aria-labelledby="pending-step-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="pending-step-title">Pendientes por etapa</h2>
          <p>Una sola lectura agregada; no existe polling por pedido o por persona.</p>
        </div>
        <span>Más antiguo: {oldest}</span>
      </div>
      {pendingSteps.length ? (
        <ul className={styles.stepList} aria-label="Pendientes por etapa operativa">
          {pendingSteps.map(([step, total]) => (
            <li key={step}>
              <span>{step.replaceAll('_', ' ')}</span>
              <strong>{total}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No hay eventos pendientes o fallidos.</p>
      )}
    </section>
  );
}

export function OrdersWorkforceWorkspace(props: Props) {
  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigation()}
      onSignOut={props.onSignOut}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Integración operativa</p>
          <h1>Orders ↔ Workforce</h1>
          <p>
            Estado durable de la sincronización. La ocupación humana pertenece a Workforce y no se
            infiere desde Orders.
          </p>
        </div>
        {props.canRepair ? (
          <div className={styles.actions}>
            <button className="secondary-button" type="button" disabled={props.repairing} onClick={() => void props.onReconcile(false)}>
              Revisar inconsistencias
            </button>
            <button className="primary-button" type="button" disabled={props.repairing} onClick={() => void props.onReconcile(true)}>
              {props.repairing ? 'Reconciliando…' : 'Reconciliar'}
            </button>
          </div>
        ) : null}
      </header>
      <StatusMessages notice={props.notice} message={props.message} />
      <IntegrationMetrics health={props.health} />
      <PendingSteps health={props.health} />
      <section className={styles.boundary} aria-labelledby="occupancy-boundary-title">
        <h2 id="occupancy-boundary-title">Límite de ocupación</h2>
        <p>
          Disponibilidad, inactividad, festivos y tiempo laboral se consumirán del contrato
          Workforce cuando ese dominio esté integrado en main.
        </p>
      </section>
    </AppShell>
  );
}
