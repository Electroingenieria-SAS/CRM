'use client';

import type { Dispatch, SetStateAction } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  InventoryList as InventoryListResponse,
  InventoryLocation,
  InventoryMaterialDetail,
} from '@/modules/inventory/application/inventory.schemas';
import { InventoryDetail } from '@/modules/inventory/ui/inventory-detail';
import { InventoryList } from '@/modules/inventory/ui/inventory-list';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from '@/modules/inventory/ui/inventory-ui.module.css';

interface Props {
  context: SessionContext;
  locations: InventoryLocation[];
  list: InventoryListResponse;
  detail: InventoryMaterialDetail | null;
  search: string;
  locationId: string;
  loading: boolean;
  busy: boolean;
  message: string | null;
  notice: string | null;
  setSearch: Dispatch<SetStateAction<string>>;
  setLocationId: Dispatch<SetStateAction<string>>;
  searchNow(): Promise<void>;
  goPage(page: number): Promise<void>;
  openDetail(materialId: string, variantId?: string): Promise<void>;
  closeDetail(): void;
  receive(input: { locationId: string; quantity: number; reference?: string; reason?: string }): Promise<void>;
  reserve(input: { orderNumber: string; locationId?: string; quantity: number; reference?: string }): Promise<void>;
  adjust(balanceId: string, delta: number, reason: string): Promise<void>;
  submitCount(balanceId: string, countedQuantity: number, note: string): Promise<void>;
  signOut(): Promise<void>;
}

function navigation(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) items.push({ href: '/orders', label: 'Pedidos' });
  items.push({ href: '/inventory', label: 'Inventario', current: true });
  if (hasModuleCapability(context, 'workforce', 'read')) items.push({ href: '/workforce', label: 'Jornada' });
  return items;
}

export function InventoryWorkspace(props: Props) {
  const canCreate = hasModuleCapability(props.context, 'inventory', 'create');
  const canApprove =
    hasModuleCapability(props.context, 'inventory', 'approve') ||
    hasModuleCapability(props.context, 'inventory', 'admin');

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigation(props.context)}
      onSignOut={props.signOut}
    >
      <div className={styles.workspace}>
        <header className={styles.pageHeader}>
          <div>
            <p className="eyebrow">Operación · Inventario</p>
            <h1>Inventario y trazabilidad</h1>
            <p>Existencia física, reservas, material comprometido y movimientos auditables.</p>
          </div>
        </header>

        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            void props.searchNow();
          }}
          role="search"
        >
          <label>
            Buscar material
            <input
              value={props.search}
              onChange={(event) => props.setSearch(event.target.value)}
              placeholder="Referencia, material, variante o ubicación"
            />
          </label>
          <label>
            Ubicación
            <select value={props.locationId} onChange={(event) => props.setLocationId(event.target.value)}>
              <option value="">Todas</option>
              {props.locations.map((location) => (
                <option value={location.id} key={location.id}>{location.code} · {location.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={props.loading}>Buscar</button>
        </form>

        {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}
        {props.message ? <p className={styles.error} role="alert">{props.message}</p> : null}
        {props.loading ? <p role="status">Actualizando inventario…</p> : null}

        {!props.loading ? (
          <>
            <InventoryList
              data={props.list}
              loading={props.busy}
              onOpen={(materialId, variantId) => void props.openDetail(materialId, variantId)}
            />
            <nav className={styles.pagination} aria-label="Paginación de inventario">
              <button
                type="button"
                disabled={props.list.pagination.page<=1}
                onClick={() => void props.goPage(props.list.pagination.page-1)}
              >
                Anterior
              </button>
              <span>
                Página {props.list.pagination.page} de {Math.max(props.list.pagination.totalPages,1)}
              </span>
              <button
                type="button"
                disabled={props.list.pagination.page>=props.list.pagination.totalPages}
                onClick={() => void props.goPage(props.list.pagination.page+1)}
              >
                Siguiente
              </button>
            </nav>
          </>
        ) : null}

        {props.detail ? (
          <InventoryDetail
            detail={props.detail}
            locations={props.locations}
            busy={props.busy}
            canCreate={canCreate}
            canApprove={canApprove}
            onClose={props.closeDetail}
            onReceive={props.receive}
            onReserve={props.reserve}
            onAdjust={props.adjust}
            onCount={props.submitCount}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
