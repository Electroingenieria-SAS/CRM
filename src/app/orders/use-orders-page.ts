'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserApplication,
  type BrowserApplication,
} from '@/composition/browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CreateOrderInput,
  OrderDetailResponse,
  OrderListItem,
} from '@/modules/orders/application/order.schemas';
import type { OrdersFilterValues } from '@/modules/orders/ui/orders-filters';

const initialFilters: OrdersFilterValues = {
  search: '',
  status: '',
  orderType: '',
  route: '',
};

async function loadInitialWorkspace(application: BrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;

  const firstPage = await application.orders.list({
    page: 1,
    pageSize: 50,
    includeHistory: true,
  });

  return { context, items: firstPage.items };
}

interface OrderActionsDependencies {
  application: BrowserApplication | null;
  refresh(): Promise<void>;
  closeCreation(): void;
  showDetail(detail: OrderDetailResponse): void;
  showMessage(message: string | null): void;
  goToLogin(): void;
}

function createOrderActions(dependencies: OrderActionsDependencies) {
  const { application } = dependencies;

  return {
    createOrder: async (input: CreateOrderInput) => {
      if (!application) return;
      await application.orders.create(input, crypto.randomUUID());
      dependencies.closeCreation();
      await dependencies.refresh();
    },
    openDetail: async (orderId: string) => {
      if (!application) return;
      dependencies.showMessage(null);
      try {
        dependencies.showDetail(await application.orders.get(orderId));
      } catch (error) {
        dependencies.showMessage(
          error instanceof Error ? error.message : 'No fue posible cargar el pedido.',
        );
      }
    },
    signOut: async () => {
      await application?.auth.signOut();
      dependencies.goToLogin();
    },
  };
}

export function useOrdersPage() {
  const router = useRouter();
  const application = useMemo(() => createBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);

  const loadOrders = useCallback(async (nextFilters: OrdersFilterValues) => {
    if (!application) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await application.orders.list({
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
  }, [application]);

  useEffect(() => {
    if (!application) return;

    const app = application;
    let active = true;
    const unsubscribe = app.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void loadInitialWorkspace(app)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          router.replace('/login');
          return;
        }
        setContext(workspace.context);
        setItems(workspace.items);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible iniciar el módulo.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router]);

  const actions = createOrderActions({
    application,
    refresh: () => loadOrders(initialFilters),
    closeCreation: () => setCreating(false),
    showDetail: setDetail,
    showMessage: setMessage,
    goToLogin: () => router.replace('/login'),
  });
  const unavailable = !application;

  return {
    context,
    items,
    filters,
    loading: unavailable ? false : loading,
    creating,
    message: unavailable ? 'Este entorno no tiene un backend de staging configurado.' : message,
    detail,
    setFilters,
    setCreating,
    setDetail,
    search: () => loadOrders(filters),
    ...actions,
  };
}

export { initialFilters };
