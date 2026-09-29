'use client';

import type { AuditResponse } from '@/modules/audit/application/audit.schemas';
import styles from './audit.module.css';

function fmt(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface Props {
  response: AuditResponse | null;
  busy: boolean;
  load(page: number): Promise<void>;
}

export function AuditEventList({ response, busy, load }: Props) {
  return (
    <>
      <section className={styles.list} aria-label="Eventos de auditoría">
        {(response?.items ?? []).map((event) => (
          <article className={styles.card} key={event.id}>
            <div className={styles.row}>
              <strong>{event.action}</strong>
              <span className={styles.badge}>{event.result}</span>
            </div>
            <div className={styles.meta}>
              <span>{event.module}</span>
              <span>{event.actor}</span>
              <span>{new Date(event.createdAt).toLocaleString('es-CO')}</span>
            </div>
            <div className={styles.grid}>
              <div>
                <small>Recurso</small>
                <span>
                  {event.resourceType} · {event.resourceId ?? '—'}
                </span>
              </div>
              <div>
                <small>Request ID</small>
                <span>{event.requestId ?? '—'}</span>
              </div>
              <div>
                <small>Metadata</small>
                <span className={styles.code}>{fmt(event.metadata)}</span>
              </div>
            </div>
          </article>
        ))}
        {!response?.items.length && !busy ? <p>No hay eventos para estos filtros.</p> : null}
      </section>
      {response ? (
        <div className={styles.pagination}>
          <button
            type="button"
            disabled={busy || response.pagination.page <= 1}
            onClick={() => void load(response.pagination.page - 1)}
          >
            Anterior
          </button>
          <span>
            Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={busy || response.pagination.page >= response.pagination.totalPages}
            onClick={() => void load(response.pagination.page + 1)}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </>
  );
}
