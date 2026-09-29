'use client';

import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type { LogisticsDetail } from '@/modules/logistics/application/logistics.schemas';
import { LogisticsDeliveryActions } from './logistics-delivery-actions';
import { LogisticsDispatchActions } from './logistics-dispatch-actions';
import styles from './logistics-ui.module.css';

interface OperationPanelProps {
  detail: LogisticsDetail | null;
  catalog: FreightCatalog;
  busy: boolean;
  canUpdate: boolean;
  canCorrectCost: boolean;
  canSatisfaction: boolean;
  onSaveGuide(shipmentId: string, carrierId: string, tracking: string): Promise<void>;
  onDispatch(
    shipmentId: string,
    orderId: string,
    version: number,
    actualFreight?: number,
  ): Promise<void>;
  onSetActualCost(shipmentId: string, version: number, cost: number): Promise<void>;
  onDeliver(
    shipmentId: string,
    orderId: string,
    version: number,
    file: File,
    receivedBy?: string,
    observation?: string,
  ): Promise<void>;
  onFail(
    shipmentId: string,
    orderId: string,
    version: number,
    reason: string,
    observation?: string,
    file?: File,
  ): Promise<void>;
  onReprogram(shipmentId: string, version: number): Promise<void>;
  onReturn(
    shipmentId: string,
    orderId: string,
    version: number,
    reason: string,
    file: File,
  ): Promise<void>;
  onSatisfaction(shipmentId: string, rating: number, comment?: string): Promise<void>;
}

function money(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function LogisticsOperationPanel(props: OperationPanelProps) {
  const shipment = props.detail?.shipment;
  const order = props.detail?.order;

  if (!shipment || !order) {
    return (
      <section className={styles.panel}>
        <h2>Operación</h2>
        <p className={styles.empty}>Selecciona un despacho para gestionarlo.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="logistics-operation-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Operación</p>
          <h2 id="logistics-operation-title">{order.orderNumber}</h2>
          <p>{order.customerName}</p>
        </div>
        <span className={styles.badge}>{shipment.status.replaceAll('_', ' ')}</span>
      </div>

      <dl className={styles.definitionGrid}>
        <div>
          <dt>Modalidad</dt>
          <dd>{shipment.routeCode.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt>Destino</dt>
          <dd>
            {order.city || '—'} · {order.address || '—'}
          </dd>
        </div>
        <div>
          <dt>Estimado</dt>
          <dd>{money(shipment.estimatedFreight)}</dd>
        </div>
        <div>
          <dt>Real</dt>
          <dd>{money(shipment.actualFreight)}</dd>
        </div>
      </dl>

      <LogisticsDispatchActions
        shipment={shipment}
        orderId={order.id}
        catalog={props.catalog}
        busy={props.busy}
        canUpdate={props.canUpdate}
        canCorrectCost={props.canCorrectCost}
        onSaveGuide={props.onSaveGuide}
        onDispatch={props.onDispatch}
        onSetActualCost={props.onSetActualCost}
      />

      <LogisticsDeliveryActions
        shipment={shipment}
        order={order}
        satisfaction={props.detail?.satisfaction ?? null}
        busy={props.busy}
        canUpdate={props.canUpdate}
        canSatisfaction={props.canSatisfaction}
        onDeliver={props.onDeliver}
        onFail={props.onFail}
        onReprogram={props.onReprogram}
        onReturn={props.onReturn}
        onSatisfaction={props.onSatisfaction}
      />
    </section>
  );
}
