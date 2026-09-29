'use client';

import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { OrdersWorkforceIndicatorSnapshot } from '@/modules/integrations/orders-workforce/application/orders-workforce-indicators';
import type { OrderWorkforceHealth } from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import { OrdersWorkforceIndicators } from './orders-workforce-indicators';
import styles from './orders-workforce-page.module.css';

interface Props {
  context: SessionContext;
  health: OrderWorkforceHealth;
  indicators: OrdersWorkforceIndicatorSnapshot;
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
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
    </>
  );
}

function IntegrationHealth({ health }: { health: OrderWorkforceHealth }) {
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
            Ocupación, jornada, bloqueos y tiempos provienen de Workforce; Orders conserva el
            workflow y el vendedor del pedido.
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
      <StatusMessages notice={props.notice} message={props.message} />
      <IntegrationHealth health={props.health} />
      <OrdersWorkforceIndicators snapshot={props.indicators} />
    </AppShell>
  );
}
