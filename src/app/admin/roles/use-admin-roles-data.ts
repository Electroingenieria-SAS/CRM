'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminRoleCatalog } from '@/modules/admin/application/admin.schemas';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { ReturnTypeOfAdminSession } from '../use-admin-session';

export const adminCapabilities = ['read', 'create', 'update', 'approve', 'admin'] as const;
export type AdminCapability = (typeof adminCapabilities)[number];

export function useAdminRolesData(session: ReturnTypeOfAdminSession) {
  const { application, context, setMessage } = session;
  const [catalog, setCatalog] = useState<AdminRoleCatalog | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!application || !context) return;
    if (!hasModuleCapability(context, 'admin', 'read')) {
      setMessage('Tu perfil no tiene acceso a roles y permisos.');
      return;
    }
    setBusy(true);
    try {
      setCatalog(await application.admin.roles());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar permisos.');
    } finally {
      setBusy(false);
    }
  }, [application, context, setMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function change(
    role: string,
    module: string,
    capability: AdminCapability,
    enabled: boolean,
  ) {
    if (!application || !reason.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await application.admin.setPermission(role, module, capability, enabled, reason);
      setMessage('Permiso actualizado y auditado.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cambiar el permiso.');
    } finally {
      setBusy(false);
    }
  }

  return { catalog, reason, setReason, busy, change };
}
