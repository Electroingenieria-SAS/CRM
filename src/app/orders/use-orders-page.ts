'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseOrdersRepository } from '@/infrastructure/orders/supabase-orders-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CreateOrderInput,
  OrderDetailResponse,
  OrderListItem,
} from '@/modules/orders/application/order.schemas';
import { OrdersService } from '@/modules/orders/application/orders-service';
import type { OrdersFilterValues } from '@/modules/orders/ui/orders-filters';

const initialFilters: OrdersFilterValues = {
  search: '',
  status: '',
  orderType: '',
  route: '',
};

function useOrdersDependencies() {
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
  return { auth, sessionRepository, orders };
}

export function useOrdersPage() {
  const router = useRouter();
  const { auth, sessionRepository, orders } = useOrdersDependencies();
  const [context, setContext] = useState<SessionContext | null>(null);
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);

  const loadOrders = useCallback(async (nextFilters: OrdersFilterValues) => {
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
  }, [orders]);

  useEffect(() => {
    let active = true;
    async function boot() {
      if (!auth || !sessionRepository || !orders) {
        setMessage('Este entorno no tiene un backend de staging configurado.');
        setLoading(false);
        return;
      }
      if (!(await auth.getSession())) {
        router.replace('/login');
        return;
      }
      try {
        const [nextContext, firstPage] = await Promise.all([
          sessionRepository.load(),
          orders.list({ page: 1, pageSize: 50, includeHistory: true }),
        ]);
        if (active) {
          setContext(nextContext);
          setItems(firstPage.items);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'No fue posible iniciar el módulo.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void boot();
    return () => { active = false; };
  }, [auth, orders, router, sessionRepository]);

  async function createOrder(input: CreateOrderInput) {
    if (!orders) return;
    await orders.create(input, crypto.randomUUID());
    setCreating(false);
    await loadOrders(initialFilters);
  }

  async function openDetail(orderId: string) {
    if (!orders) return;
    setMessage(null);
    try {
      setDetail(await orders.get(orderId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar el pedido.');
    }
  }

  async function signOut() {
    await auth?.signOut();
    router.replace('/login');
  }

  return {
    context, items, filters, loading, creating, message, detail,
    setFilters, setCreating, setDetail,
    search: () => loadOrders(filters),
    createOrder, openDetail, signOut,
  };
}

export { initialFilters };
