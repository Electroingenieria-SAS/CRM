'use client';

import type { FinanceDomain } from '@/modules/finance/ports/finance-repository';
import { FinanceQueueWorkspace } from './finance-queue-workspace';
import { useFinanceQueuePage } from './use-finance-queue-page';

export function FinanceQueuePageClient({ domain }: { domain: FinanceDomain }) {
  const page = useFinanceQueuePage(domain);

  if (!page.context || !page.queue) {
    const title = domain === 'CARTERA' ? 'Cartera' : 'Caja';
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Finanzas</p>
          <h1>
            {page.loadingSession || page.busy ? 'Cargando ' + title + '…' : 'No fue posible abrir ' + title}
          </h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <FinanceQueueWorkspace
      domain={domain}
      context={page.context}
      queue={page.queue}
      query={page.query}
      selected={page.selected}
      summary={page.summary}
      busy={page.busy}
      message={page.message}
      notice={page.notice}
      onQuery={page.setQuery}
      onSearch={page.search}
      onSelect={page.choose}
      actions={page.actions}
      onSignOut={page.signOut}
    />
  );
}
