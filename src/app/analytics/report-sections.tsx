'use client';

import type { ReportCatalog, ReportResponse } from '@/modules/analytics/application/analytics.schemas';
import type { ReportFilters } from './use-analytics-reports-page';
import styles from './analytics.module.css';

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface ReportToolbarProps {
  catalog: ReportCatalog | null;
  reportCode: string;
  search: string;
  canExport: boolean;
  onReport(code: string): void;
  onSearch(value: string): void;
  onExport(): void;
}

export function ReportToolbar(props: ReportToolbarProps) {
  return (
    <div className={styles.reportToolbar}>
      <label>
        <span id="report-selector-title">Reporte</span>
        <select value={props.reportCode} onChange={(event) => props.onReport(event.target.value)}>
          {(props.catalog?.items ?? []).map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Buscar
        <input
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          placeholder="Pedido, cliente, material…"
        />
      </label>
      <button
        type="button"
        className={styles.secondaryButton}
        disabled={!props.canExport}
        onClick={props.onExport}
      >
        Exportar página CSV
      </button>
    </div>
  );
}

interface ReportResultsProps {
  catalog: ReportCatalog | null;
  response: ReportResponse;
  loading: boolean;
  onPage(page: number): void;
}

export function ReportResults(props: ReportResultsProps) {
  const { response } = props;
  return (
    <>
      <div className={styles.panelHeader}>
        <div>
          <h2>
            {props.catalog?.items.find((item) => item.code === response.report)?.name ??
              response.report}
          </h2>
          <p>
            {response.pagination.totalItems} registros · {response.range.from} a {response.range.to}
          </p>
        </div>
      </div>
      <div className={styles.reportRows}>
        {response.rows.length ? (
          response.rows.map((row, index) => (
            <article className={styles.reportCard} key={index}>
              <div className={styles.reportGrid}>
                {response.columns.map((column) => (
                  <div className={styles.reportField} key={column.key}>
                    <small>{column.label}</small>
                    <span>{display(row[column.key])}</span>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className={styles.muted}>No hay resultados para estos filtros.</p>
        )}
      </div>
      <div className={styles.pagination}>
        <button
          type="button"
          disabled={response.pagination.page <= 1 || props.loading}
          onClick={() => props.onPage(response.pagination.page - 1)}
        >
          Anterior
        </button>
        <span>
          Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
        </span>
        <button
          type="button"
          disabled={response.pagination.page >= response.pagination.totalPages || props.loading}
          onClick={() => props.onPage(response.pagination.page + 1)}
        >
          Siguiente
        </button>
      </div>
    </>
  );
}

export function withSearch(filters: ReportFilters, search: string): ReportFilters {
  return { ...filters, search };
}
