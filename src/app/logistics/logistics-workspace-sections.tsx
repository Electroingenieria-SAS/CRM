'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  LogisticsCandidate,
  LogisticsQueueItem,
} from '@/modules/logistics/application/logistics.schemas';
import type { AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from '@/modules/logistics/ui/logistics-ui.module.css';

export function logisticsNavigation(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) {
    items.push({ href: '/orders', label: 'Pedidos' });
  }
  if (hasModuleCapability(context, 'billing', 'read')) {
    items.push({ href: '/billing', label: 'Facturación' });
  }
  items.push({ href: '/logistics', label: 'Logística', current: true });
  if (hasModuleCapability(context, 'freight', 'read')) {
    items.push({ href: '/freight', label: 'Fletes' });
  }
  if (hasModuleCapability(context, 'workforce', 'read')) {
    items.push({ href: '/workforce', label: 'Jornada' });
  }
  return items;
}

export function LogisticsCandidateList(props: {
  items: LogisticsCandidate[];
  selectedId?: string;
  onSelect(item: LogisticsCandidate): void;
}) {
  if (!props.items.length) {
    return <p className={styles.empty}>No hay pedidos pendientes de liberación.</p>;
  }

  return (
    <div className={styles.cards}>
      {props.items.map((item) => (
        <button
          key={item.orderId}
          type="button"
          className={item.orderId === props.selectedId ? styles.selectedCard : styles.card}
          onClick={() => props.onSelect(item)}
        >
          <strong>{item.orderNumber}</strong>
          <span>{item.customerName}</span>
          <small>
            {item.routeCode.replaceAll('_', ' ')} · {item.city || 'Sin ciudad'}
          </small>
          <small>
            {item.readiness.readyForLogistics ? 'Listo para liberar' : 'Con restricción'}
          </small>
        </button>
      ))}
    </div>
  );
}

export function LogisticsShipmentList(props: {
  items: LogisticsQueueItem[];
  selectedOrderId?: string;
  onSelect(orderId: string): void;
}) {
  if (!props.items.length) {
    return <p className={styles.empty}>No hay despachos con estos filtros.</p>;
  }

  return (
    <div className={styles.cards}>
      {props.items.map((item) => (
        <button
          key={item.shipmentId}
          type="button"
          className={item.orderId === props.selectedOrderId ? styles.selectedCard : styles.card}
          onClick={() => props.onSelect(item.orderId)}
        >
          <span className={styles.cardTop}>
            <strong>{item.orderNumber}</strong>
            <span>{item.status.replaceAll('_', ' ')}</span>
          </span>
          <span>{item.customerName}</span>
          <small>
            {item.routeCode.replaceAll('_', ' ')} · {item.destination.city || 'Sin ciudad'}
          </small>
          <small>{item.trackingNumber || 'Sin guía'}</small>
        </button>
      ))}
    </div>
  );
}
