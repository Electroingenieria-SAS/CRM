'use client';

import { CustomerIntelligenceWorkspace } from './customer-intelligence-workspace';
import { useCustomerIntelligencePage } from './use-customer-intelligence-page';

export function CustomerIntelligencePageClient() {
  const page = useCustomerIntelligencePage();

  if (!page.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM</p>
          <h1>
            {page.loading
              ? 'Cargando inteligencia de clientes…'
              : 'No fue posible abrir Customer Intelligence'}
          </h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <CustomerIntelligenceWorkspace
      context={page.context}
      ranking={page.ranking}
      pareto={page.pareto}
      detail={page.detail}
      filters={page.filters}
      loading={page.loading}
      recalculating={page.recalculating}
      message={page.message}
      notice={page.notice}
      onFiltersChange={page.setFilters}
      onSearch={page.search}
      onOpenDetail={(customerId) => void page.openDetail(customerId)}
      onCloseDetail={page.closeDetail}
      onRecalculate={page.recalculate}
      onSignOut={page.signOut}
    />
  );
}
