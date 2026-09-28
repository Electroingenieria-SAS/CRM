'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createOrdersWorkforceBrowserApplication,
  type OrdersWorkforceBrowserApplication,
} from '@/composition/orders-workforce-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { OrderWorkforceHealth } from '@/modules/integrations/orders-workforce/application/orders-workforce.schemas';

const unavailableMessage = 'Este entorno no tiene un backend de staging configurado.';

interface WorkspaceData {
  context: SessionContext;
  health: OrderWorkforceHealth | null;
  forbidden: boolean;
}

async function loadWorkspace(
  application: OrdersWorkforceBrowserApplication,
): Promise<WorkspaceData | null> {
  const context = await application.auth.restoreContext();
  if (!context) return null;

  if (!hasModuleCapability(context, 'orders', 'read')) {
    return { context, health: null, forbidden: true };
  }

  return {
    context,
    health: await application.health.health(),
    forbidden: false,
  };
}

export function useOrdersWorkforcePage() {
  const router = useRouter();
  const application = useMemo(() => createOrdersWorkforceBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [health, setHealth] = useState<OrderWorkforceHealth | null>(null);
  const [loading, setLoading] = useState(() => Boolean(application));
  const [repairing, setRepairing] = useState(false);
  const [message, setMessage] = useState<string | null>(() =>
    application ? null : unavailableMessage,
  );
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!application) return;

    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void loadWorkspace(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          router.replace('/login');
          return;
        }

        setContext(workspace.context);
        setHealth(workspace.health);
        if (workspace.forbidden) {
          setMessage('Tu perfil no tiene acceso a la operación de pedidos.');
        }
      })
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
  }, [application, router]);

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
