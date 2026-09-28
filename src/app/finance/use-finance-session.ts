'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserApplication,
  type BrowserApplication,
} from '@/composition/browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';

export function useFinanceSession() {
  const router = useRouter();
  const application = useMemo(() => createBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(application));
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!application) return;

    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });

    void application.auth
      .restoreContext()
      .then((value) => {
        if (!active) return;
        if (!value) return router.replace('/login');
        setContext(value);
      })
      .catch((error) => {
        if (active) {
          setSessionError(error instanceof Error ? error.message : 'No fue posible recuperar la sesión.');
        }
      })
      .finally(() => {
        if (active) setLoadingSession(false);
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
    application: application as BrowserApplication | null,
    context,
    loadingSession,
    sessionError,
    signOut,
  };
}
