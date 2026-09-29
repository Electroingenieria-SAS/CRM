'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import { AdminShell } from '../admin-shell';
import styles from '../admin.module.css';
import { useAdminSession } from '../use-admin-session';
import { AdminMfaPanel } from './admin-mfa-panel';
import { AdminOrganizationPanel } from './admin-organization-panel';
import { useAdminSecurityData } from './use-admin-security-data';

export default function AdminSecurityPage() {
  const session = useAdminSession();
  const data = useAdminSecurityData(session);

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Seguridad</p>
          <h1>{session.loading ? 'Cargando…' : 'No fue posible abrir seguridad'}</h1>
        </section>
      </main>
    );
  }

  const canAdmin = hasModuleCapability(session.context, 'admin', 'admin');

  return (
    <AdminShell context={session.context} current="security" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Seguridad administrativa</p>
          <h1>MFA y organización</h1>
          <p>Las mutaciones administrativas sensibles exigen una sesión AAL2.</p>
        </div>
      </header>
      {session.message ? <p className={styles.message} role="status">{session.message}</p> : null}
      <AdminMfaPanel
        mfa={data.mfa}
        enrollment={data.enrollment}
        code={data.code}
        busy={data.busy}
        setCode={data.setCode}
        enroll={data.enroll}
        verify={data.verify}
      />
      <AdminOrganizationPanel
        name={data.name}
        timezone={data.timezone}
        canAdmin={canAdmin}
        busy={data.busy}
        setName={data.setName}
        setTimezone={data.setTimezone}
        save={data.saveOrganization}
      />
    </AdminShell>
  );
}
