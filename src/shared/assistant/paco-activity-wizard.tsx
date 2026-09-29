'use client';

import type { PacoService } from '@/modules/assistant/application/paco-service';
import {
  PacoWizardClassification,
  PacoWizardContext,
  PacoWizardSchedule,
} from './paco-wizard-steps';
import styles from './paco.module.css';
import { usePacoActivityWizard } from './use-paco-activity-wizard';

interface Props {
  paco: PacoService;
  onCancel(): void;
  onComplete(message: string): void;
}

export function PacoActivityWizard({ paco, onCancel, onComplete }: Props) {
  const data = usePacoActivityWizard(paco, onComplete);

  return (
    <section className={styles.wizard} aria-label="Registro guiado de actividad">
      <div className={styles.wizardHeader}>
        <strong>Registrar actividad</strong>
        <button type="button" onClick={onCancel}>Cancelar consulta</button>
      </div>
      {data.message ? <p role="status">{data.message}</p> : null}
      <PacoWizardClassification data={data} />
      <PacoWizardContext data={data} />
      <PacoWizardSchedule data={data} />
    </section>
  );
}
