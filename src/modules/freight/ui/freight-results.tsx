import type { FreightPredictionResult } from '@/modules/freight/application/freight-prediction.schemas';
import styles from './freight-ui.module.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const evidenceLabels = {
  HIGH: 'Alta evidencia',
  MEDIUM: 'Media evidencia',
  LOW: 'Baja evidencia',
  NONE: 'Sin evidencia suficiente',
  NOT_APPLICABLE: 'No aplica',
} as const;

function fallbackExplanation(result: FreightPredictionResult) {
  if (result.status === 'NOT_APPLICABLE') {
    return 'La modalidad seleccionada no requiere un costo de flete estimado.';
  }
  if (result.status === 'INSUFFICIENT') {
    return 'No existe evidencia compatible suficiente ni en ciudad, departamento ni base nacional.';
  }
  if (result.fallbackLevel === 'CITY') {
    return `Se usó el histórico disponible para ${result.city ?? 'la ciudad seleccionada'}.`;
  }
  if (result.fallbackLevel === 'DEPARTMENT') {
    return `La ciudad no tenía soporte suficiente; se utilizó el histórico compatible de ${result.department ?? 'su departamento'}.`;
  }
  return 'Se utilizó la base nacional compatible de esta transportadora.';
}

function FreightResultCard({ result }: { result: FreightPredictionResult }) {
  return (
    <article className={styles.result} data-testid="freight-result">
      <div className={styles.resultHeader}>
        <div>
          <p className="eyebrow">{result.carrierName ?? 'Modalidad sin transportadora'}</p>
          <h3>{result.available && result.estimateMid != null ? money.format(result.estimateMid) : '—'}</h3>
        </div>
        <span className={styles.badge}>{evidenceLabels[result.evidenceLevel]}</span>
      </div>

      {result.available && result.estimateMid != null ? (
        <>
          <strong className={styles.estimate}>{money.format(result.estimateMid)}</strong>
          <div className={styles.range} aria-label="Rango histórico esperado">
            <div>
              <span>Rango bajo</span>
              <strong>{money.format(result.estimateLow ?? result.estimateMid)}</strong>
            </div>
            <div>
              <span>Estimación central</span>
              <strong>{money.format(result.estimateMid)}</strong>
            </div>
            <div>
              <span>Rango alto</span>
              <strong>{money.format(result.estimateHigh ?? result.estimateMid)}</strong>
            </div>
          </div>
        </>
      ) : null}

      <p className={styles.explanation}>{fallbackExplanation(result)}</p>
      <p className={styles.meta}>
        {result.sampleCount} observaciones compatibles · fallback {result.fallbackLevel} ·{' '}
        {result.outlierCount} atípico{result.outlierCount === 1 ? '' : 's'} excluido
        {result.outlierCount === 1 ? '' : 's'} · {result.algorithmVersion}
      </p>
    </article>
  );
}

export function FreightResults({ results }: { results: readonly FreightPredictionResult[] }) {
  if (!results.length) {
    return (
      <div className={styles.empty}>
        Selecciona los parámetros para obtener una estimación explicable.
      </div>
    );
  }

  return (
    <div className={styles.results} aria-live="polite">
      {results.map((result) => (
        <FreightResultCard
          result={result}
          key={result.predictionId}
        />
      ))}
    </div>
  );
}
