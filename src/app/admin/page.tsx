'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AdminRoleCatalog,
  AdminUsersResponse,
} from '@/modules/admin/application/admin.schemas';
import { AdminInviteForm } from './admin-invite-form';
import { AdminShell } from './admin-shell';
import { AdminUserCard } from './admin-user-card';
import styles from './admin.module.css';
import { useAdminSession } from './use-admin-session';

export default function AdminUsersPage() {
  const session = useAdminSession();
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [roles, setRoles] = useState<AdminRoleCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session.application || !session.context) return;
    if (!hasModuleCapability(session.context, 'admin', 'read')) {
      session.setMessage('Tu perfil no tiene acceso a Administración.');
      return;
    }

    setBusy(true);
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        session.application.admin.users({
          search: search || undefined,
          active: activeFilter === 'all' ? undefined : activeFilter === 'active',
        }),
        session.application.admin.roles(),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'No fue posible cargar Administración.',
      );
    } finally {
      setBusy(false);
    }
  }, [activeFilter, search, session.application, session.context, session.setMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutation(action: () => Promise<void>, success: string) {
    session.setMessage(null);
    try {
      await action();
      session.setMessage(success);
      await load();
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'La operación administrativa falló.',
      );
    }
  }

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Administración</p>
          <h1>{session.loading ? 'Cargando…' : 'No fue posible abrir Administración'}</h1>
          {session.message ? <p role="alert">{session.message}</p> : null}
        </section>
      </main>
    );
  }

  const canAdmin = hasModuleCapability(session.context, 'admin', 'admin');

  return (
    <AdminShell context={session.context} current="users" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Usuarios y perfiles</h1>
          <p>Gestión de identidad operativa sin almacenar ni recuperar contraseñas.</p>
        </div>
      </header>

      {session.message ? (
        <p className={styles.message} role="status">
          {session.message}
        </p>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Buscar usuarios"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, correo o código"
          />
          <select
            aria-label="Estado de usuarios"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          <button className="primary-button" disabled={busy} onClick={() => void load()} type="button">
            Aplicar
          </button>
        </div>

        <div className={styles.grid}>
          {(users?.items ?? []).map((user) => (
            <AdminUserCard
              key={user.id}
              user={user}
              roles={roles?.roles ?? []}
              canAdmin={canAdmin}
              onProfile={(name, code) =>
                mutation(
                  () => session.application!.admin.updateProfile(user.id, name, code),
                  'Perfil actualizado.',
                )
              }
              onActive={(active, reason) =>
                mutation(
                  () => session.application!.admin.setActive(user.id, active, reason),
                  active ? 'Usuario activado.' : 'Usuario desactivado.',
                )
              }
              onRoles={(nextRoles, primary, reason) =>
                mutation(
                  () => session.application!.admin.setRoles(user.id, nextRoles, primary, reason),
                  'Roles actualizados.',
                )
              }
              onReset={() =>
                mutation(
                  () => session.application!.admin.startPasswordReset(user.id),
                  'Correo de restablecimiento solicitado.',
                )
              }
            />
          ))}
        </div>
        {!users?.items.length && !busy ? <p className={styles.muted}>No hay usuarios para estos filtros.</p> : null}
      </section>

      {canAdmin && roles ? (
        <AdminInviteForm
          roles={roles.roles}
          disabled={busy}
          onInvite={(input) =>
            mutation(() => session.application!.admin.invite(input), 'Invitación enviada y perfil creado.')
          }
        />
      ) : null}
    </AdminShell>
  );
}
