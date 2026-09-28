'use client';

import { FreightWorkspaceView } from './freight-workspace-view';
import { useFreightPage } from './use-freight-page';

export function FreightPageClient() {
  const page = useFreightPage();

  if (!page.context || !page.catalog || !page.history || !page.metrics) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM</p>
          <h1>{page.loading ? 'Cargando Freight Intelligence…' : 'No fue posible abrir Fletes'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <FreightWorkspaceView
      context={page.context}
      catalog={page.catalog}
      history={page.history}
      metrics={page.metrics}
      historyFilters={page.historyFilters}
      results={page.results}
      loading={page.loading}
      predicting={page.predicting}
      message={page.message}
      onHistoryFiltersChange={page.setHistoryFilters}
      onSearchHistory={page.searchHistory}
      onPageHistory={page.pageHistory}
      onPredict={page.predict}
      onSignOut={page.signOut}
    />
  );
}
