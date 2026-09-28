'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CreditQueue,
  FinanceCustomerSearch,
  CreditRequestInput,
} from '@/modules/finance/application/finance.schemas';
import type { QueueQuery } from '@/modules/finance/ports/finance-repository';
import { CreditQueueTable } from '@/modules/finance/ui/credit-queue';
import { CreditRequestForm } from '@/modules/finance/ui/credit-request-form';
import { financeNavigation } from '@/modules/finance/ui/finance-navigation';
import { AppShell } from '@/shared/ui/app-shell';
import styles from '@/modules/finance/ui/finance-ui.module.css';

interface CreditWorkspaceProps {
  context: SessionContext;
  queue: CreditQueue;
  customers: FinanceCustomerSearch['items'];
  query: QueueQuery;
  busy: boolean;
  message: string | null;
  notice: string | null;
  onQuery(query: QueueQuery): void;
  onSearch(query: QueueQuery): void;
  onCustomerSearch(search: string): Promise<void>;
  onCreate(input: CreditRequestInput): Promise<void>;
  onTake(id: string): Promise<void>;
  onDecide(id: string, decision: 'APPROVED' | 'REJECTED', reason: string): Promise<void>;
  onSignOut(): Promise<void>;
}

export function CreditWorkspace(props: CreditWorkspaceProps) {
  const canCreate = hasModuleCapability(props.context, 'credit', 'create');
  const canTake = hasModuleCapability(props.context, 'credit', 'update');
  const canDecide = hasModuleCapability(props.context, 'credit', 'approve');

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={financeNavigation(props.context, 'credit')}
      onSignOut={props.onSignOut}
    >
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Finanzas</p>
            <h1>Crédito</h1>
            <p>Solicitudes de valor y plazo con decisión trazable de Cartera.</p>
          </div>
        </header>

        {props.message ? <p className={styles.error} role="alert">{props.message}</p> : null}
        {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}

        {canCreate ? (
          <CreditRequestForm
            customers={props.customers}
            searching={props.busy}
            onSearch={props.onCustomerSearch}
            onSubmit={props.onCreate}
          />
        ) : null}

        <section className={styles.section} aria-labelledby="credit-queue-title">
          <div className={styles.queueHeader}>
            <div>
              <h2 id="credit-queue-title">Cola de crédito</h2>
              <p>{props.queue.pagination.totalItems} solicitud(es) visibles según tus permisos.</p>
            </div>
          </div>
          <div className={styles.toolbar}>
            <input
              aria-label="Buscar crédito"
              value={props.query.search ?? ''}
              onChange={(event) => props.onQuery({ ...props.query, search: event.target.value })}
              placeholder="Solicitud, cliente o documento"
            />
            <select
              aria-label="Estado de crédito"
              value={props.query.status ?? ''}
              onChange={(event) =>
                props.onQuery({ ...props.query, status: event.target.value || undefined })
              }
            >
              <option value="">Todos</option>
              <option value="SUBMITTED">Radicadas</option>
              <option value="UNDER_REVIEW">En estudio</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
            </select>
            <button type="button" onClick={() => props.onSearch(props.query)}>Buscar</button>
          </div>
          <CreditQueueTable
            queue={props.queue}
            canTake={canTake}
            canDecide={canDecide}
            onTake={props.onTake}
            onDecide={props.onDecide}
          />
        </section>
      </div>
    </AppShell>
  );
}
