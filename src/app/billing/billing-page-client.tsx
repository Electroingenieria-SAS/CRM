'use client';

import { BillingWorkspace } from './billing-workspace';
import { useBillingPage } from './use-billing-page';

export function BillingPageClient() {
  const page = useBillingPage();

  if (!page.context || !page.queue) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Operación</p>
          <h1>{page.busy ? 'Cargando Facturación…' : 'No fue posible abrir Facturación'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <BillingWorkspace
      context={page.context}
      queue={page.queue}
      selected={page.selected}
      search={page.search}
      busy={page.busy}
      message={page.message}
      notice={page.notice}
      onSelect={page.setSelected}
      onSearchChange={page.setSearch}
      onSearch={page.searchNow}
      onRegisterInvoice={page.registerInvoice}
      onUploadPvpAnnex={page.uploadPvpAnnex}
      onComplete={page.complete}
      onSignOut={page.signOut}
    />
  );
}
