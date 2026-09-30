'use client';

import { useEffect } from 'react';
import type { BillingBrowserApplication } from '@/composition/billing-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { BillingQueue } from '@/modules/billing/application/billing.schemas';

interface RouterPort {
  replace(href: string): void;
}

interface BillingBootstrapSetters {
  setContext(value: SessionContext): void;
  setQueue(value: BillingQueue): void;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
}

async function loadInitial(application: BillingBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  return {
    context,
    queue: await application.billing.list(undefined, 1, 25),
  };
}

export function useBillingBootstrap(
  application: BillingBrowserApplication | null,
  router: RouterPort,
  setters: BillingBootstrapSetters,
) {
  const { setContext, setQueue, setBusy, setMessage } = setters;

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
        setContext(workspace.context);
        setQueue(workspace.queue);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir Facturación.');
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router, setBusy, setContext, setMessage, setQueue]);
}
