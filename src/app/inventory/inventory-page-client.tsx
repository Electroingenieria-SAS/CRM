'use client';

import { InventoryWorkspace } from '@/app/inventory/inventory-workspace';
import { useInventoryPage } from '@/app/inventory/use-inventory-page';

export function InventoryPageClient() {
  const page = useInventoryPage();
  const { context, list } = page;

  if (!context || !list) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM · Inventario</p>
          <h1>{page.loading ? 'Cargando inventario…' : 'No fue posible abrir Inventario'}</h1>
          {page.message ? <p>{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return <InventoryWorkspace {...page} context={context} list={list} />;
}
