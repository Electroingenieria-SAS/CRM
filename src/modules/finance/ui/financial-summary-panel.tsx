import type { OrderFinancialSummary } from '@/modules/finance/application/finance.schemas';
import { explainAvailableCredit } from '@/modules/finance/domain/financial-decision';
import styles from './finance-ui.module.css';

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function FinancialSummaryPanel({ summary }: { summary: OrderFinancialSummary }) {
  return (
    <section className={styles.panel} aria-labelledby="financial-summary-title">
      <h2 id="financial-summary-title">Resumen financiero</h2>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Condición</span>
          <strong>{summary.paymentCondition}</strong>
        </div>
        <div className={styles.metric}>
          <span>Valor efectivamente pagado</span>
          <strong className={styles.money}>{money.format(summary.paidAmount)}</strong>
        </div>
        <div className={styles.metric}>
          <span>Facturas activas</span>
          <strong>{summary.invoices.filter((i) => i.paidAmount > 0).length}</strong>
        </div>
        <div className={styles.metric}>
          <span>Retenciones activas</span>
          <strong>{summary.activeHolds.length}</strong>
        </div>
      </div>
      <p className={styles.notice}>
        Fuente del valor pagado: facturas registradas netas de reversos/anulaciones.
      </p>
      <p className={styles.warning}>{explainAvailableCredit(summary.availableCreditReason)}</p>
      {summary.credit ? (
        <div className={styles.card}>
          <strong>Solicitud {summary.credit.requestNumber}</strong>
          <p>
            Solicitado: {money.format(summary.credit.requestedAmount)} · saldo contra solicitud:{' '}
            {money.format(summary.credit.balanceAgainstRequestedAmount)}
          </p>
          <span className={styles.badge}>{summary.credit.status}</span>
        </div>
      ) : null}
    </section>
  );
}
