'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserApplication,
  type BrowserApplication,
} from '@/composition/browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type {
  FreightHistoryResponse,
  FreightMetrics,
} from '@/modules/freight/application/freight-history.schemas';
import type {
  FreightPredictionInput,
  FreightPredictionResult,
} from '@/modules/freight/application/freight-prediction.schemas';
import type { FreightHistoryQuery } from '@/modules/freight/application/freight-repository';

const initialHistoryFilters: FreightHistoryQuery = { page: 1, pageSize: 25 };

async function loadWorkspace(application: BrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;

  const [catalog, history, metrics] = await Promise.all([
    application.freight.getCatalog(),
    application.freight.listHistory(initialHistoryFilters),
    application.freight.getMetrics(),
  ]);

  return { context, catalog, history, metrics };
}

export function useFreightPage() {
  const router = useRouter();
  const application = useMemo(() => createBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [catalog, setCatalog] = useState<FreightCatalog | null>(null);
  const [history, setHistory] = useState<FreightHistoryResponse | null>(null);
  const [metrics, setMetrics] = useState<FreightMetrics | null>(null);
  const [historyFilters, setHistoryFilters] = useState(initialHistoryFilters);
  const [results, setResults] = useState<FreightPredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (query: FreightHistoryQuery) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        const response = await application.freight.listHistory(query);
        setHistory(response);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible consultar el histórico.');
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

    void loadWorkspace(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          router.replace('/login');
          return;
        }
        setContext(workspace.context);
        setCatalog(workspace.catalog);
        setHistory(workspace.history);
        setMetrics(workspace.metrics);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir Freight Intelligence.');
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

  async function predict(input: FreightPredictionInput) {
    if (!application) return;
    setPredicting(true);
    setMessage(null);
    try {
      const response = await application.freight.predict(input);
      setResults(response.results);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible estimar el flete.');
    } finally {
      setPredicting(false);
    }
  }

  function searchHistory() {
    void loadHistory({ ...historyFilters, page: 1 });
  }

  function pageHistory(page: number) {
    const next = { ...historyFilters, page };
    setHistoryFilters(next);
    void loadHistory(next);
  }

  async function signOut() {
    await application?.auth.signOut();
    router.replace('/login');
  }

  return {
    context,
    catalog,
    history,
    metrics,
    historyFilters,
    results,
    loading: application ? loading : false,
    predicting,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    setHistoryFilters,
    predict,
    searchHistory,
    pageHistory,
    signOut,
  };
}
