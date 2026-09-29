'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { AdminRoleCatalog } from '@/modules/admin/application/admin.schemas';
import { AdminShell } from '../admin-shell';
import styles from '../admin.module.css';
import { useAdminSession } from '../use-admin-session';

const capabilities = ['read', 'create', 'update', 'approve', 'admin'] as const;

export default function AdminRolesPage() {
  const session = useAdminSession();
  const [catalog, setCatalog] = useState<AdminRoleCatalog | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session.application || !session.context) return;
    if (!hasModuleCapability(session.context, 'admin', 'read')) {
      session.setMessage('Tu perfil no tiene acceso a roles y permisos.');
      return;
    }
    setBusy(true);
    try {
      setCatalog(await session.application.admin.roles());
    } catch (error) {
      session.setMessage(error instanceof Error ? error.message : 'No fue posible cargar permisos.');
    } finally {
      setBusy(false);
    }
  }, [session.application, session.context, session.setMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(
    role: string,
    module: string,
    capability: (typeof capabilities)[number],
    enabled: boolean,
  ) {
    if (!session.application || !reason.trim()) return;
    setBusy(true);
    session.setMessage(null);
    try {
      await session.application.admin.setPermission(role, module, capability, enabled, reason);
      session.setMessage('Permiso actualizado y auditado.');
      await load();
    } catch (error) {
      session.setMessage(error instanceof Error ? error.message : 'No fue posible cambiar el permiso.');
    } finally {
      setBusy(false);
    }
  }

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Administración</p>
          <h1>{session.loading ? 'Cargando…' : 'No fue posible abrir roles'}</h1>
        </section>
      </main>
    );
  }

  const canAdmin = hasModuleCapability(session.context, 'admin', 'admin');

  return (
    <AdminShell context={session.context} current="roles" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Mínimo privilegio</p>
          <h1>Roles y permisos</h1>
          <p>Capacidades por módulo; no se reemplazan los roles reales por categorías genéricas.</p>
        </div>
      </header>

      <section className={styles.panel}>
        <label className={styles.field}>
          Motivo del cambio
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Obligatorio para modificar permisos"
          />
        </label>
        {session.message ? <p className={styles.message} role="status">{session.message}</p> : null}
      </section>

      <div className={styles.rolesGrid}>
        {(catalog?.roles ?? []).map((role) => (
          <section className={styles.panel} key={role.code}>
            <div className={styles.roleHeader}>
              <div>
                <h2>{role.name}</h2>
                <p className={styles.muted}>{role.description}</p>
              </div>
              <div className={styles.roles}>
                {role.requireMfa ? <span className={styles.badge}>MFA obligatorio</span> : null}
                {role.sensitiveAdmin ? <span className={styles.badge}>Administrativo sensible</span> : null}
              </div>
            </div>

            {role.permissions.map((permission) => (
              <div className={styles.permissionRow} key={permission.module}>
                <strong>{permission.moduleName}</strong>
                {capabilities.map((capability) => (
                  <label key={capability}>
                    <input
                      type="checkbox"
                      checked={Boolean(permission[capability])}
                      disabled={!canAdmin || busy || !reason.trim()}
                      onChange={(event) =>
                        void change(role.code, permission.module, capability, event.target.checked)
                      }
                    />
                    {capability}
                  </label>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
