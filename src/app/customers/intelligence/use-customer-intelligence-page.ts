'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserApplication,
  type BrowserApplication,
} from '@/composition/browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CustomerIntelligenceDetail,
  CustomerIntelligenceList,
  ParetoResponse,
} from '@/modules/customers/application/customer-intelligence.schemas';
import type { CustomerIntelligenceFilterValues } from '@/modules/customers/ui/customer-intelligence-filters';

export const initialCustomerFilters: CustomerIntelligenceFilterValues = {
  search: '',
  segment: '',
};

async function loadInitial(application: BrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;

  const [ranking, pareto] = await Promise.all([
    application.customerIntelligence.list({ page: 1, pageSize: 50 }),
    application.customerIntelligence.pareto(),
  ]);

  return { context, ranking, pareto };
}

export function useCustomerIntelligencePage() {
  const router = useRouter();
  const application = useMemo(() => createBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [ranking, setRanking] = useState<CustomerIntelligenceList | null>(null);
  const [pareto, setPareto] = useState<ParetoResponse | null>(null);
  const [detail, setDetail] = useState<CustomerIntelligenceDetail | null>(null);
  const [filters, setFilters] = useState(initialCustomerFilters);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRanking = useCallback(
    async (nextFilters: CustomerIntelligenceFilterValues) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        const response = await application.customerIntelligence.list({
          ...nextFilters,
          page: 1,
          pageSize: 50,
        });
        setRanking(response);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'No fue posible cargar el ranking de clientes.',
        );
      } finally {
        setLoading(false);
      }
    },
    [application],
  );

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void loadInitial(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          router.replace('/login');
          return;
        }
        setContext(workspace.context);
        setRanking(workspace.ranking);
        setPareto(workspace.pareto);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir el módulo.');
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

  async function openDetail(customerId: string) {
    if (!application) return;
    setMessage(null);
    try {
      setDetail(await application.customerIntelligence.detail(customerId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible abrir el cliente.');
    }
  }

  async function recalculate() {
    if (!application) return;
    setRecalculating(true);
    setMessage(null);
    setNotice(null);
    try {
      const result = await application.customerIntelligence.recalculate();
      const [nextRanking, nextPareto] = await Promise.all([
        application.customerIntelligence.list({ page: 1, pageSize: 50 }),
        application.customerIntelligence.pareto(),
      ]);
      setRanking(nextRanking);
      setPareto(nextPareto);
      setNotice(
        result.reused
          ? 'Los datos no cambiaron; se reutilizó el cálculo vigente.'
          : 'Ranking y Pareto recalculados correctamente.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible recalcular.');
    } finally {
      setRecalculating(false);
    }
  }

  async function signOut() {
    await application?.auth.signOut();
    router.replace('/login');
  }

  const unavailable = !application;

  return {
    context,
    ranking,
    pareto,
    detail,
    filters,
    loading: unavailable ? false : loading,
    recalculating,
    message: unavailable ? 'Este entorno no tiene un backend de staging configurado.' : message,
    notice,
    setFilters,
    closeDetail: () => setDetail(null),
    search: () => loadRanking(filters),
    openDetail,
    recalculate,
    signOut,
  };
}
