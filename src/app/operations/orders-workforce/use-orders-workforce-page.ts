'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrdersWorkforceBrowserApplication } from '@/composition/orders-workforce-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { OrderWorkforceHealth } from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';

export function useOrdersWorkforcePage() {
  const router = useRouter();
  const application = useMemo(() => createOrdersWorkforceBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [health, setHealth] = useState<OrderWorkforceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!application) return;
    const restored = await application.auth.restoreContext();
    if (!restored) {
      router.replace('/login');
      return;
    }
    if (!hasModuleCapability(restored, 'orders', 'read')) {
      setMessage('Tu perfil no tiene acceso a la operación de pedidos.');
      setContext(restored);
      return;
    }

    setContext(restored);
    setHealth(await application.health.health());
  }, [application, router]);

  useEffect(() => {
    let active = true;
    if (!application) {
      setLoading(false);
      setMessage('Este entorno no tiene un backend de staging configurado.');
      return;
    }

    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void load()
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'No fue posible cargar la integración.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, load, router]);

  async function reconcile(repair: boolean) {
    if (!application) return;
    setRepairing(true);
    setMessage(null);
    setNotice(null);
    try {
      const result = await application.health.reconcile(undefined, repair);
      setNotice(
        repair
          ? `Reconciliación terminada: ${result.repaired} eventos reparados.`
          : `Revisión terminada: ${result.items.length} inconsistencias detectadas.`,
      );
      setHealth(await application.health.health());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible reconciliar.');
    } finally {
      setRepairing(false);
    }
  }

  async function signOut() {
    await application?.auth.signOut();
    router.replace('/login');
  }

  return {
    context,
    health,
    loading,
    repairing,
    message,
    notice,
    canRepair: context ? hasModuleCapability(context, 'orders', 'update') : false,
    reconcile,
    signOut,
  };
}
