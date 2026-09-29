'use client';

import { useEffect } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { LogisticsBrowserApplication } from '@/composition/logistics-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { FreightCatalog } from '@/modules/freight/application/freight-catalog.schemas';
import type {
  LogisticsCandidates,
  LogisticsQueue,
} from '@/modules/logistics/application/logistics.schemas';

interface BootstrapSetters {
  setContext(value: SessionContext): void;
  setCandidates(value: LogisticsCandidates): void;
  setQueue(value: LogisticsQueue): void;
  setCatalog(value: FreightCatalog): void;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
}

async function loadInitial(application: LogisticsBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  const [candidates, queue, catalog] = await Promise.all([
    application.logistics.candidates(undefined, 1, 25),
    application.logistics.list({ page: 1, pageSize: 25 }),
    application.freight.getCatalog(),
  ]);
  return { context, candidates, queue, catalog };
}

export function useLogisticsBootstrap(
  application: LogisticsBrowserApplication | null,
  router: AppRouterInstance,
  setters: BootstrapSetters,
) {
  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void loadInitial(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) return router.replace('/login');
        setters.setContext(workspace.context);
        setters.setCandidates(workspace.candidates);
        setters.setQueue(workspace.queue);
        setters.setCatalog(workspace.catalog);
      })
      .catch((error) => {
        if (active) {
          setters.setMessage(
            error instanceof Error ? error.message : 'No fue posible abrir Logística.',
          );
        }
      })
      .finally(() => {
        if (active) setters.setBusy(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router, setters]);
}
