'use client';

import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type {
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsQueueQuery } from '@/modules/logistics/ports/logistics-ports';
import { LogisticsOperationPanel } from '@/modules/logistics/ui/logistics-operation-panel';
import { LogisticsShipmentList } from './logistics-workspace-sections';
import styles from '@/modules/logistics/ui/logistics-ui.module.css';

interface ShippingSectionProps {
  queue: LogisticsQueue;
  catalog: FreightCatalog;
  detail: LogisticsDetail | null;
  query: LogisticsQueueQuery;
  busy: boolean;
  canUpdate: boolean;
  canCorrectCost: boolean;
  canSatisfaction: boolean;
  onQuery(query: LogisticsQueueQuery): void;
  onSearchQueue(): void;
  onOpenDetail(orderId: string): Promise<void>;
  onSaveGuide(shipmentId: string, carrierId: string, tracking: string): Promise<void>;
  onDispatch(shipmentId: string, orderId: string, version: number, cost?: number): Promise<void>;
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

function ShippingFilters(props: Pick<
  ShippingSectionProps,
  'query' | 'busy' | 'onQuery' | 'onSearchQueue'
>) {
  return (
    <div className={styles.filters}>
      <input
        aria-label="Buscar despachos"
        value={props.query.search ?? ''}
        onChange={(event) => props.onQuery({ ...props.query, search: event.target.value })}
        placeholder="Pedido, cliente o guía"
      />
      <select
        aria-label="Estado logístico"
        value={props.query.status ?? ''}
        onChange={(event) =>
          props.onQuery({ ...props.query, status: event.target.value || undefined })
        }
      >
        <option value="">Todos los estados</option>
        {['READY', 'IN_TRANSIT', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED'].map((status) => (
          <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
        ))}
      </select>
      <select
        aria-label="Modalidad"
        value={props.query.routeCode ?? ''}
        onChange={(event) =>
          props.onQuery({ ...props.query, routeCode: event.target.value || undefined })
        }
      >
        <option value="">Todas las modalidades</option>
        {['CLIENT_POINT', 'CLIENT_PICKUP', 'LOCAL_DISPATCH', 'NATIONAL_DISPATCH'].map((route) => (
          <option key={route} value={route}>{route.replaceAll('_', ' ')}</option>
        ))}
      </select>
      <button type="button" disabled={props.busy} onClick={props.onSearchQueue}>Filtrar</button>
    </div>
  );
}

export function LogisticsShippingSection(props: ShippingSectionProps) {
  return (
    <section className={styles.section} aria-labelledby="shipping-queue-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="shipping-queue-title">Despachos y entregas</h2>
          <p>Consulta por estado, modalidad, pedido o guía.</p>
        </div>
      </div>
      <ShippingFilters {...props} />
      <div className={styles.twoColumns}>
        <LogisticsShipmentList
          items={props.queue.items}
          selectedOrderId={props.detail?.order.id}
          onSelect={(orderId) => void props.onOpenDetail(orderId)}
        />
        <LogisticsOperationPanel
          key={props.detail?.shipment ? `${props.detail.shipment.id}:${props.detail.shipment.version}` : 'none'}
          detail={props.detail}
          catalog={props.catalog}
          busy={props.busy}
          canUpdate={props.canUpdate}
          canCorrectCost={props.canCorrectCost}
          canSatisfaction={props.canSatisfaction}
          onSaveGuide={props.onSaveGuide}
          onDispatch={props.onDispatch}
          onSetActualCost={props.onSetActualCost}
          onDeliver={props.onDeliver}
          onFail={props.onFail}
          onReprogram={props.onReprogram}
          onReturn={props.onReturn}
          onSatisfaction={props.onSatisfaction}
        />
      </div>
    </section>
  );
}
