'use client';

import { OrdersWorkforceWorkspace } from './orders-workforce-workspace';
import { useOrdersWorkforcePage } from './use-orders-workforce-page';

export function OrdersWorkforcePageClient() {
  const page = useOrdersWorkforcePage();

  if (!page.context || !page.health || !page.indicators) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Orders ↔ Workforce</p>
          <h1>{page.loading ? 'Cargando integración…' : 'No fue posible abrir la integración'}</h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <OrdersWorkforceWorkspace
      context={page.context}
      health={page.health}
      indicators={page.indicators}
      repairing={page.repairing}
      message={page.message}
      notice={page.notice}
      canRepair={page.canRepair}
      onReconcile={page.reconcile}
      onSignOut={page.signOut}
    />
  );
}
