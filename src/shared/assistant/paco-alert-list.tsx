'use client';

import type { AssistantAlert } from '@/modules/assistant/application/assistant.schemas';
import styles from './paco.module.css';

export function PacoAlertList({
  alerts,
  acknowledge,
}: {
  alerts: AssistantAlert[];
  acknowledge(id: string): Promise<void>;
}) {
  if (!alerts.length) return null;
  return (
    <section className={styles.alerts} aria-label="Alertas PACO">
      {alerts.slice(0, 3).map((alert) => (
        <article className={styles.alert} data-severity={alert.severity} key={alert.id}>
          <strong>{alert.title}</strong>
          <span>{alert.message}</span>
          <button type="button" onClick={() => void acknowledge(alert.id)}>Entendido</button>
        </article>
      ))}
    </section>
  );
}
