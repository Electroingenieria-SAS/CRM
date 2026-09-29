'use client';

import { AnalyticsFiltersBar, catalogSteps } from './analytics-controls';
import {
  DashboardAlerts,
  DashboardKpis,
  DashboardSources,
  OrdersByStepPanel,
  WorkforcePanel,
} from './dashboard-sections';
import { AnalyticsShell } from './analytics-shell';
import styles from './analytics.module.css';
import { useAnalyticsDashboardPage } from './use-analytics-dashboard-page';

export default function AnalyticsDashboardPage() {
  const page = useAnalyticsDashboardPage();

  if (!page.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Analítica operacional</p>
          <h1>{page.loading ? 'Cargando panel…' : 'No fue posible abrir el panel'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  const steps = catalogSteps(page.context.catalogs.steps);

  return (
    <AnalyticsShell context={page.context} current="dashboard" onSignOut={page.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Centro de operación</p>
          <h1>Qué está pasando ahora</h1>
          <p>Volumen, colas, bloqueos y señales accionables desde read models agregados.</p>
        </div>
      </header>

      <AnalyticsFiltersBar
        value={page.filters}
        steps={steps}
        onChange={page.setFilters}
        onSubmit={() => void page.load(page.filters)}
      />

      {page.forbidden ? (
        <p className={styles.message} role="alert">
          Tu perfil no tiene acceso al centro de operación.
        </p>
      ) : null}
      {page.message ? (
        <p className={styles.message} role="alert">
          {page.message}
        </p>
      ) : null}
      {page.loading ? <p role="status">Actualizando indicadores…</p> : null}

      {page.dashboard ? (
        <>
          <DashboardKpis dashboard={page.dashboard} />
          <div className={styles.grid}>
            <OrdersByStepPanel dashboard={page.dashboard} />
            <DashboardAlerts dashboard={page.dashboard} />
            <WorkforcePanel dashboard={page.dashboard} />
            <DashboardSources dashboard={page.dashboard} />
          </div>
        </>
      ) : null}
    </AnalyticsShell>
  );
}
