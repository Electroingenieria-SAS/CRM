'use client';

import { LogisticsWorkspace } from './logistics-workspace';
import { useLogisticsPage } from './use-logistics-page';

export function LogisticsPageClient() {
  const page = useLogisticsPage();

  if (!page.context || !page.candidates || !page.queue || !page.catalog) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">Operación</p>
          <h1>{page.busy ? 'Cargando Logística…' : 'No fue posible abrir Logística'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <LogisticsWorkspace
      context={page.context}
      candidates={page.candidates}
      queue={page.queue}
      catalog={page.catalog}
      detail={page.detail}
      prediction={page.prediction}
      query={page.query}
      candidateSearch={page.candidateSearch}
      busy={page.busy}
      message={page.message}
      notice={page.notice}
      onQuery={page.setQuery}
      onCandidateSearch={page.setCandidateSearch}
      onSearchCandidates={page.searchCandidates}
      onSearchQueue={page.searchQueue}
      onOpenDetail={page.openDetail}
      onEstimate={page.estimate}
      onRelease={page.release}
      onSaveGuide={page.saveGuide}
      onDispatch={page.dispatch}
      onSetActualCost={page.setActualCost}
      onDeliver={page.deliverWithFile}
      onFail={page.failDelivery}
      onReprogram={page.reprogram}
      onReturn={page.returnWithFile}
      onSatisfaction={page.satisfaction}
      onSignOut={page.signOut}
    />
  );
}
