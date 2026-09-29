'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuditBrowserApplication } from '@/composition/audit-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { AuditQuery, AuditResponse } from '@/modules/audit/application/audit.schemas';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from './audit.module.css';

function fmt(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function AuditPage() {
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
    void application.auth
      .restoreContext()
      .then((session) => {
        if (!active) return;
        if (!session) {
          router.replace('/login');
          return;
        }
        setContext(session);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No fue posible restaurar la sesión.');
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, router]);

  const load = useCallback(
    async (page = 1) => {
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
    },
    [application, context, query],
  );

  useEffect(() => {
    if (context) void load(1);
  }, [context, load]);

  if (!context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Auditoría</p>
          <h1>{busy ? 'Cargando…' : 'No fue posible abrir Auditoría'}</h1>
          {message ? <p role="alert">{message}</p> : null}
        </section>
      </main>
    );
  }

  const navigation: AppShellNavigationItem[] = [
    { href: '/audit', label: 'Auditoría', current: true },
    ...(hasModuleCapability(context, 'admin', 'read') ? [{ href: '/admin', label: 'Administración' }] : []),
    ...(hasModuleCapability(context, 'analytics', 'read') ? [{ href: '/analytics', label: 'Panel' }] : []),
    { href: '/orders', label: 'Pedidos' },
  ];

  return (
    <AppShell
      userName={context.profile.name}
      organizationName={context.organization.name}
      navigation={navigation}
      onSignOut={async () => {
        await application?.auth.signOut();
        router.replace('/login');
      }}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Trazabilidad</p>
          <h1>Auditoría del sistema</h1>
          <p>Eventos críticos append-only, filtrados y paginados desde backend.</p>
        </div>
      </header>

      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          void load(1);
        }}
      >
        {(['from', 'to'] as const).map((key) => (
          <label key={key}>
            {key === 'from' ? 'Desde' : 'Hasta'}
            <input
              type="date"
              value={query[key] ?? ''}
              onChange={(event) => setQuery({ ...query, [key]: event.target.value || undefined })}
            />
          </label>
        ))}
        <label>
          Módulo
          <input value={query.module ?? ''} onChange={(event) => setQuery({ ...query, module: event.target.value })} />
        </label>
        <label>
          Acción
          <input value={query.action ?? ''} onChange={(event) => setQuery({ ...query, action: event.target.value })} />
        </label>
        <label>
          Recurso
          <input value={query.resource ?? ''} onChange={(event) => setQuery({ ...query, resource: event.target.value })} />
        </label>
        <label>
          Resultado
          <select value={query.result ?? ''} onChange={(event) => setQuery({ ...query, result: event.target.value })}>
            <option value="">Todos</option>
            {['SUCCESS', 'FAILED', 'DENIED', 'REQUESTED', 'ACKNOWLEDGED'].map((result) => (
              <option key={result}>{result}</option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          Aplicar
        </button>
      </form>

      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {busy ? <p role="status">Consultando eventos…</p> : null}

      <section className={styles.list} aria-label="Eventos de auditoría">
        {(response?.items ?? []).map((event) => (
          <article className={styles.card} key={event.id}>
            <div className={styles.row}>
              <strong>{event.action}</strong>
              <span className={styles.badge}>{event.result}</span>
            </div>
            <div className={styles.meta}>
              <span>{event.module}</span>
              <span>{event.actor}</span>
              <span>{new Date(event.createdAt).toLocaleString('es-CO')}</span>
            </div>
            <div className={styles.grid}>
              <div><small>Recurso</small><span>{event.resourceType} · {event.resourceId ?? '—'}</span></div>
              <div><small>Request ID</small><span>{event.requestId ?? '—'}</span></div>
              <div><small>Metadata</small><span className={styles.code}>{fmt(event.metadata)}</span></div>
            </div>
          </article>
        ))}
        {!response?.items.length && !busy ? <p>No hay eventos para estos filtros.</p> : null}
      </section>

      {response ? (
        <div className={styles.pagination}>
          <button
            type="button"
            disabled={busy || response.pagination.page <= 1}
            onClick={() => void load(response.pagination.page - 1)}
          >
            Anterior
          </button>
          <span>Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}</span>
          <button
            type="button"
            disabled={busy || response.pagination.page >= response.pagination.totalPages}
            onClick={() => void load(response.pagination.page + 1)}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
