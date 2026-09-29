'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBillingBrowserApplication,
  type BillingBrowserApplication,
} from '@/composition/billing-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  BillingQueue,
  BillingQueueItem,
} from '@/modules/billing/application/billing.schemas';
import { createBillingPageActions } from './billing-page-actions';

async function bootstrap(application: BillingBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  const queue = await application.billing.list(undefined, 1, 25);
  return { context, queue };
}

export function useBillingPage() {
  const router = useRouter();
  const application = useMemo(() => createBillingBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [queue, setQueue] = useState<BillingQueue | null>(null);
  const [selected, setSelected] = useState<BillingQueueItem | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (term = search) => {
    if (!application) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await application.billing.list(term, 1, 25);
      setQueue(next);
      setSelected((current) =>
        current ? next.items.find((item) => item.orderId === current.orderId) ?? null : null,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar facturación.');
    } finally {
      setBusy(false);
    }
  }, [application, search]);

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });
    void bootstrap(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) return router.replace('/login');
        setContext(workspace.context);
        setQueue(workspace.queue);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No fue posible abrir Facturación.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router]);

  const actions = createBillingPageActions({
    application, context, search, load, setBusy, setMessage, setNotice,
    goToLogin: () => router.replace('/login'),
  });

  return {
    context, queue, selected, search,
    busy: application ? busy : false,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    notice, setSelected, setSearch, ...actions,
  };
}
