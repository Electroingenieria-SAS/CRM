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
import {
  InventoryFeedback,
  InventoryFilters,
  InventoryPagination,
} from '@/app/inventory/inventory-workspace-controls';
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
  receive(input: {
    locationId: string;
    quantity: number;
    reference?: string;
    reason?: string;
  }): Promise<void>;
  reserve(input: {
    orderNumber: string;
    locationId?: string;
    quantity: number;
    reference?: string;
  }): Promise<void>;
  release(reservationId: string, reason: string): Promise<void>;
  pick(reservationId: string): Promise<void>;
  consume(reservationId: string, reason: string): Promise<void>;
  returnReusable(reservationId: string, reason: string): Promise<void>;
  waste(reservationId: string, reason: string): Promise<void>;
  adjust(balanceId: string, delta: number, reason: string): Promise<void>;
  signOut(): Promise<void>;
}

function navigation(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) {
    items.push({ href: '/orders', label: 'Pedidos' });
  }
  items.push({ href: '/inventory', label: 'Inventario', current: true });
  if (hasModuleCapability(context, 'inventory', 'create')) {
    items.push({ href: '/inventory/counts', label: 'Conteos' });
  }
  if (hasModuleCapability(context, 'workforce', 'read')) {
    items.push({ href: '/workforce', label: 'Jornada' });
  }
  return items;
}

export function InventoryWorkspace(props: Props) {
  const canCreate = hasModuleCapability(props.context, 'inventory', 'create');
  const canUpdate = hasModuleCapability(props.context, 'inventory', 'update');
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

        <InventoryFilters
          search={props.search}
          locationId={props.locationId}
          locations={props.locations}
          loading={props.loading}
          setSearch={props.setSearch}
          setLocationId={props.setLocationId}
          searchNow={props.searchNow}
        />
        <InventoryFeedback notice={props.notice} message={props.message} loading={props.loading} />

        {!props.loading ? (
          <>
            <InventoryList
              data={props.list}
              loading={props.busy}
              onOpen={(materialId, variantId) => void props.openDetail(materialId, variantId)}
            />
            <InventoryPagination pagination={props.list.pagination} goPage={props.goPage} />
          </>
        ) : null}

        {props.detail ? (
          <InventoryDetail
            detail={props.detail}
            locations={props.locations}
            busy={props.busy}
            canCreate={canCreate}
            canApprove={canApprove}
            canUpdate={canUpdate}
            onClose={props.closeDetail}
            onReceive={props.receive}
            onReserve={props.reserve}
            onRelease={props.release}
            onPick={props.pick}
            onConsume={props.consume}
            onReturn={props.returnReusable}
            onWaste={props.waste}
            onAdjust={props.adjust}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
