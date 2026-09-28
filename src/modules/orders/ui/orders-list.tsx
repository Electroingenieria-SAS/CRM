import type { OrderListItem } from '@/modules/orders/application/order.schemas';
import styles from './orders-list.module.css';

interface OrdersListProps {
  items: OrderListItem[];
  onSelect(orderId: string): void;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    QUEUED: 'En cola',
    ASSIGNED: 'Asignado',
    IN_PROGRESS: 'En proceso',
    WAITING: 'En espera',
    BLOCKED: 'Bloqueado',
    CLOSED: 'Cerrado',
    CANCELLED: 'Cancelado',
  };
  return labels[status] ?? status;
}

export function OrdersList({ items, onSelect }: OrdersListProps) {
  if (!items.length) {
    return (
      <section className={styles.empty} aria-live="polite">
        <strong>No se encontraron pedidos</strong>
        <span>Ajusta los filtros o crea un pedido nuevo.</span>
      </section>
    );
  }

  return (
    <div className={styles.list}>
      {items.map((order) => (
        <article className={styles.row} key={order.id}>
          <button className={styles.open} type="button" onClick={() => onSelect(order.id)}>
            <div className={styles.identity}>
              <span>{order.stepName}</span>
              <strong>{order.orderNumber}</strong>
              <small>
                {order.clientName} · {order.orderType} · {order.paymentCondition}
              </small>
            </div>
            <dl className={styles.metrics}>
              <div>
                <dt>Estado</dt>
                <dd>{statusLabel(order.status)}</dd>
              </div>
              <div>
                <dt>Responsable</dt>
                <dd>{order.assigneeName ?? 'En cola'}</dd>
              </div>
              <div>
                <dt>Vendedor</dt>
                <dd>{order.sellerName ?? '—'}</dd>
              </div>
              <div>
                <dt>Ruta</dt>
                <dd>{order.route}</dd>
              </div>
            </dl>
            <span className={styles.priority} data-priority={order.priority}>
              {order.priority === 'MEDIUM' ? 'Prioridad automática' : order.priority}
            </span>
          </button>
        </article>
      ))}
    </div>
  );
}
