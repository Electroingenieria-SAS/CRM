import type { FinancialGate } from '@/modules/finance/application/finance.schemas';
import { financialDecisionLabels } from '@/modules/finance/domain/financial-decision';
import styles from './finance-ui.module.css';

export function OrderFinancialGate({ gate }: { gate: FinancialGate }) {
  return (
    <section className={styles.panel} aria-labelledby="order-finance-gate-title">
      <h3 id="order-finance-gate-title">Estado financiero</h3>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Decisión</span>
          <strong>{financialDecisionLabels[gate.decision]}</strong>
        </div>
        <div className={styles.metric}>
          <span>Dominio</span>
          <strong>{gate.domain ?? 'Sin gate activo'}</strong>
        </div>
      </div>
      <p>{gate.reason}</p>
      {gate.nextActorModule ? (
        <p className={styles.notice}>Debe actuar: {gate.nextActorModule}</p>
      ) : null}
    </section>
  );
}
