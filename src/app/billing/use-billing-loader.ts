'use client';

import { useCallback } from 'react';
import type { BillingBrowserApplication } from '@/composition/billing-browser-application';
import type { BillingQueueItem } from '@/modules/billing/application/billing.schemas';

interface BillingLoaderDependencies {
  application: BillingBrowserApplication | null;
  search: string;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
  setQueue(value: Awaited<ReturnType<BillingBrowserApplication['billing']['list']>>): void;
  setSelected(updater: (current: BillingQueueItem | null) => BillingQueueItem | null): void;
}

export function useBillingLoader(deps: BillingLoaderDependencies) {
  return useCallback(
    async (term = deps.search) => {
      if (!deps.application) return;
      deps.setBusy(true);
      deps.setMessage(null);
      try {
        const next = await deps.application.billing.list(term, 1, 25);
        deps.setQueue(next);
        deps.setSelected((current) =>
          current ? (next.items.find((item) => item.orderId === current.orderId) ?? null) : null,
        );
      } catch (error) {
        deps.setMessage(
          error instanceof Error ? error.message : 'No fue posible cargar facturación.',
        );
      } finally {
        deps.setBusy(false);
      }
    },
    [deps],
  );
}
