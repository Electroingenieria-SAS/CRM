import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import styles from './order-detail.module.css';

interface OrderDetailProps {
  detail: OrderDetailResponse;
  onClose(): void;
}

export function OrderDetail({ detail, onClose }: OrderDetailProps) {
  const order = detail.order;

  return (
    <section className={styles.panel} aria-labelledby="order-detail-title">
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Pedido</p>
          <h2 id="order-detail-title">{order.order_number}</h2>
          <p>{order.client_name} · {order.client_city ?? 'Sin ciudad'}</p>
        </div>
        <button type="button" onClick={onClose}>Cerrar</button>
      </div>

      <dl className={styles.summary}>
        <div><dt>Estado</dt><dd>{order.status}</dd></div>
        <div><dt>Etapa</dt><dd>{order.current_step_code}</dd></div>
        <div><dt>Tipo</dt><dd>{order.order_type_code}</dd></div>
        <div><dt>Pago</dt><dd>{order.payment_condition_code}</dd></div>
        <div><dt>Entrega</dt><dd>{order.delivery_route_code}</dd></div>
        <div><dt>Prioridad</dt><dd>{order.priority}</dd></div>
      </dl>

      <section>
        <h3>Ítems</h3>
        <div className={styles.items}>
          {detail.items.map((item) => (
            <article key={item.id}>
              <strong>{item.description}</strong>
              <span>{item.quantity} {item.unit}</span>
              {item.requires_cut ? <small>Corte: {item.requested_cut_length ?? 'pendiente'}</small> : null}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3>Trazabilidad inicial</h3>
        <p>{detail.tasks.length} tarea(s) · {detail.events.length} evento(s).</p>
      </section>
    </section>
  );
}
