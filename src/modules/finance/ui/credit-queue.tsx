'use client';

import { useState } from 'react';
import type { CreditQueue } from '@/modules/finance/application/finance.schemas';
import styles from './finance-ui.module.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

interface CreditQueueProps {
  queue: CreditQueue;
  canTake: boolean;
  canDecide: boolean;
  onTake(id: string): Promise<void>;
  onDecide(id: string, decision: 'APPROVED' | 'REJECTED', reason: string): Promise<void>;
}

export function CreditQueueTable(props: CreditQueueProps) {
  const [reason, setReason] = useState<Record<string, string>>({});

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Solicitud</th>
            <th>Cliente</th>
            <th>Valor</th>
            <th>Plazo</th>
            <th>Estado</th>
            <th>Responsable</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {props.queue.items.map((item) => (
            <tr key={item.id}>
              <td>{item.requestNumber}</td>
              <td>
                {item.customerName}
                <br />
                <span className={styles.muted}>{item.customerDocument ?? 'Sin documento'}</span>
              </td>
              <td className={styles.money}>{money.format(item.requestedAmount)}</td>
              <td>{item.requestedTermDays} días</td>
              <td>
                <span className={styles.badge}>{item.status}</span>
              </td>
              <td>{item.assignedTo ?? item.requestedBy}</td>
              <td>
                {props.canTake && item.status === 'SUBMITTED' ? (
                  <button type="button" onClick={() => void props.onTake(item.id)}>
                    Tomar
                  </button>
                ) : null}
                {props.canDecide && ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status) ? (
                  <div className={styles.field}>
                    <label htmlFor={'decision-' + item.id}>Justificación</label>
                    <input
                      id={'decision-' + item.id}
                      value={reason[item.id] ?? ''}
                      onChange={(event) =>
                        setReason((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
                    <div className={styles.actions}>
                      <button
                        type="button"
                        disabled={!reason[item.id]?.trim()}
                        onClick={() =>
                          void props.onDecide(item.id, 'APPROVED', reason[item.id] ?? '')
                        }
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={!reason[item.id]?.trim()}
                        onClick={() =>
                          void props.onDecide(item.id, 'REJECTED', reason[item.id] ?? '')
                        }
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
