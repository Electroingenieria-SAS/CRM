'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseOrdersRepository } from '@/infrastructure/orders/supabase-orders-repository';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import { OrdersService } from '@/modules/orders/application/orders-service';
import type { CreateOrderInput, OrderListItem } from '@/modules/orders/application/order.schemas';
import { AppShell } from '@/shared/ui/app-shell';
import { CreateOrderForm } from '@/modules/orders/ui/create-order-form';
import { OrdersFilters, type OrdersFilterValues } from '@/modules/orders/ui/orders-filters';
import { OrdersList } from '@/modules/orders/ui/orders-list';
import styles from './orders-page.module.css';

const initialFilters: OrdersFilterValues = {
  search: '',
  status: '',
  orderType: '',
  route: '',
};

function catalogOptions(rows: Array<Record<string, unknown>>) {
  return rows.flatMap((row) =>
    typeof row.code === 'string' && typeof row.name === 'string'
      ? [{ code: row.code, name: row.name }]
      : [],
  );
}

export function OrdersPageClient() {
  const router = useRouter();
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const auth = useMemo(() => (client ? new SupabaseAuthGateway(client) : null), [client]);
  const sessionRepository = useMemo(
    () => (client ? new SupabaseSessionRepository(client) : null),
    [client],
  );
  const orders = useMemo(
    () => (client ? new OrdersService(new SupabaseOrdersRepository(client)) : null),
    [client],
  );

  const [context, setContext] = useState<SessionContext | null>(null);
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadOrders = useCallback(
    async (nextFilters: OrdersFilterValues = filters) => {
      if (!orders) return;
      setLoading(true);
      setMessage(null);
      try {
        const response = await orders.list({
          ...nextFilters,
          page: 1,
          pageSize: 50,
          includeHistory: true,
        });
        setItems(response.items);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible cargar los pedidos.');
      } finally {
        setLoading(false);
      }
    },
    [filters, orders],
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!auth || !sessionRepository || !orders) {
        setMessage('Este entorno no tiene un backend de staging configurado.');
        setLoading(false);
        return;
      }

      const authSession = await auth.getSession();
      if (!authSession) {
        router.replace('/login');
        return;
      }

      try {
        const nextContext = await sessionRepository.load();
        const firstPage = await orders.list({ page: 1, pageSize: 50, includeHistory: true });
        if (!cancelled) {
          setContext(nextContext);
          setItems(firstPage.items);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'No fue posible iniciar el módulo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [auth, orders, router, sessionRepository]);

  if (!context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-live="polite">
          <p className="eyebrow">CRM</p>
          <h1>{loading ? 'Cargando tu espacio de trabajo…' : 'No fue posible abrir Pedidos'}</h1>
          {message ? <p>{message}</p> : null}
        </section>
      </main>
    );
  }

  const orderModule = context.modules.find((module) => module.code === 'orders');
  const canCreate = Boolean(orderModule?.canCreate);

  return (
    <AppShell
      userName={context.profile.name}
      organizationName={context.organization.name}
      onSignOut={async () => {
        await auth?.signOut();
        router.replace('/login');
      }}
    >
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">Operación de suministros</p>
          <h1>Control integral de pedidos</h1>
          <p>Consulta, filtra y registra pedidos con trazabilidad desde la primera operación.</p>
        </div>
        {canCreate ? (
          <button className="primary-button" type="button" onClick={() => setCreating(true)}>
            Crear pedido
          </button>
        ) : null}
      </header>

      {creating && canCreate ? (
        <CreateOrderForm
          orderTypes={catalogOptions(context.catalogs.orderTypes)}
          paymentConditions={catalogOptions(context.catalogs.paymentConditions)}
          deliveryRoutes={catalogOptions(context.catalogs.deliveryRoutes)}
          onCancel={() => setCreating(false)}
          onCreate={async (input: CreateOrderInput) => {
            if (!orders) return;
            await orders.create(input, crypto.randomUUID());
            setCreating(false);
            await loadOrders(initialFilters);
          }}
        />
      ) : null}

      <section className={styles.workspace} aria-labelledby="orders-list-title">
        <div className={styles.workspaceHeader}>
          <div>
            <h2 id="orders-list-title">Lista de pedidos</h2>
            <p>La prioridad mostrada es automática; no existe selector manual en creación.</p>
          </div>
          <span>{items.length} visible{items.length === 1 ? '' : 's'}</span>
        </div>

        <OrdersFilters
          value={filters}
          onChange={setFilters}
          onSubmit={() => void loadOrders(filters)}
        />

        {message ? <p className={styles.message} role="alert">{message}</p> : null}
        {loading ? <p className={styles.loading} role="status">Consultando la operación…</p> : <OrdersList items={items} />}
      </section>
    </AppShell>
  );
}
