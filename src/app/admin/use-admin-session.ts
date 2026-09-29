'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAdminBrowserApplication,
  type AdminBrowserApplication,
} from '@/composition/admin-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';

export function useAdminSession() {
  const router = useRouter();
  const application = useMemo(() => createAdminBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [message, setMessage] = useState<string | null>(
    application ? null : 'Este entorno no tiene Supabase configurado.',
  );
  const [loading, setLoading] = useState(Boolean(application));

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void application.auth
      .restoreContext()
      .then((session) => {
        if (!active) return;
        if (!session) {
          router.replace('/login');
          return;
        }
        setContext(session);
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error ? error.message : 'No fue posible restaurar la sesión.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router]);

  async function signOut() {
    await application?.auth.signOut();
    router.replace('/login');
  }

  return {
    application: application as AdminBrowserApplication | null,
    context,
    message,
    setMessage,
    loading,
    signOut,
  };
}

export type ReturnTypeOfAdminSession = ReturnType<typeof useAdminSession>;
