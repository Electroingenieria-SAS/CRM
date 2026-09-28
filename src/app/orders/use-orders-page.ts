'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserApplication,
  type BrowserApplication,
} from '@/composition/browser-application';
import type {
  CreateOrderInput,
  OrderDetailResponse,
  OrderListItem,
} from '@/modules/orders/application/order.schemas';
import type { OrdersFilterValues } from '@/modules/orders/ui/orders-filters';
import { useOrderWorkflowActions } from './use-order-workflow-actions';
import { useOrdersBootstrap } from './use-orders-bootstrap';

const initialFilters: OrdersFilterValues = {
  search: '',
  status: '',
  orderType: '',
  route: '',
};

interface OrderActionsDependencies {
  application: BrowserApplication | null;
  refresh(): Promise<void>;
  closeCreation(): void;
  showDetail(detail: OrderDetailResponse): void;
  showMessage(message: string | null): void;
  showNotice(message: string | null): void;
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
      dependencies.showNotice(`Pedido ${input.orderNumber} creado correctamente.`);
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
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);

  const loadOrders = useCallback(
    async (nextFilters: OrdersFilterValues) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      setNotice(null);
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
    },
    [application],
  );

  useOrdersBootstrap({
    application,
    setContext,
    setItems,
    setMessage,
    setLoading,
    goToLogin: () => router.replace('/login'),
  });

  const reloadOrder = useCallback(
    async (orderId: string) => {
      if (!application) return;
      setDetail(await application.orders.get(orderId));
    },
    [application],
  );

  const actions = createOrderActions({
    application,
    refresh: () => loadOrders(initialFilters),
    closeCreation: () => setCreating(false),
    showDetail: setDetail,
    showMessage: setMessage,
    showNotice: setNotice,
    goToLogin: () => router.replace('/login'),
  });

  const workflow = useOrderWorkflowActions({
    application,
    detail,
    reloadOrder,
    reloadList: () => loadOrders(filters),
    showMessage: setMessage,
    showNotice: setNotice,
  });

  const unavailable = !application;

  return {
    context,
    items,
    filters,
    loading: unavailable ? false : loading,
    creating,
    message: unavailable ? 'Este entorno no tiene un backend de staging configurado.' : message,
    notice,
    detail,
    setFilters,
    setCreating,
    setDetail,
    search: () => loadOrders(filters),
    ...actions,
    ...workflow,
  };
}

export { initialFilters };
