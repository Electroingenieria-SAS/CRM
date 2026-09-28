'use client';

import type { ParetoResponse } from '@/modules/customers/application/customer-intelligence.schemas';
import styles from './customer-intelligence.module.css';

function polyline(
  points: ParetoResponse['points'],
  field: 'ordersCumulativePct' | 'paidCumulativePct',
) {
  if (!points.length) return '';
  const denominator = Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = (index / denominator) * 100;
      const y = 100 - point[field];
      return x.toFixed(2) + ',' + y.toFixed(2);
    })
    .join(' ');
}

interface Props {
  data: ParetoResponse;
}

export function ParetoChart({ data }: Props) {
  const paidLine = polyline(data.points, 'paidCumulativePct');
  const ordersLine = polyline(data.points, 'ordersCumulativePct');

  return (
    <section className={styles.paretoLayout} aria-labelledby="pareto-title">
      <div className={styles.chartPanel}>
        <h3 id="pareto-title">Concentración Pareto real</h3>
        <p>
          Las curvas muestran el acumulado observado; no se asume que la distribución sea 80/20.
        </p>
        {data.points.length ? (
          <>
            <svg
              className={styles.chart}
              viewBox="0 0 100 100"
              role="img"
              aria-label="Curvas acumuladas de pedidos y valor pagado por ranking de clientes"
              preserveAspectRatio="none"
            >
              <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" opacity="0.25" />
              <line x1="0" y1="0" x2="0" y2="100" stroke="currentColor" opacity="0.25" />
              <polyline
                points={ordersLine}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={paidLine}
                fill="none"
                stroke="currentColor"
                strokeDasharray="3 2"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className={styles.legend} aria-hidden="true">
              <span>Pedidos acumulados</span>
              <span>Valor pagado acumulado (línea discontinua)</span>
            </div>
          </>
        ) : (
          <p className={styles.empty}>Todavía no existe una curva calculada.</p>
        )}
      </div>
      <div className={styles.summary} aria-label="Resumen textual de Pareto">
        <article>
          <small>Clientes observados</small>
          <strong>{data.summary.customers}</strong>
        </article>
        <article>
          <small>Top 20 % · valor pagado</small>
          <strong>{data.summary.top20CustomersPaidPct.toFixed(1)} % acumulado</strong>
        </article>
        <article>
          <small>Top 20 % · pedidos</small>
          <strong>{data.summary.top20CustomersOrdersPct.toFixed(1)} % acumulado</strong>
        </article>
      </div>
    </section>
  );
}
