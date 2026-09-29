'use client';

import { InventoryCountWorkspace } from '@/app/inventory/counts/inventory-count-workspace';
import { useInventoryCountPage } from '@/app/inventory/counts/use-inventory-count-page';

export function InventoryCountPageClient() {
  const page = useInventoryCountPage();

  if (!page.context || !page.data) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM · Inventario</p>
          <h1>{page.loading ? 'Cargando conteos…' : 'No fue posible abrir Conteos'}</h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return <InventoryCountWorkspace {...page} />;
}
