'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPacoBrowserApplication } from '@/composition/paco-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';

export function usePacoSession() {
  const application = useMemo(() => createPacoBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);

  useEffect(() => {
    if (!application) return;
    let active = true;

    const restore = async () => {
      const session = await application.auth.restoreContext();
      if (active) setContext(session);
    };

    void restore();
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') setContext(null);
      else void restore();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application]);

  return { application, context };
}
