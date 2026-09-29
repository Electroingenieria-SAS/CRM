'use client';

import { useCallback } from 'react';
import type { LogisticsBrowserApplication } from '@/composition/logistics-browser-application';
import type {
  LogisticsCandidates,
  LogisticsDetail,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';
import type { LogisticsQueueQuery } from '@/modules/logistics/ports/logistics-ports';

interface LoaderDependencies {
  application: LogisticsBrowserApplication | null;
  candidateSearch: string;
  query: LogisticsQueueQuery;
  detail: LogisticsDetail | null;
  setCandidates(value: LogisticsCandidates): void;
  setQueue(value: LogisticsQueue): void;
  setDetail(value: LogisticsDetail | null): void;
  setQuery(value: LogisticsQueueQuery): void;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
  setNotice(value: string | null): void;
}

export function useLogisticsLoaders(deps: LoaderDependencies) {
  const refresh = useCallback(async () => {
    if (!deps.application) return;
    const [candidates, queue] = await Promise.all([
      deps.application.logistics.candidates(deps.candidateSearch, 1, 25),
      deps.application.logistics.list(deps.query),
    ]);
    deps.setCandidates(candidates);
    deps.setQueue(queue);
    if (deps.detail) {
      deps.setDetail(await deps.application.logistics.detail(deps.detail.order.id));
    }
  }, [deps]);

  const execute = useCallback(async (operation: () => Promise<unknown>, success: string) => {
    deps.setBusy(true);
    deps.setMessage(null);
    deps.setNotice(null);
    try {
      await operation();
      deps.setNotice(success);
      await refresh();
    } catch (error) {
      deps.setMessage(
        error instanceof Error ? error.message : 'No fue posible completar la operación.',
      );
    } finally {
      deps.setBusy(false);
    }
  }, [deps, refresh]);

  const loadQueue = useCallback(async (query: LogisticsQueueQuery) => {
    if (!deps.application) return;
    deps.setBusy(true);
    deps.setMessage(null);
    try {
      const normalized = { ...query, page: 1, pageSize: 25 };
      deps.setQuery(normalized);
      deps.setQueue(await deps.application.logistics.list(normalized));
    } catch (error) {
      deps.setMessage(error instanceof Error ? error.message : 'No fue posible filtrar logística.');
    } finally {
      deps.setBusy(false);
    }
  }, [deps]);

  const openDetail = useCallback(async (orderId: string) => {
    if (!deps.application) return;
    deps.setBusy(true);
    deps.setMessage(null);
    try {
      deps.setDetail(await deps.application.logistics.detail(orderId));
    } catch (error) {
      deps.setMessage(error instanceof Error ? error.message : 'No fue posible abrir el despacho.');
    } finally {
      deps.setBusy(false);
    }
  }, [deps]);

  return { execute, loadQueue, openDetail };
}
