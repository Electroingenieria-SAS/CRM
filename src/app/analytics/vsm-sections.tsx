'use client';

import type {
  AnalyticsOrderVsm,
  AnalyticsVsmSummary,
} from '@/modules/analytics/application/analytics.schemas';
import styles from './analytics.module.css';

export function VsmSummaryCards({ summary }: { summary: AnalyticsVsmSummary }) {
  const items = [
    ['Pedidos analizados', summary.overall.orders],
    ['Mediana ciclo etapas', summary.overall.medianStageCycleMinutes + ' min'],
    ['P90 ciclo etapas', summary.overall.p90StageCycleMinutes + ' min'],
    ['Espera promedio', summary.overall.averageWaitingMinutes + ' min'],
    ['Proceso promedio', summary.overall.averageProcessingMinutes + ' min'],
    ['Bloqueo promedio', summary.overall.averageBlockedMinutes + ' min'],
  ] as const;

  return (
    <section className={styles.kpis} aria-label="Resumen VSM">
      {items.map(([label, value]) => (
        <article className={styles.kpi} key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

export function StageWaitPanel({ summary }: { summary: AnalyticsVsmSummary }) {
  const maxWaiting = Math.max(
    1,
    ...summary.stages.map((stage) => stage.averageWaitingMinutes ?? 0),
  );
  return (
    <section className={styles.panel} aria-labelledby="stage-times-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="stage-times-title">Espera por etapa</h2>
          <p>¿Qué etapas concentran mayor espera?</p>
        </div>
      </div>
      <div className={styles.stageList}>
        {summary.stages.map((stage) => (
          <article className={styles.stage} key={stage.stepCode}>
            <div className={styles.stageHeader}>
              <strong>{stage.stepName}</strong>
              <span>{stage.averageWaitingMinutes ?? 0} min espera</span>
            </div>
            <div
              className={styles.barTrack}
              role="img"
              aria-label={
                stage.stepName +
                ': espera promedio ' +
                (stage.averageWaitingMinutes ?? 0) +
                ' minutos'
              }
            >
              <div
                className={styles.bar}
                style={{
                  width:
                    Math.max(2, ((stage.averageWaitingMinutes ?? 0) / maxWaiting) * 100) + '%',
                }}
              />
            </div>
            <div className={styles.stageMeta}>
              <span>mediana {stage.medianMinutes ?? 0} min</span>
              <span>P90 {stage.p90Minutes ?? 0} min</span>
              <span>proceso {stage.averageProcessingMinutes ?? 0} min</span>
              <span>bloqueo {stage.averageBlockedMinutes ?? 0} min</span>
              <span>cola {stage.currentQueue ?? 0}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BottlenecksPanel({ summary }: { summary: AnalyticsVsmSummary }) {
  return (
    <section className={styles.panel} aria-labelledby="bottlenecks-title">
      <h2 id="bottlenecks-title">Evidencia de cuellos de botella</h2>
      <p>No atribuye responsabilidad a personas; muestra evidencia objetiva por etapa.</p>
      {summary.bottlenecks.map((item) => (
        <article className={styles.bottleneck} key={item.stepCode}>
          <strong>{item.stepName}</strong>
          <span>
            Espera {item.evidence.averageWaitingMinutes} min · P90 {item.evidence.p90Minutes} min
          </span>
          <span>
            Cola {item.evidence.currentQueue} · Bloqueados {item.evidence.blockedOrders} ·{' '}
            {item.evidence.samples} muestras
          </span>
        </article>
      ))}
    </section>
  );
}

interface OrderLookupProps {
  detail: AnalyticsOrderVsm | null;
  lookup: string;
  onLookup(value: string): void;
  onSubmit(): void;
}

export function OrderVsmPanel(props: OrderLookupProps) {
  return (
    <section className={styles.panel} aria-labelledby="order-vsm-title">
      <h2 id="order-vsm-title">VSM por pedido</h2>
      <p>Consulta por UUID de pedido o por clave externa de un histórico importado.</p>
      <form
        className={styles.lookup}
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <label>
          Pedido o clave histórica
          <input
            value={props.lookup}
            onChange={(event) => props.onLookup(event.target.value)}
            placeholder="UUID o externalOrderKey"
          />
        </label>
        <button type="submit" className="primary-button">
          Consultar
        </button>
      </form>
      {props.detail ? <OrderVsmDetail detail={props.detail} /> : null}
    </section>
  );
}

function OrderVsmDetail({ detail }: { detail: AnalyticsOrderVsm }) {
  return (
    <>
      <div className={styles.metricGrid}>
        <article className={styles.metric}>
          <small>Pedido</small>
          <strong>{detail.orderNumber}</strong>
        </article>
        <article className={styles.metric}>
          <small>Lead time laboral</small>
          <strong>{detail.leadTimeMinutes} min</strong>
        </article>
        <article className={styles.metric}>
          <small>Fuente</small>
          <strong>{detail.source}</strong>
        </article>
      </div>
      <div className={styles.timeline} aria-label={'VSM del pedido ' + detail.orderNumber}>
        {detail.stages.map((stage, index) => (
          <article className={styles.timelineItem} key={stage.stepCode + '-' + index}>
            <div className={styles.rowHeader}>
              <strong>{stage.stepName}</strong>
              <span>{stage.status}</span>
            </div>
            <div className={styles.stageMeta}>
              <span>espera {stage.waitingMinutes} min</span>
              <span>proceso {stage.processingMinutes} min</span>
              <span>bloqueo {stage.blockedMinutes} min</span>
              {stage.transitMinutes !== null ? <span>tránsito {stage.transitMinutes} min</span> : null}
              <span>total {stage.totalMinutes} min</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
