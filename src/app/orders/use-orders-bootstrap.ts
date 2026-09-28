'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { BrowserApplication } from '@/composition/browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { OrderListItem } from '@/modules/orders/application/order.schemas';

interface BootstrapDependencies {
  application: BrowserApplication | null;
  setContext: Dispatch<SetStateAction<SessionContext | null>>;
  setItems: Dispatch<SetStateAction<OrderListItem[]>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  goToLogin(): void;
}

async function loadInitialWorkspace(application: BrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;

  const response = await application.orders.list({
    page: 1,
    pageSize: 50,
    includeHistory: true,
  });

  return { context, items: response.items };
}

export function useOrdersBootstrap(dependencies: BootstrapDependencies) {
  useEffect(() => {
    const { application } = dependencies;
    if (!application) return;

    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') dependencies.goToLogin();
    });

    void loadInitialWorkspace(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          dependencies.goToLogin();
          return;
        }
        dependencies.setContext(workspace.context);
        dependencies.setItems(workspace.items);
      })
      .catch((error) => {
        if (active) {
          dependencies.setMessage(
            error instanceof Error ? error.message : 'No fue posible iniciar el módulo.',
          );
        }
      })
      .finally(() => {
        if (active) dependencies.setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [dependencies]);
}
