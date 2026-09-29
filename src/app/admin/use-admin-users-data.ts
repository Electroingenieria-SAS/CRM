'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AdminRoleCatalog,
  AdminUsersResponse,
} from '@/modules/admin/application/admin.schemas';
import type { ReturnTypeOfAdminSession } from './use-admin-session';

export type AdminActiveFilter = 'all' | 'active' | 'inactive';

export function useAdminUsersData(session: ReturnTypeOfAdminSession) {
  const { application, context, setMessage } = session;
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [roles, setRoles] = useState<AdminRoleCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<AdminActiveFilter>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!application || !context) return;
    if (!hasModuleCapability(context, 'admin', 'read')) {
      setMessage('Tu perfil no tiene acceso a Administración.');
      return;
    }
    setBusy(true);
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        application.admin.users({
          search: search || undefined,
          active: activeFilter === 'all' ? undefined : activeFilter === 'active',
        }),
        application.admin.roles(),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar Administración.');
    } finally {
      setBusy(false);
    }
  }, [activeFilter, application, context, search, setMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mutation(action: () => Promise<void>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La operación administrativa falló.');
    }
  }

  return { users, roles, search, setSearch, activeFilter, setActiveFilter, busy, load, mutation };
}
