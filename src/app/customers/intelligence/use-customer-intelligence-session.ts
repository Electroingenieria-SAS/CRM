'use client';

import { useEffect } from 'react';
import type { BrowserApplication } from '@/composition/browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CustomerIntelligenceList,
  ParetoResponse,
} from '@/modules/customers/application/customer-intelligence.schemas';

export interface CustomerIntelligenceWorkspaceData {
  context: SessionContext;
  ranking: CustomerIntelligenceList;
  pareto: ParetoResponse;
}

interface Handlers {
  onLoaded(workspace: CustomerIntelligenceWorkspaceData): void;
  onSignedOut(): void;
  onError(message: string): void;
  onSettled(): void;
}

async function loadWorkspace(
  application: BrowserApplication,
): Promise<CustomerIntelligenceWorkspaceData | null> {
  const context = await application.auth.restoreContext();
  if (!context) return null;

  const [ranking, pareto] = await Promise.all([
    application.customerIntelligence.list({ page: 1, pageSize: 50 }),
    application.customerIntelligence.pareto(),
  ]);

  return { context, ranking, pareto };
}

export function useCustomerIntelligenceSession(
  application: BrowserApplication | null,
  handlers: Handlers,
) {
  useEffect(() => {
    if (!application) return;

    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') handlers.onSignedOut();
    });

    void loadWorkspace(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          handlers.onSignedOut();
          return;
        }
        handlers.onLoaded(workspace);
      })
      .catch((error) => {
        if (active) {
          handlers.onError(error instanceof Error ? error.message : 'No fue posible abrir el módulo.');
        }
      })
      .finally(() => {
        if (active) handlers.onSettled();
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, handlers]);
}
