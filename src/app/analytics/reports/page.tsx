'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AnalyticsFilters,
  ReportCatalog,
  ReportResponse,
} from '@/modules/analytics/application/analytics.schemas';
import { AnalyticsFiltersBar, catalogSteps } from '../analytics-controls';
import { AnalyticsShell } from '../analytics-shell';
import styles from '../analytics.module.css';
import { useAnalyticsSession } from '../use-analytics-session';

type ReportFilters = AnalyticsFilters & { search?: string };

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function AnalyticsReportsPage() {
  const session = useAnalyticsSession();
  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);
  const [reportCode, setReportCode] = useState('');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [response, setResponse] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(
    async (code: string, page: number, nextFilters: ReportFilters) => {
      if (!session.application || !code) return;
      setLoading(true);
      session.setMessage(null);
      try {
        setResponse(await session.application.analytics.report(code, nextFilters, page, 25));
      } catch (error) {
        session.setMessage(
          error instanceof Error ? error.message : 'No fue posible consultar el reporte.',
        );
      } finally {
        setLoading(false);
      }
    },
    [session.application, session.setMessage],
  );

  useEffect(() => {
    if (!session.context || !session.application) return;
    if (!hasModuleCapability(session.context, 'reports', 'read')) {
      session.setMessage('Tu perfil no tiene acceso al explorador de reportes.');
      return;
    }

    void session.application.analytics
      .reportCatalog()
      .then((nextCatalog) => {
        setCatalog(nextCatalog);
        const first = nextCatalog.items[0]?.code ?? '';
        setReportCode(first);
        if (first) void loadReport(first, 1, {});
      })
      .catch((error) => {
        session.setMessage(
          error instanceof Error ? error.message : 'No fue posible cargar los reportes.',
        );
      });
  }, [
    loadReport,
    session.application,
    session.context,
    session.setMessage,
  ]);

  async function exportCurrentPage() {
    if (!session.application || !response || !reportCode) return;
    session.setMessage(null);
    try {
      const csv = await session.application.analytics.exportPage(reportCode, filters, response);
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = reportCode + '-' + response.range.from + '-' + response.range.to + '.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'No fue posible exportar la página.',
      );
    }
  }

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Reportes</p>
          <h1>{session.loading ? 'Cargando explorador…' : 'No fue posible abrir reportes'}</h1>
          {session.message ? <p role="alert">{session.message}</p> : null}
        </section>
      </main>
    );
  }

  const steps = catalogSteps(session.context.catalogs.steps);

  return (
    <AnalyticsShell context={session.context} current="reports" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Explorador analítico</p>
          <h1>Reportes reutilizables</h1>
          <p>Una sola superficie paginada; cada reporte conserva permisos y filtros de su fuente.</p>
        </div>
      </header>

      <section className={styles.panel} aria-labelledby="report-selector-title">
        <div className={styles.reportToolbar}>
          <label>
            <span id="report-selector-title">Reporte</span>
            <select
              value={reportCode}
              onChange={(event) => {
                const code = event.target.value;
                setReportCode(code);
                void loadReport(code, 1, filters);
              }}
            >
              {(catalog?.items ?? []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input
              value={filters.search ?? ''}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Pedido, cliente, material…"
            />
          </label>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={!response?.rows.length}
            onClick={() => void exportCurrentPage()}
          >
            Exportar página CSV
          </button>
        </div>

        <AnalyticsFiltersBar
          value={filters}
          steps={steps}
          includeSource={reportCode === 'stage_times'}
          onChange={(next) => setFilters({ ...filters, ...next })}
          onSubmit={() => void loadReport(reportCode, 1, filters)}
        />

        {session.message ? (
          <p className={styles.message} role="alert">
            {session.message}
          </p>
        ) : null}
        {loading ? <p role="status">Consultando reporte…</p> : null}

        {response ? (
          <>
            <div className={styles.panelHeader}>
              <div>
                <h2>{catalog?.items.find((item) => item.code === response.report)?.name ?? response.report}</h2>
                <p>
                  {response.pagination.totalItems} registros · {response.range.from} a{' '}
                  {response.range.to}
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
                disabled={response.pagination.page <= 1 || loading}
                onClick={() =>
                  void loadReport(reportCode, response.pagination.page - 1, filters)
                }
              >
                Anterior
              </button>
              <span>
                Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={
                  response.pagination.page >= response.pagination.totalPages || loading
                }
                onClick={() =>
                  void loadReport(reportCode, response.pagination.page + 1, filters)
                }
              >
                Siguiente
              </button>
            </div>
          </>
        ) : null}
      </section>
    </AnalyticsShell>
  );
}
