'use client';

import type { AnalyticsFilters } from '@/modules/analytics/application/analytics.schemas';
import styles from './analytics.module.css';

interface AnalyticsFiltersProps {
  value: AnalyticsFilters;
  steps: readonly { code: string; name: string }[];
  onChange(value: AnalyticsFilters): void;
  onSubmit(): void;
  includeSource?: boolean;
}

const statusOptions = [
  'QUEUED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING',
  'BLOCKED',
  'PENDING_APPROVAL',
  'CLOSED',
] as const;

const routeOptions = [
  'CLIENT_POINT',
  'CLIENT_PICKUP',
  'LOCAL_DISPATCH',
  'NATIONAL_DISPATCH',
] as const;

export function AnalyticsFiltersBar(props: AnalyticsFiltersProps) {
  function set<K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) {
    props.onChange({ ...props.value, [key]: value });
  }

  return (
    <form
      className={styles.filters}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <label>
        Desde
        <input
          type="date"
          value={props.value.from ?? ''}
          onChange={(event) => set('from', event.target.value)}
        />
      </label>
      <label>
        Hasta
        <input
          type="date"
          value={props.value.to ?? ''}
          onChange={(event) => set('to', event.target.value)}
        />
      </label>
      <label>
        Cliente
        <input
          value={props.value.client ?? ''}
          onChange={(event) => set('client', event.target.value)}
          placeholder="Nombre"
        />
      </label>
      <label>
        Etapa
        <select
          value={props.value.step ?? ''}
          onChange={(event) => set('step', event.target.value)}
        >
          <option value="">Todas</option>
          {props.steps.map((step) => (
            <option key={step.code} value={step.code}>
              {step.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estado
        <select
          value={props.value.status ?? ''}
          onChange={(event) => set('status', event.target.value)}
        >
          <option value="">Todos</option>
          {statusOptions.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <label>
        Modalidad
        <select
          value={props.value.route ?? ''}
          onChange={(event) => set('route', event.target.value)}
        >
          <option value="">Todas</option>
          {routeOptions.map((route) => (
            <option key={route}>{route}</option>
          ))}
        </select>
      </label>
      {props.includeSource ? (
        <label>
          Fuente
          <select
            value={props.value.source ?? ''}
            onChange={(event) => set('source', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="OPERATIONAL">Operacional</option>
            <option value="HISTORICAL">Histórico</option>
          </select>
        </label>
      ) : null}
      <button type="submit" className="primary-button">
        Aplicar
      </button>
    </form>
  );
}

export function catalogSteps(rows: Array<Record<string, unknown>>) {
  return rows.flatMap((row) =>
    typeof row.code === 'string' && typeof row.name === 'string'
      ? [{ code: row.code, name: row.name }]
      : [],
  );
}
