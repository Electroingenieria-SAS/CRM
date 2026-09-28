'use client';

import type { CustomerIntelligenceDetail } from '@/modules/customers/application/customer-intelligence.schemas';
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

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('es-CO');
}

interface Props {
  detail: CustomerIntelligenceDetail;
  onClose(): void;
}

export function CustomerIntelligenceDetailPanel({ detail, onClose }: Props) {
  const orderWeight = Math.round(detail.explanation.orderWeight * 100);
  const paidWeight = Math.round(detail.explanation.paidWeight * 100);

  return (
    <section className={styles.detailPanel} aria-labelledby="customer-detail-title">
      <button type="button" onClick={onClose}>
        Cerrar detalle
      </button>
      <p className="eyebrow">Explicación del segmento</p>
      <h2 id="customer-detail-title">{detail.customer.name}</h2>

      <div className={styles.detailMetrics}>
        <article>
          <small>Segmento</small>
          <strong>{segmentLabel[detail.metrics.segment]}</strong>
        </article>
        <article>
          <small>Score combinado</small>
          <strong>{detail.metrics.score.toFixed(1)}</strong>
        </article>
        <article>
          <small>Posición general</small>
          <strong>#{detail.metrics.overallRank}</strong>
        </article>
        <article>
          <small>Posición por pedidos</small>
          <strong>#{detail.metrics.orderRank}</strong>
        </article>
        <article>
          <small>Posición por valor pagado</small>
          <strong>#{detail.metrics.paidRank}</strong>
        </article>
        <article>
          <small>Pedidos válidos</small>
          <strong>{detail.metrics.validOrderCount}</strong>
        </article>
        <article>
          <small>Valor pagado</small>
          <strong>{currency.format(detail.metrics.paidAmount)}</strong>
        </article>
        <article>
          <small>Soporte estadístico</small>
          <strong>{detail.metrics.supportLevel}</strong>
        </article>
        <article>
          <small>Primer pedido</small>
          <strong>{dateLabel(detail.metrics.firstOrderAt)}</strong>
        </article>
        <article>
          <small>Último pedido</small>
          <strong>{dateLabel(detail.metrics.lastOrderAt)}</strong>
        </article>
      </div>

      <p className={styles.explanation}>
        Se clasifica usando exclusivamente {orderWeight}% de posición por cantidad de pedidos y{' '}
        {paidWeight}% de posición por valor pagado en facturas registradas, netas de reversión. Está
        en percentil {detail.metrics.frequencyPercentile.toFixed(1)} por cantidad de pedidos y{' '}
        {detail.metrics.paidPercentile.toFixed(1)} por valor pagado.
        {detail.metrics.provisional
          ? ' La clasificación es provisional porque el soporte estadístico todavía es limitado.'
          : ' La clasificación ya cuenta con soporte estadístico suficiente según la versión vigente.'}
      </p>

      <h3>Evolución de segmento</h3>
      <table className={styles.history}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>De</th>
            <th>A</th>
            <th>Score</th>
            <th>Pedidos</th>
            <th>Pagado</th>
          </tr>
        </thead>
        <tbody>
          {detail.history.map((entry) => (
            <tr key={entry.changedAt}>
              <td data-label="Fecha">{new Date(entry.changedAt).toLocaleDateString('es-CO')}</td>
              <td data-label="De">{entry.previousSegment ?? 'Inicial'}</td>
              <td data-label="A">{segmentLabel[entry.segment]}</td>
              <td data-label="Score">{entry.score.toFixed(1)}</td>
              <td data-label="Pedidos">{entry.validOrderCount}</td>
              <td data-label="Pagado">{currency.format(entry.paidAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
