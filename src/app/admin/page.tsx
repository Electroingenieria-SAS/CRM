'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import { AdminInviteForm } from './admin-invite-form';
import { AdminShell } from './admin-shell';
import { AdminUsersPanel } from './admin-users-panel';
import styles from './admin.module.css';
import { useAdminSession } from './use-admin-session';
import { useAdminUsersData } from './use-admin-users-data';

export default function AdminUsersPage() {
  const session = useAdminSession();
  const data = useAdminUsersData(session);

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
  const app = session.application;

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
      <AdminUsersPanel
        {...data}
        canAdmin={canAdmin}
        onProfile={(id, name, code) =>
          data.mutation(() => app!.admin.updateProfile(id, name, code), 'Perfil actualizado.')
        }
        onActive={(id, active, reason) =>
          data.mutation(
            () => app!.admin.setActive(id, active, reason),
            active ? 'Usuario activado.' : 'Usuario desactivado.',
          )
        }
        onRoles={(id, roles, primary, reason) =>
          data.mutation(
            () => app!.admin.setRoles(id, roles, primary, reason),
            'Roles actualizados.',
          )
        }
        onReset={(id) =>
          data.mutation(
            () => app!.admin.startPasswordReset(id),
            'Correo de restablecimiento solicitado.',
          )
        }
      />
      {canAdmin && data.roles ? (
        <AdminInviteForm
          roles={data.roles.roles}
          disabled={data.busy}
          onInvite={(input) =>
            data.mutation(() => app!.admin.invite(input), 'Invitación enviada y perfil creado.')
          }
        />
      ) : null}
    </AdminShell>
  );
}
