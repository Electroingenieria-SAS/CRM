import { getReconstructionStatus } from '../application/get-reconstruction-status';
import styles from './reconstruction-overview.module.css';

const stateLabel = {
  validated: 'Validado',
  'in-progress': 'En curso',
  blocked: 'Bloqueado',
  pending: 'Pendiente',
} as const;

export function ReconstructionOverview() {
  const status = getReconstructionStatus();

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="crm-title">
        <div>
          <p className="eyebrow">Electroingeniería S.A.S. · staging seguro</p>
          <h1 id="crm-title">CRM empresarial</h1>
          <p className={styles.lead}>
            Nueva base modular del CRM. Este entorno está deliberadamente desacoplado de producción
            mientras se validan los controles críticos y la paridad funcional.
          </p>
        </div>
        <div className={styles.versionCard} aria-label="Línea base de reconstrucción">
          <span>Fuente</span>
          <strong>v{status.sourceVersion}</strong>
          <span>Nuevo CRM</span>
          <strong>v{status.targetVersion}</strong>
        </div>
      </section>

      <section className={styles.grid} aria-label="Estado de gates">
        {status.gates.map((gate) => (
          <article className={styles.card} key={gate.id}>
            <div className={styles.cardHeader}>
              <h2>{gate.label}</h2>
              <span className={styles.badge} data-state={gate.state}>
                {stateLabel[gate.state]}
              </span>
            </div>
            <p>{gate.detail}</p>
          </article>
        ))}
      </section>

      <section className={styles.baseline} aria-labelledby="baseline-title">
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h2 id="baseline-title">Baseline funcional congelado</h2>
        </div>
        <code>{status.baselineCommit}</code>
      </section>
    </main>
  );
}
