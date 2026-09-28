'use client';

import { FinanceApprovalsWorkspace } from './finance-approvals-workspace';
import { useFinanceApprovalsPage } from './use-finance-approvals-page';

export function FinanceApprovalsPageClient() {
  const page = useFinanceApprovalsPage();

  if (!page.context || !page.queue) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Finanzas</p>
          <h1>{page.loadingSession || page.busy ? 'Cargando aprobaciones…' : 'No fue posible abrir aprobaciones'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <FinanceApprovalsWorkspace
      context={page.context}
      queue={page.queue}
      query={page.query}
      busy={page.busy}
      message={page.message}
      notice={page.notice}
      onQuery={page.setQuery}
      onSearch={page.search}
      onDecide={page.decide}
      onSignOut={page.signOut}
    />
  );
}
