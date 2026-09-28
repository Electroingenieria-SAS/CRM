'use client';

import { OrdersWorkspaceView } from './orders-workspace-view';
import { useOrdersPage } from './use-orders-page';

export function OrdersPageClient() {
  const page = useOrdersPage();

  if (!page.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM</p>
          <h1>
            {page.loading ? 'Cargando tu espacio de trabajo…' : 'No fue posible abrir Pedidos'}
          </h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <OrdersWorkspaceView
      context={page.context}
      items={page.items}
      filters={page.filters}
      loading={page.loading}
      creating={page.creating}
      message={page.message}
      notice={page.notice}
      detail={page.detail}
      workflowBusy={page.workflowBusy}
      onFiltersChange={page.setFilters}
      onSearch={page.search}
      onStartCreate={() => page.setCreating(true)}
      onCancelCreate={() => page.setCreating(false)}
      onCreate={page.createOrder}
      onOpenDetail={(orderId) => void page.openDetail(orderId)}
      onCloseDetail={() => page.setDetail(null)}
      onWorkflowSimpleAction={page.simpleAction}
      onAssign={page.assign}
      onBlock={page.block}
      onResume={page.resume}
      onCreateIssue={page.createIssue}
      onAddEvidence={page.addEvidence}
      onCancel={page.cancel}
      onReopen={page.reopen}
      onResolveIssue={page.resolveIssue}
      onSignOut={page.signOut}
    />
  );
}
