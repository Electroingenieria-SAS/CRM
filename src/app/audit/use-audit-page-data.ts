'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuditBrowserApplication } from '@/composition/audit-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { AuditQuery, AuditResponse } from '@/modules/audit/application/audit.schemas';

export function useAuditPageData() {
  const router = useRouter();
  const application = useMemo(() => createAuditBrowserApplication(), []);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [query, setQuery] = useState<AuditQuery>({});
  const [response, setResponse] = useState<AuditResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(Boolean(application));

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') router.replace('/login');
    });
    void application.auth.restoreContext().then((session) => {
      if (!active) return;
      if (!session) router.replace('/login');
      else setContext(session);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'No fue posible restaurar la sesión.');
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router]);

  const load = useCallback(async (page = 1) => {
    if (!application || !context) return;
    if (!hasModuleCapability(context, 'audit', 'read')) {
      setMessage('Tu perfil no tiene acceso a Auditoría.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      setResponse(await application.audit.list({ ...query, page, pageSize: 50 }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible consultar Auditoría.');
    } finally {
      setBusy(false);
    }
  }, [application, context, query]);

  useEffect(() => {
    if (!context) return;
    const timer = window.setTimeout(() => void load(1), 0);
    return () => window.clearTimeout(timer);
  }, [context, load]);

  async function signOut() {
    await application?.auth.signOut();
    router.replace('/login');
  }

  return { context, query, setQuery, response, message, busy, load, signOut };
}
