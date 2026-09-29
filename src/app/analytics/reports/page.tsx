'use client';

import { AnalyticsFiltersBar, catalogSteps } from '../analytics-controls';
import { AnalyticsShell } from '../analytics-shell';
import styles from '../analytics.module.css';
import { ReportResults, ReportToolbar } from '../report-sections';
import { useAnalyticsReportsPage } from '../use-analytics-reports-page';

export default function AnalyticsReportsPage() {
  const page = useAnalyticsReportsPage();

  if (!page.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Reportes</p>
          <h1>{page.loading ? 'Cargando explorador…' : 'No fue posible abrir reportes'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  const steps = catalogSteps(page.context.catalogs.steps);

  return (
    <AnalyticsShell context={page.context} current="reports" onSignOut={page.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Explorador analítico</p>
          <h1>Reportes reutilizables</h1>
          <p>Una sola superficie paginada; cada reporte conserva permisos y filtros de su fuente.</p>
        </div>
      </header>

      <section className={styles.panel} aria-labelledby="report-selector-title">
        <ReportToolbar
          catalog={page.catalog}
          reportCode={page.reportCode}
          search={page.filters.search ?? ''}
          canExport={Boolean(page.response?.rows.length)}
          onReport={(code) => {
            page.setReportCode(code);
            void page.loadReport(code, 1, page.filters);
          }}
          onSearch={(search) => page.setFilters({ ...page.filters, search })}
          onExport={() => void page.exportCurrentPage()}
        />

        <AnalyticsFiltersBar
          value={page.filters}
          steps={steps}
          includeSource={page.reportCode === 'stage_times'}
          onChange={(next) => page.setFilters({ ...page.filters, ...next })}
          onSubmit={() => void page.loadReport(page.reportCode, 1, page.filters)}
        />

        {page.forbidden ? (
          <p className={styles.message} role="alert">
            Tu perfil no tiene acceso al explorador de reportes.
          </p>
        ) : null}
        {page.message ? (
          <p className={styles.message} role="alert">
            {page.message}
          </p>
        ) : null}
        {page.loading ? <p role="status">Consultando reporte…</p> : null}

        {page.response ? (
          <ReportResults
            catalog={page.catalog}
            response={page.response}
            loading={page.loading}
            onPage={(nextPage) => void page.loadReport(page.reportCode, nextPage, page.filters)}
          />
        ) : null}
      </section>
    </AnalyticsShell>
  );
}
