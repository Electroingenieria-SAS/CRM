'use client';

import type { ParetoResponse } from '@/modules/customers/application/customer-intelligence.schemas';
import styles from './customer-intelligence.module.css';

type ParetoSeries = ParetoResponse['ordersSeries'];

function polyline(points: ParetoSeries) {
  if (!points.length) return '';

  return points
    .map((point) => {
      const x = point.customerPct;
      const y = 100 - point.cumulativePct;
      return x.toFixed(2) + ',' + y.toFixed(2);
    })
    .join(' ');
}

interface Props {
  data: ParetoResponse;
}

export function ParetoChart({ data }: Props) {
  const paidLine = polyline(data.paidSeries);
  const ordersLine = polyline(data.ordersSeries);
  const hasData = data.ordersSeries.length > 0 || data.paidSeries.length > 0;

  return (
    <section className={styles.paretoLayout} aria-labelledby="pareto-title">
      <div className={styles.chartPanel}>
        <h3 id="pareto-title">Concentración Pareto real</h3>
        <p>Cada curva ordena clientes por su propio factor. No se fuerza una relación 80/20.</p>
        {hasData ? (
          <>
            <svg
              className={styles.chart}
              viewBox="0 0 100 100"
              role="img"
              aria-label="Curvas acumuladas independientes de pedidos y valor pagado por porcentaje de clientes"
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
