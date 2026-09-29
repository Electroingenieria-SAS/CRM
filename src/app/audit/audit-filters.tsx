'use client';

import type { AuditQuery } from '@/modules/audit/application/audit.schemas';
import styles from './audit.module.css';

interface Props {
  query: AuditQuery;
  busy: boolean;
  setQuery(value: AuditQuery): void;
  onApply(): void;
}

export function AuditFilters({ query, busy, setQuery, onApply }: Props) {
  return (
    <form
      className={styles.filters}
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      {(['from', 'to'] as const).map((key) => (
        <label key={key}>
          {key === 'from' ? 'Desde' : 'Hasta'}
          <input
            type="date"
            value={query[key] ?? ''}
            onChange={(event) => setQuery({ ...query, [key]: event.target.value || undefined })}
          />
        </label>
      ))}
      <label>
        Módulo
        <input
          value={query.module ?? ''}
          onChange={(event) => setQuery({ ...query, module: event.target.value })}
        />
      </label>
      <label>
        Acción
        <input
          value={query.action ?? ''}
          onChange={(event) => setQuery({ ...query, action: event.target.value })}
        />
      </label>
      <label>
        Recurso
        <input
          value={query.resource ?? ''}
          onChange={(event) => setQuery({ ...query, resource: event.target.value })}
        />
      </label>
      <label>
        Resultado
        <select
          value={query.result ?? ''}
          onChange={(event) => setQuery({ ...query, result: event.target.value })}
        >
          <option value="">Todos</option>
          {['SUCCESS', 'FAILED', 'DENIED', 'REQUESTED', 'ACKNOWLEDGED'].map((result) => (
            <option key={result}>{result}</option>
          ))}
        </select>
      </label>
      <button className="primary-button" type="submit" disabled={busy}>
        Aplicar
      </button>
    </form>
  );
}
