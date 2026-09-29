'use client';

import { AnalyticsFiltersBar, catalogSteps } from '../analytics-controls';
import { AnalyticsShell } from '../analytics-shell';
import styles from '../analytics.module.css';
import { useAnalyticsVsmPage } from '../use-analytics-vsm-page';
import {
  BottlenecksPanel,
  OrderVsmPanel,
  StageWaitPanel,
  VsmSummaryCards,
} from '../vsm-sections';

export default function AnalyticsVsmPage() {
  const page = useAnalyticsVsmPage();

  if (!page.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Value Stream Mapping</p>
          <h1>{page.loading ? 'Cargando VSM…' : 'No fue posible abrir VSM'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  const steps = catalogSteps(page.context.catalogs.steps);

  return (
    <AnalyticsShell context={page.context} current="vsm" onSignOut={page.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Value Stream Mapping</p>
          <h1>Tiempos y cuellos de botella</h1>
          <p>Espera, proceso, bloqueo y tránsito se mantienen como conceptos distintos.</p>
        </div>
      </header>

      <AnalyticsFiltersBar
        value={page.filters}
        steps={steps}
        includeSource
        onChange={page.setFilters}
        onSubmit={() => void page.loadSummary(page.filters)}
      />

      {page.forbidden ? (
        <p className={styles.message} role="alert">
          Tu perfil no tiene acceso a VSM y tiempos.
        </p>
      ) : null}
      {page.message ? (
        <p className={styles.message} role="alert">
          {page.message}
        </p>
      ) : null}
      {page.loading ? <p role="status">Actualizando VSM…</p> : null}

      {page.summary ? (
        <>
          <VsmSummaryCards summary={page.summary} />
          <div className={styles.grid}>
            <StageWaitPanel summary={page.summary} />
            <BottlenecksPanel summary={page.summary} />
          </div>
        </>
      ) : null}

      <OrderVsmPanel
        detail={page.detail}
        lookup={page.lookup}
        onLookup={page.setLookup}
        onSubmit={() => void page.openOrder()}
      />
    </AnalyticsShell>
  );
}
