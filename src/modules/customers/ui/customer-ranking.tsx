'use client';

import type { CustomerIntelligenceRow } from '@/modules/customers/application/customer-intelligence.schemas';
import styles from './customer-intelligence.module.css';

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const segmentLabel = {
  URGENT: 'Urgente',
  PREMIUM: 'Premium',
  NORMAL: 'Normal',
  BASIC: 'Básico',
} as const;

interface Props {
  items: CustomerIntelligenceRow[];
  onSelect(customerId: string): void;
}

export function CustomerRanking({ items, onSelect }: Props) {
  if (!items.length) {
    return (
      <p className={styles.empty}>No hay clientes calculados para los filtros seleccionados.</p>
    );
  }

  return (
    <div className={styles.ranking} aria-label="Ranking de clientes">
      {items.map((customer) => (
        <button
          key={customer.customerId}
          type="button"
          className={styles.customerCard}
          onClick={() => onSelect(customer.customerId)}
          aria-label={
            'Abrir ' +
            customer.customerName +
            ', posición ' +
            customer.overallRank +
            ', segmento ' +
            segmentLabel[customer.segment]
          }
        >
          <span className={styles.customerName}>
            <strong>
              #{customer.overallRank} · {customer.customerName}
            </strong>
            <span>
              {customer.customerDocument ?? 'Identidad provisional'}
              {customer.provisional ? (
                <em className={styles.provisional}> · clasificación provisional</em>
              ) : null}
            </span>
          </span>
          <span className={styles.metric}>
            <small>Pedidos válidos</small>
            <strong>{customer.validOrderCount}</strong>
          </span>
          <span className={styles.metric}>
            <small>Valor pagado</small>
            <strong>{currency.format(customer.paidAmount)}</strong>
          </span>
          <span className={styles.metric}>
            <small>Score</small>
            <strong>{customer.score.toFixed(1)}</strong>
          </span>
          <span className={styles.segment}>
            <small>Segmento</small>
            <strong>{segmentLabel[customer.segment]}</strong>
          </span>
        </button>
      ))}
    </div>
  );
}
