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

function oldestPendingLabel(value: string | null) {
  if (!value) return 'Sin pendientes';
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function OrdersWorkforceWorkspace(props: Props) {
  const status = props.health.summary;
  const pendingSteps = Object.entries(props.health.pendingByStep).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

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
            Estado durable de la sincronización. La ocupación humana se mantiene como
            responsabilidad de Workforce y no se infiere desde Orders.
          </p>
        </div>
        {props.canRepair ? (
          <div className={styles.actions}>
            <button
              className="secondary-button"
              type="button"
              disabled={props.repairing}
              onClick={() => void props.onReconcile(false)}
            >
              Revisar inconsistencias
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={props.repairing}
              onClick={() => void props.onReconcile(true)}
            >
              {props.repairing ? 'Reconciliando…' : 'Reconciliar'}
            </button>
          </div>
        ) : null}
      </header>

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

      <section className={styles.metrics} aria-label="Estado de integración">
        <article><small>Pendientes</small><strong>{status.pending}</strong></article>
        <article><small>Procesando</small><strong>{status.processing}</strong></article>
        <article><small>Procesados</small><strong>{status.processed}</strong></article>
        <article><small>Fallidos</small><strong>{status.failed}</strong></article>
        <article><small>Locks obsoletos</small><strong>{status.staleProcessing}</strong></article>
      </section>

      <section className={styles.panel} aria-labelledby="pending-step-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="pending-step-title">Pendientes por etapa</h2>
            <p>Una sola lectura agregada; no existe polling por pedido o por persona.</p>
          </div>
          <span>Más antiguo: {oldestPendingLabel(props.health.oldestPendingAt)}</span>
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

      <section className={styles.boundary} aria-labelledby="occupancy-boundary-title">
        <h2 id="occupancy-boundary-title">Límite de ocupación</h2>
        <p>
          Este panel no etiqueta personas como ocupadas usando estados de pedidos. La ocupación,
          disponibilidad, inactividad, festivos y tiempo laboral se consumirán del contrato
          Workforce cuando ese dominio esté integrado en main.
        </p>
      </section>
    </AppShell>
  );
}
