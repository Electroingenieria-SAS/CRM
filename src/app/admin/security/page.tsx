'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AdminOrganization,
  MfaEnrollment,
  MfaStatus,
} from '@/modules/admin/application/admin.schemas';
import { AdminShell } from '../admin-shell';
import styles from '../admin.module.css';
import { useAdminSession } from '../use-admin-session';

export default function AdminSecurityPage() {
  const session = useAdminSession();
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [organization, setOrganization] = useState<AdminOrganization | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Bogota');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session.application || !session.context) return;
    setBusy(true);
    try {
      const [nextMfa, nextOrganization] = await Promise.all([
        session.application.mfa.status(),
        session.application.admin.organization(),
      ]);
      setMfa(nextMfa);
      setOrganization(nextOrganization);
      setName(nextOrganization.name);
      setTimezone(nextOrganization.timezone);
    } catch (error) {
      session.setMessage(error instanceof Error ? error.message : 'No fue posible cargar seguridad.');
    } finally {
      setBusy(false);
    }
  }, [session.application, session.context, session.setMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enroll() {
    if (!session.application) return;
    setBusy(true);
    try {
      setEnrollment(await session.application.mfa.enroll());
    } catch (error) {
      session.setMessage(error instanceof Error ? error.message : 'No fue posible iniciar MFA.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!session.application || !enrollment) return;
    setBusy(true);
    try {
      await session.application.mfa.verify(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      session.setMessage('MFA verificado. La sesión ya puede ejecutar operaciones administrativas sensibles.');
      await load();
    } catch (error) {
      session.setMessage(error instanceof Error ? error.message : 'No fue posible verificar MFA.');
    } finally {
      setBusy(false);
    }
  }

  async function saveOrganization() {
    if (!session.application || !organization) return;
    setBusy(true);
    try {
      await session.application.admin.updateOrganization(name, timezone, organization.settings);
      session.setMessage('Organización actualizada y auditada.');
      await load();
    } catch (error) {
      session.setMessage(error instanceof Error ? error.message : 'No fue posible actualizar la organización.');
    } finally {
      setBusy(false);
    }
  }

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

      <section className={styles.panel}>
        <h2>Autenticación multifactor</h2>
        <div className={styles.metricGrid}>
          <div className={styles.metric}><small>Nivel actual</small><strong>{mfa?.currentLevel ?? '—'}</strong></div>
          <div className={styles.metric}><small>Nivel disponible</small><strong>{mfa?.nextLevel ?? '—'}</strong></div>
          <div className={styles.metric}><small>Factores</small><strong>{mfa?.factors.length ?? 0}</strong></div>
        </div>

        {!enrollment ? (
          <button className="primary-button" disabled={busy} onClick={() => void enroll()} type="button">
            Registrar autenticador TOTP
          </button>
        ) : (
          <div className={styles.mfa}>
            {/* Supabase entrega el QR como URI de imagen. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.qr} src={enrollment.qrCode} alt="Código QR para configurar MFA" />
            <p className={styles.muted}>Clave manual: <code>{enrollment.secret}</code></p>
            <label className={styles.field}>
              Código de seis dígitos
              <input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <button className="primary-button" disabled={busy || code.trim().length < 6} onClick={() => void verify()} type="button">
              Verificar MFA
            </button>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Organización</h2>
        <div className={styles.form}>
          <label>
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Zona horaria
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          </label>
          <button className="primary-button" disabled={!canAdmin || busy} onClick={() => void saveOrganization()} type="button">
            Guardar configuración
          </button>
        </div>
      </section>
    </AdminShell>
  );
}
