'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import { AdminShell } from '../admin-shell';
import styles from '../admin.module.css';
import { useAdminSession } from '../use-admin-session';
import { AdminRolePermissions } from './admin-role-permissions';
import { useAdminRolesData } from './use-admin-roles-data';

export default function AdminRolesPage() {
  const session = useAdminSession();
  const data = useAdminRolesData(session);

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
            value={data.reason}
            onChange={(event) => data.setReason(event.target.value)}
            placeholder="Obligatorio para modificar permisos"
          />
        </label>
        {session.message ? (
          <p className={styles.message} role="status">
            {session.message}
          </p>
        ) : null}
      </section>
      <AdminRolePermissions
        catalog={data.catalog}
        canAdmin={canAdmin}
        busy={data.busy}
        reason={data.reason}
        change={data.change}
      />
    </AdminShell>
  );
}
