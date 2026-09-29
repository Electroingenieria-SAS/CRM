'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createInventoryBrowserApplication,
  type InventoryBrowserApplication,
} from '@/composition/inventory-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { InventoryCountCandidates } from '@/modules/inventory/application/inventory.schemas';

function useInventoryCountBootstrap(
  application: InventoryBrowserApplication | null,
  goLogin: () => void,
  setContext: (value: SessionContext) => void,
  setData: (value: InventoryCountCandidates) => void,
  setMessage: (value: string | null) => void,
  setLoading: (value: boolean) => void,
) {
  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') goLogin();
    });
    void application.auth
      .restoreContext()
      .then(async (session) => {
        if (!active) return;
        if (!session) return goLogin();
        if (!hasModuleCapability(session, 'inventory', 'create')) {
          throw new Error('No tienes permiso para registrar conteos.');
        }
        setContext(session);
        setData(await application.inventory.countCandidates(undefined, 1, 25));
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir Conteos.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, goLogin, setContext, setData, setLoading, setMessage]);
}

export function useInventoryCountPage() {
  const router = useRouter();
  const application = useMemo(() => createInventoryBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [data, setData] = useState<InventoryCountCandidates | null>(null);
  const [search, setSearch] = useState('');
  const [selectedBalanceId, setSelectedBalanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const goLogin = useCallback(() => router.replace('/login'), [router]);

  const load = useCallback(
    async (page = 1) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        setData(await application.inventory.countCandidates(search, page, 25));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible abrir Conteos.');
      } finally {
        setLoading(false);
      }
    },
    [application, search],
  );

  useInventoryCountBootstrap(application, goLogin, setContext, setData, setMessage, setLoading);

  async function submit(countedQuantity: number, note: string) {
    if (!application || !selectedBalanceId) return;
    setBusy(true);
    setMessage(null);
    setNotice(null);
    try {
      await application.inventory.submitCount(
        selectedBalanceId,
        countedQuantity,
        note,
        crypto.randomUUID(),
      );
      setSelectedBalanceId(null);
      setData(await application.inventory.countCandidates(search, 1, 25));
      setNotice('Conteo enviado para revisión sin revelar el saldo teórico.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible registrar el conteo.');
    } finally {
      setBusy(false);
    }
  }

  return {
    context,
    data,
    search,
    selectedBalanceId,
    loading: application ? loading : false,
    busy,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    notice,
    setSearch,
    select: setSelectedBalanceId,
    searchNow: () => load(1),
    goPage: load,
    submit,
    signOut: async () => {
      await application?.auth.signOut();
      goLogin();
    },
  };
}
