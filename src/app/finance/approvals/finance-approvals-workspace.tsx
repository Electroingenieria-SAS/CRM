'use client';

import { useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FinancialApprovalQueue } from '@/modules/finance/application/finance.schemas';
import type { QueueQuery } from '@/modules/finance/ports/finance-repository';
import { financeNavigation } from '@/modules/finance/ui/finance-navigation';
import { AppShell } from '@/shared/ui/app-shell';
import styles from '@/modules/finance/ui/finance-ui.module.css';

interface ApprovalsWorkspaceProps {
  context: SessionContext;
  queue: FinancialApprovalQueue;
  query: QueueQuery;
  busy: boolean;
  message: string | null;
  notice: string | null;
  onQuery(query: QueueQuery): void;
  onSearch(query: QueueQuery): void;
  onDecide(id: string, decision: 'APPROVED' | 'REJECTED', reason: string): Promise<void>;
  onSignOut(): Promise<void>;
}

export function FinanceApprovalsWorkspace(props: ApprovalsWorkspaceProps) {
  const canApprove = hasModuleCapability(props.context, 'approvals', 'approve');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={financeNavigation(props.context, 'approvals')}
      onSignOut={props.onSignOut}
    >
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Finanzas</p>
            <h1>Aprobaciones financieras</h1>
            <p>Excepciones con separación entre quien solicita y quien decide.</p>
          </div>
        </header>
        {props.message ? (
          <p className={styles.error} role="alert">
            {props.message}
          </p>
        ) : null}
        {props.notice ? (
          <p className={styles.notice} role="status">
            {props.notice}
          </p>
        ) : null}

        <section className={styles.section}>
          <div className={styles.toolbar}>
            <input
              aria-label="Buscar aprobación"
              value={props.query.search ?? ''}
              onChange={(event) => props.onQuery({ ...props.query, search: event.target.value })}
              placeholder="Pedido, cliente, tipo o solicitante"
            />
            <select
              aria-label="Estado de aprobación"
              value={props.query.status ?? ''}
              onChange={(event) =>
                props.onQuery({ ...props.query, status: event.target.value || undefined })
              }
            >
              <option value="">Todas</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
            </select>
            <button type="button" onClick={() => props.onSearch(props.query)}>
              Buscar
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Tipo</th>
                  <th>Solicitante</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Decisión</th>
                </tr>
              </thead>
              <tbody>
                {props.queue.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.orderNumber}
                      <br />
                      <span className={styles.muted}>{item.customerName}</span>
                    </td>
                    <td>{item.requestType}</td>
                    <td>{item.requestedBy}</td>
                    <td>{item.reason}</td>
                    <td>
                      <span className={styles.badge}>{item.status}</span>
                    </td>
                    <td>
                      {canApprove && item.status === 'PENDING' ? (
                        <div className={styles.field}>
                          <label htmlFor={'approval-reason-' + item.id}>Justificación</label>
                          <input
                            id={'approval-reason-' + item.id}
                            value={reasons[item.id] ?? ''}
                            onChange={(event) =>
                              setReasons((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                          />
                          <div className={styles.actions}>
                            <button
                              type="button"
                              disabled={!reasons[item.id]?.trim()}
                              onClick={() =>
                                void props.onDecide(item.id, 'APPROVED', reasons[item.id] ?? '')
                              }
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              disabled={!reasons[item.id]?.trim()}
                              onClick={() =>
                                void props.onDecide(item.id, 'REJECTED', reasons[item.id] ?? '')
                              }
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      ) : (
                        'Solo consulta'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {props.busy ? <p aria-live="polite">Actualizando aprobaciones…</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
