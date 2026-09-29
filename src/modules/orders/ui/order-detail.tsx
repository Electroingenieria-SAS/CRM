import type { FinancialGate } from '@/modules/finance/application/finance.schemas';
import { OrderFinancialGate } from '@/modules/finance/ui/order-financial-gate';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import { OrderWorkflowPanel } from '@/modules/orders/ui/order-workflow-panel';
import styles from './order-detail.module.css';

interface OrderDetailProps {
  detail: OrderDetailResponse;
  financialGate: FinancialGate | null;
  busy: boolean;
  onClose(): void;
  onSimpleAction(action: 'CLAIM' | 'START' | 'COMPLETE'): Promise<void>;
  onAssign(profileId: string): Promise<void>;
  onBlock(reasonCode: string, detail: string): Promise<void>;
  onResume(resolution: string): Promise<void>;
  onCreateIssue(input: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    blocking: boolean;
    title: string;
    description: string;
  }): Promise<void>;
  onAddEvidence(input: {
    evidenceType: string;
    storageReference: string;
    fileName?: string;
  }): Promise<void>;
  onCancel(reason: string): Promise<void>;
  onReopen(targetStep: string, reason: string): Promise<void>;
  onResolveIssue(issueId: string, resolution: string): Promise<void>;
}

function value(record: Record<string, unknown>, key: string) {
  const current = record[key];
  return typeof current === 'string' || typeof current === 'number' ? String(current) : '';
}

function eventLabel(event: Record<string, unknown>) {
  return value(event, 'event_type') || value(event, 'action_code') || 'Evento operativo';
}

export function OrderDetail(props: OrderDetailProps) {
  const order = props.detail.order;

  return (
    <section className={styles.panel} aria-labelledby="order-detail-title">
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Pedido</p>
          <h2 id="order-detail-title">{order.order_number}</h2>
          <p>
            {order.client_name} · {order.client_city ?? 'Sin ciudad'}
          </p>
        </div>
        <button type="button" onClick={props.onClose}>
          Cerrar
        </button>
      </div>

      <dl className={styles.summary}>
        <div>
          <dt>Estado</dt>
          <dd>{order.status}</dd>
        </div>
        <div>
          <dt>Etapa</dt>
          <dd>{order.current_step_code}</dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>{order.order_type_code}</dd>
        </div>
        <div>
          <dt>Pago</dt>
          <dd>{order.payment_condition_code}</dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>{order.delivery_route_code}</dd>
        </div>
        <div>
          <dt>Prioridad</dt>
          <dd>{order.priority}</dd>
        </div>
      </dl>

      {props.financialGate ? <OrderFinancialGate gate={props.financialGate} /> : null}

      <OrderWorkflowPanel
        detail={props.detail}
        busy={props.busy}
        onSimpleAction={props.onSimpleAction}
        onAssign={props.onAssign}
        onBlock={props.onBlock}
        onResume={props.onResume}
        onCreateIssue={props.onCreateIssue}
        onAddEvidence={props.onAddEvidence}
        onCancel={props.onCancel}
        onReopen={props.onReopen}
        onResolveIssue={props.onResolveIssue}
      />

      <section>
        <h3>Ítems</h3>
        <div className={styles.items}>
          {props.detail.items.map((item) => (
            <article key={item.id}>
              <strong>{item.description}</strong>
              <span>
                {item.quantity} {item.unit}
              </span>
              {item.requires_cut ? (
                <small>Corte: {item.requested_cut_length ?? 'pendiente'}</small>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="timeline-title">
        <h3 id="timeline-title">Historial y trazabilidad</h3>
        <div className={styles.timeline}>
          {[...props.detail.events].reverse().map((event, index) => (
            <article key={value(event, 'id') || `event-${index}`}>
              <div>
                <strong>{eventLabel(event)}</strong>
                <time>{value(event, 'created_at')}</time>
              </div>
              <p>
                {value(event, 'actorName') || 'Sistema'} · {value(event, 'from_step_code') || '—'} →{' '}
                {value(event, 'to_step_code') || value(event, 'from_step_code') || '—'}
              </p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
