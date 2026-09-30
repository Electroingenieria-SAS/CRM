'use client';

import { SupplyWorkspace } from '@/app/supply/supply-workspace';
import { useSupplyPage } from '@/app/supply/use-supply-page';

export function SupplyPageClient() {
  const page = useSupplyPage();

  if (!page.context || !page.queue) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM · Operación de materiales</p>
          <h1>{page.loading ? 'Cargando operación…' : 'No fue posible abrir el módulo'}</h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return <SupplyWorkspace {...page} context={page.context} queue={page.queue} />;
}
