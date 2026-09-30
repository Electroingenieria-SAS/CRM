'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { SupplyArea, SupplyQueue } from '@/modules/supply/application/supply.schemas';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from '@/modules/supply/ui/supply-ui.module.css';

const labels: Record<SupplyArea, string> = {
  PURCHASING: 'Compras',
  RECEIVING: 'Recepción',
  PICKING: 'Alistamiento',
  CUTTING: 'Corte',
};

interface Props {
  context: SessionContext;
  areas: SupplyArea[];
  area: SupplyArea;
  queue: SupplyQueue;
  status: string;
  search: string;
  loading: boolean;
  message: string | null;
  setArea(area: SupplyArea): void;
  setStatus: Dispatch<SetStateAction<string>>;
  setSearch: Dispatch<SetStateAction<string>>;
  searchNow(): Promise<void>;
  goPage(page: number): Promise<void>;
  signOut(): Promise<void>;
}

function navigation(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) {
    items.push({ href: '/orders', label: 'Pedidos' });
  }
  items.push({ href: '/supply', label: 'Operación', current: true });
  if (hasModuleCapability(context, 'inventory', 'read')) {
    items.push({ href: '/inventory', label: 'Inventario' });
  }
  if (hasModuleCapability(context, 'workforce', 'read')) {
    items.push({ href: '/workforce', label: 'Jornada' });
  }
  return items;
}

function SupplyQueueSection({ area, queue }: Pick<Props, 'area' | 'queue'>) {
  return (
    <section aria-labelledby="supply-queue-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="supply-queue-title">{labels[area]}</h2>
          <p>{queue.pagination.totalItems} registros en la cola.</p>
        </div>
        <Link href="/orders">Abrir pedidos</Link>
      </div>
      {queue.items.length ? (
        <div className={styles.grid}>
          {queue.items.map((item) => (
            <article className={styles.card} key={item.id}>
              <div className={styles.cardTop}>
                <strong>
                  {item.orderNumber ?? item.reference ?? 'Operación independiente'}
                </strong>
                <span>{item.status}</span>
              </div>
              {item.clientName ? <p>{item.clientName}</p> : null}
              {item.reference ? <small>Referencia: {item.reference}</small> : null}
              {item.assignedTo ? <small>Responsable: {item.assignedTo}</small> : null}
              <small>
                Actualizado: {new Date(item.updatedAt).toLocaleString('es-CO')}
              </small>
              {item.orderId ? (
                <Link href={`/orders?order=${item.orderId}`}>Ver pedido</Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <h3>Sin pendientes</h3>
          <p>No hay registros que coincidan con los filtros actuales.</p>
        </div>
      )}
    </section>
  );
}

function SupplyPagination({
  queue,
  loading,
  goPage,
}: Pick<Props, 'queue' | 'loading' | 'goPage'>) {
  const { pagination } = queue;
  return (
    <footer className={styles.pagination} aria-label="Paginación">
      <button
        type="button"
        disabled={pagination.page <= 1 || loading}
        onClick={() => void goPage(pagination.page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {pagination.page} de {Math.max(pagination.totalPages, 1)}
      </span>
      <button
        type="button"
        disabled={pagination.page >= pagination.totalPages || loading}
        onClick={() => void goPage(pagination.page + 1)}
      >
        Siguiente
      </button>
    </footer>
  );
}

export function SupplyWorkspace(props: Props) {
  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigation(props.context)}
      onSignOut={props.signOut}
    >
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Operación · Materiales</p>
            <h1>Compras, recepción, alistamiento y corte</h1>
            <p>
              Flujo físico conectado con Pedidos, Inventario y Workforce sin duplicar existencias.
            </p>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="Áreas operativas">
          {props.areas.map((item) => (
            <button
              key={item}
              type="button"
              aria-current={props.area === item ? 'page' : undefined}
              className={props.area === item ? styles.activeTab : undefined}
              onClick={() => props.setArea(item)}
            >
              {labels[item]}
            </button>
          ))}
        </nav>

        <section className={styles.filters} aria-label="Filtros de cola">
          <label>
            Buscar
            <input
              value={props.search}
              onChange={(event) => props.setSearch(event.target.value)}
              placeholder="Pedido, cliente o referencia"
            />
          </label>
          <label>
            Estado
            <input
              value={props.status}
              onChange={(event) => props.setStatus(event.target.value)}
              placeholder="Ej. OPEN"
            />
          </label>
          <button
            type="button"
            disabled={props.loading}
            onClick={() => void props.searchNow()}
          >
            {props.loading ? 'Consultando…' : 'Buscar'}
          </button>
        </section>

        {props.message ? (
          <p role="alert" className={styles.message}>
            {props.message}
          </p>
        ) : null}
        <SupplyQueueSection area={props.area} queue={props.queue} />
        <SupplyPagination
          queue={props.queue}
          loading={props.loading}
          goPage={props.goPage}
        />
      </div>
    </AppShell>
  );
}
