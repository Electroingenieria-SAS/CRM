'use client';

import { WorkforceWorkspace } from '@/app/workforce/workforce-workspace';
import { useWorkforcePage } from '@/app/workforce/use-workforce-page';

export function WorkforcePageClient() {
  const page = useWorkforcePage();

  if (!page.context || !page.schedule) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM · Workforce</p>
          <h1>{page.loading ? 'Cargando jornada…' : 'No fue posible abrir Workforce'}</h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <WorkforceWorkspace
      context={page.context}
      catalog={page.catalog}
      schedule={page.schedule}
      indicators={page.indicators}
      detail={page.detail}
      mode={page.mode}
      anchor={page.anchor}
      creating={page.creating}
      loading={page.loading}
      busy={page.busy}
      message={page.message}
      notice={page.notice}
      onMode={page.setMode}
      onNavigate={page.navigate}
      onToday={page.goToday}
      onStartCreate={() => page.setCreating(true)}
      onCancelCreate={() => page.setCreating(false)}
      onCreate={page.create}
      onOpen={(activityId) => void page.openDetail(activityId)}
      onCloseDetail={() => page.setDetail(null)}
      onAssign={page.assign}
      onStart={page.start}
      onBlock={page.block}
      onResume={page.resume}
      onComplete={page.complete}
      onCancel={page.cancel}
      onUpload={page.upload}
      onSignOut={page.signOut}
    />
  );
}
