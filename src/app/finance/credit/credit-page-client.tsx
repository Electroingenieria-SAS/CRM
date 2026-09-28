'use client';

import { CreditWorkspace } from './credit-workspace';
import { useCreditPage } from './use-credit-page';

export function CreditPageClient() {
  const page = useCreditPage();

  if (!page.context || !page.queue) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Finanzas</p>
          <h1>{page.loadingSession || page.busy ? 'Cargando Crédito…' : 'No fue posible abrir Crédito'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <CreditWorkspace
      context={page.context}
      queue={page.queue}
      customers={page.customers}
      query={page.query}
      busy={page.busy}
      message={page.message}
      notice={page.notice}
      onQuery={page.setQuery}
      onSearch={page.search}
      onCustomerSearch={page.searchCustomers}
      onCreate={page.create}
      onTake={page.take}
      onDecide={page.decide}
      onSignOut={page.signOut}
    />
  );
}
