'use client';

import type { CustomerIntelligenceDetail } from '@/modules/customers/application/customer-intelligence.schemas';
import styles from './customer-intelligence.module.css';

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

interface Props {
  detail: CustomerIntelligenceDetail;
  onClose(): void;
}

function DetailMetrics({ detail }: { detail: CustomerIntelligenceDetail }) {
  const metrics = detail.metrics;

  return (
    <div className={styles.detailMetrics}>
      <article>
        <small>Segmento</small>
        <strong>{metrics.segment}</strong>
      </article>
      <article>
        <small>Score</small>
        <strong>{metrics.score.toFixed(1)}</strong>
      </article>
      <article>
        <small>Posición general</small>
        <strong>#{metrics.overallRank}</strong>
      </article>
      <article>
        <small>Valor pagado</small>
        <strong>{currency.format(metrics.paidAmount)}</strong>
      </article>
      <article>
        <small>Observaciones</small>
        <strong>{metrics.observationCount}</strong>
      </article>
      <article>
        <small>Soporte</small>
        <strong>{metrics.supportLevel}</strong>
      </article>
      <article>
        <small>Primer pedido</small>
        <strong>{new Date(metrics.firstOrderAt).toLocaleDateString('es-CO')}</strong>
      </article>
      <article>
        <small>Último pedido</small>
        <strong>{new Date(metrics.lastOrderAt).toLocaleDateString('es-CO')}</strong>
      </article>
    </div>
  );
}

function SegmentExplanation({ detail }: { detail: CustomerIntelligenceDetail }) {
  const orderWeight = Math.round(detail.explanation.orderWeight * 100);
  const paidWeight = Math.round(detail.explanation.paidWeight * 100);

  return (
    <p className={styles.explanation}>
      Se clasifica usando exclusivamente {orderWeight}% de posición por cantidad de pedidos y{' '}
      {paidWeight}% de posición por valor pagado en facturas registradas, netas de reversión. Está
      en percentil {detail.metrics.frequencyPercentile.toFixed(1)} por pedidos y{' '}
      {detail.metrics.paidPercentile.toFixed(1)} por pago.
      {detail.metrics.provisional
        ? ' La clasificación es provisional porque el soporte estadístico todavía es limitado.'
        : ''}
    </p>
  );
}

function SegmentHistory({ detail }: { detail: CustomerIntelligenceDetail }) {
  return (
    <>
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
              <td data-label="A">{entry.segment}</td>
              <td data-label="Score">{entry.score.toFixed(1)}</td>
              <td data-label="Pedidos">{entry.validOrderCount}</td>
              <td data-label="Pagado">{currency.format(entry.paidAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function CustomerIntelligenceDetailPanel({ detail, onClose }: Props) {
  return (
    <section className={styles.detailPanel} aria-labelledby="customer-detail-title">
      <button type="button" onClick={onClose}>
        Cerrar detalle
      </button>
      <p className="eyebrow">Explicación del segmento</p>
      <h2 id="customer-detail-title">{detail.customer.name}</h2>
      <DetailMetrics detail={detail} />
      <SegmentExplanation detail={detail} />
      <SegmentHistory detail={detail} />
    </section>
  );
}
