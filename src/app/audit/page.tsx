'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import { AuditEventList } from './audit-event-list';
import { AuditFilters } from './audit-filters';
import styles from './audit.module.css';
import { useAuditPageData } from './use-audit-page-data';

export default function AuditPage() {
  const data = useAuditPageData();

  if (!data.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Auditoría</p>
          <h1>{data.busy ? 'Cargando…' : 'No fue posible abrir Auditoría'}</h1>
          {data.message ? <p role="alert">{data.message}</p> : null}
        </section>
      </main>
    );
  }

  const navigation: AppShellNavigationItem[] = [
    { href: '/audit', label: 'Auditoría', current: true },
    ...(hasModuleCapability(data.context, 'admin', 'read')
      ? [{ href: '/admin', label: 'Administración' }]
      : []),
    ...(hasModuleCapability(data.context, 'analytics', 'read')
      ? [{ href: '/analytics', label: 'Panel' }]
      : []),
    { href: '/orders', label: 'Pedidos' },
  ];

  return (
    <AppShell
      userName={data.context.profile.name}
      organizationName={data.context.organization.name}
      navigation={navigation}
      onSignOut={data.signOut}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h1>Auditoría del sistema</h1>
          <p>Eventos críticos append-only, filtrados y paginados desde backend.</p>
        </div>
      </header>
      <AuditFilters
        query={data.query}
        busy={data.busy}
        setQuery={data.setQuery}
        onApply={() => void data.load(1)}
      />
      {data.message ? <p className={styles.message} role="status">{data.message}</p> : null}
      {data.busy ? <p role="status">Consultando eventos…</p> : null}
      <AuditEventList response={data.response} busy={data.busy} load={data.load} />
    </AppShell>
  );
}
