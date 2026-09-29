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
import type { InvoiceInput } from '@/modules/finance/ports/finance-repository';

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

  const load = useCallback(
    async (term = search) => {
      if (!application) return;
      setBusy(true);
      setMessage(null);
      try {
        const next = await application.billing.list(term, 1, 25);
        setQueue(next);
        if (selected) {
          setSelected(next.items.find((item) => item.orderId === selected.orderId) ?? null);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible cargar facturación.');
      } finally {
        setBusy(false);
      }
    },
    [application, search, selected],
  );

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
  }, [application, router]);

  const execute = useCallback(
    async (operation: () => Promise<unknown>, success: string) => {
      setBusy(true);
      setMessage(null);
      setNotice(null);
      try {
        await operation();
        setNotice(success);
        await load(search);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible completar la operación.');
      } finally {
        setBusy(false);
      }
    },
    [load, search],
  );

  return {
    context,
    queue,
    selected,
    search,
    busy: application ? busy : false,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    notice,
    setSelected,
    setSearch,
    searchNow: () => load(search),
    registerInvoice: (item: BillingQueueItem, input: InvoiceInput) =>
      execute(
        () => application!.billing.registerInvoice(item.orderId, input, crypto.randomUUID()),
        'Factura registrada correctamente.',
      ),
    uploadPvpAnnex: (item: BillingQueueItem, file: File) =>
      execute(
        () =>
          application!.billing.uploadPvpAnnex(
            context!.organization.id,
            item.orderId,
            file,
            crypto.randomUUID(),
          ),
        'Anexo PVP registrado correctamente.',
      ),
    complete: (item: BillingQueueItem) =>
      execute(
        () =>
          application!.billing.complete(
            item.orderId,
            item.orderVersion ?? 1,
            crypto.randomUUID(),
          ),
        'Pedido liberado hacia logística.',
      ),
    signOut: async () => {
      await application?.auth.signOut();
      router.replace('/login');
    },
  };
}
