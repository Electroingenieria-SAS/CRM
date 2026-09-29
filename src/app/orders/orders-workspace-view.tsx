'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FinancialGate } from '@/modules/finance/application/finance.schemas';
import type {
  CreateOrderInput,
  OrderDetailResponse,
  OrderListItem,
} from '@/modules/orders/application/order.schemas';
import { CreateOrderForm } from '@/modules/orders/ui/create-order-form';
import { OrderDetail } from '@/modules/orders/ui/order-detail';
import { OrdersFilters, type OrdersFilterValues } from '@/modules/orders/ui/orders-filters';
import { OrdersList } from '@/modules/orders/ui/orders-list';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from './orders-page.module.css';

interface OrdersWorkspaceViewProps {
  context: SessionContext;
  items: OrderListItem[];
  filters: OrdersFilterValues;
  loading: boolean;
  creating: boolean;
  message: string | null;
  notice: string | null;
  detail: OrderDetailResponse | null;
  financialGate: FinancialGate | null;
  workflowBusy: boolean;
  onFiltersChange(filters: OrdersFilterValues): void;
  onSearch(): void;
  onStartCreate(): void;
  onCancelCreate(): void;
  onCreate(input: CreateOrderInput): Promise<void>;
  onOpenDetail(orderId: string): void;
  onCloseDetail(): void;
  onWorkflowSimpleAction(action: 'CLAIM' | 'START' | 'COMPLETE'): Promise<void>;
  onAssign(profileId: string): Promise<void>;
  onBlock(reasonCode: string, detail: string): Promise<void>;
  onResume(resolution: string): Promise<void>;
  onCreateIssue(input: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    blocking: boolean;
    title: string;
    description: string;
  }): Promise<void>;
  onAddEvidence(input: {
    evidenceType: string;
    storageReference: string;
    fileName?: string;
  }): Promise<void>;
  onCancel(reason: string): Promise<void>;
  onReopen(targetStep: string, reason: string): Promise<void>;
  onResolveIssue(issueId: string, resolution: string): Promise<void>;
  onSignOut(): Promise<void>;
}

function catalogOptions(rows: Array<Record<string, unknown>>) {
  return rows.flatMap((row) =>
    typeof row.code === 'string' && typeof row.name === 'string'
      ? [{ code: row.code, name: row.name }]
      : [],
  );
}

function navigationFor(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [{ href: '/orders', label: 'Pedidos', current: true }];

  if (hasModuleCapability(context, 'dashboard', 'read')) {
    items.unshift({ href: '/analytics', label: 'Panel' });
  }

  if (hasModuleCapability(context, 'freight', 'read')) {
    items.push({ href: '/freight', label: 'Fletes' });
  }
  if (hasModuleCapability(context, 'workforce', 'read')) {
    items.push({ href: '/workforce', label: 'Jornada' });
  }
  if (hasModuleCapability(context, 'credit', 'read')) {
    items.push({ href: '/finance/credit', label: 'Crédito' });
  }
  if (hasModuleCapability(context, 'cartera', 'read')) {
    items.push({ href: '/finance/receivables', label: 'Cartera' });
  }
  if (hasModuleCapability(context, 'caja', 'read')) {
    items.push({ href: '/finance/cash', label: 'Caja' });
  }
  if (hasModuleCapability(context, 'approvals', 'read')) {
    items.push({ href: '/finance/approvals', label: 'Aprobaciones' });
  }

  return items;
}

export function OrdersWorkspaceView(props: OrdersWorkspaceViewProps) {
  const canCreate = hasModuleCapability(props.context, 'orders', 'create');

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigationFor(props.context)}
      onSignOut={props.onSignOut}
    >
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">Operación de suministros</p>
          <h1>Control integral de pedidos</h1>
          <p>Consulta, filtra y registra pedidos con trazabilidad desde la primera operación.</p>
        </div>
        {canCreate ? (
          <button className="primary-button" type="button" onClick={props.onStartCreate}>
            Crear pedido
          </button>
        ) : null}
      </header>

      {props.creating && canCreate ? (
        <CreateOrderForm
          orderTypes={catalogOptions(props.context.catalogs.orderTypes)}
          paymentConditions={catalogOptions(props.context.catalogs.paymentConditions)}
          deliveryRoutes={catalogOptions(props.context.catalogs.deliveryRoutes)}
          onCancel={props.onCancelCreate}
          onCreate={props.onCreate}
        />
      ) : null}

      <section className={styles.workspace} aria-labelledby="orders-list-title">
        <div className={styles.workspaceHeader}>
          <div>
            <h2 id="orders-list-title">Lista de pedidos</h2>
            <p>La prioridad mostrada es automática; no existe selector manual en creación.</p>
          </div>
          <span>
            {props.items.length} visible{props.items.length === 1 ? '' : 's'}
          </span>
        </div>
        <OrdersFilters
          value={props.filters}
          orderTypes={catalogOptions(props.context.catalogs.orderTypes)}
          deliveryRoutes={catalogOptions(props.context.catalogs.deliveryRoutes)}
          onChange={props.onFiltersChange}
          onSubmit={props.onSearch}
        />
        {props.notice ? (
          <p className={styles.message} role="status">
            {props.notice}
          </p>
        ) : null}
        {props.message ? (
          <p className={styles.message} role="alert">
            {props.message}
          </p>
        ) : null}
        {props.loading ? (
          <p className={styles.loading} role="status">
            Consultando la operación…
          </p>
        ) : (
          <OrdersList items={props.items} onSelect={props.onOpenDetail} />
        )}
      </section>

      {props.detail ? (
        <OrderDetail
          detail={props.detail}
          financialGate={props.financialGate}
          busy={props.workflowBusy}
          onClose={props.onCloseDetail}
          onSimpleAction={props.onWorkflowSimpleAction}
          onAssign={props.onAssign}
          onBlock={props.onBlock}
          onResume={props.onResume}
          onCreateIssue={props.onCreateIssue}
          onAddEvidence={props.onAddEvidence}
          onCancel={props.onCancel}
          onReopen={props.onReopen}
          onResolveIssue={props.onResolveIssue}
        />
      ) : null}
    </AppShell>
  );
}
