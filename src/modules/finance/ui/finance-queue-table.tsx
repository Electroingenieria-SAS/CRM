'use client';

import type { FinanceQueue, FinanceQueueItem } from '@/modules/finance/application/finance.schemas';
import styles from './finance-ui.module.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

interface FinanceQueueTableProps {
  queue: FinanceQueue;
  selectedId?: string;
  onSelect(item: FinanceQueueItem): void;
}

export function FinanceQueueTable(props: FinanceQueueTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Pedido</th><th>Cliente</th><th>Condición</th><th>Pagado</th>
            <th>Estado financiero</th><th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {props.queue.items.map((item) => (
            <tr key={item.orderId}>
              <td>{item.orderNumber}<br /><span className={styles.muted}>{item.orderType}</span></td>
              <td>{item.customerName}<br /><span className={styles.muted}>{item.customerDocument ?? 'Sin documento'}</span></td>
              <td>{item.paymentCondition}</td>
              <td className={styles.money}>{money.format(item.paidAmount)}</td>
              <td>
                <span className={styles.badge}>
                  {item.activeHold ? 'RETENIDO' : item.latestValidation?.result ?? 'PENDIENTE'}
                </span>
                {item.activeHold ? <p>{item.activeHold.reason}</p> : null}
              </td>
              <td>
                <button
                  type="button"
                  aria-pressed={props.selectedId === item.orderId}
                  onClick={() => props.onSelect(item)}
                >
                  Revisar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
