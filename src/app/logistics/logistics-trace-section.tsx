import type { LogisticsDetail } from '@/modules/logistics/application/logistics.schemas';
import styles from '@/modules/logistics/ui/logistics-ui.module.css';

export function LogisticsTraceSection({ detail }: { detail: LogisticsDetail | null }) {
  if (!detail?.events.length) return null;

  return (
    <section className={styles.section} aria-labelledby="trace-title">
      <h2 id="trace-title">Trazabilidad</h2>
      <ol className={styles.timeline}>
        {detail.events.slice(0, 20).map((event, index) => (
          <li key={String(event.id ?? index)}>
            <strong>{String(event.eventType ?? 'EVENTO').replaceAll('_', ' ')}</strong>
            <span>
              {event.createdAt ? new Date(String(event.createdAt)).toLocaleString('es-CO') : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
