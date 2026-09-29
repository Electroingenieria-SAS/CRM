'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  AdminOrganization,
  MfaEnrollment,
  MfaStatus,
} from '@/modules/admin/application/admin.schemas';
import type { ReturnTypeOfAdminSession } from '../use-admin-session';

export function useAdminSecurityData(session: ReturnTypeOfAdminSession) {
  const { application, context, setMessage } = session;
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [organization, setOrganization] = useState<AdminOrganization | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Bogota');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!application || !context) return;
    setBusy(true);
    try {
      const [nextMfa, nextOrganization] = await Promise.all([
        application.mfa.status(),
        application.admin.organization(),
      ]);
      setMfa(nextMfa);
      setOrganization(nextOrganization);
      setName(nextOrganization.name);
      setTimezone(nextOrganization.timezone);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible cargar seguridad.');
    } finally {
      setBusy(false);
    }
  }, [application, context, setMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function enroll() {
    if (!application) return;
    setBusy(true);
    try {
      setEnrollment(await application.mfa.enroll());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible iniciar MFA.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!application || !enrollment) return;
    setBusy(true);
    try {
      await application.mfa.verify(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      setMessage(
        'MFA verificado. La sesión ya puede ejecutar operaciones administrativas sensibles.',
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible verificar MFA.');
    } finally {
      setBusy(false);
    }
  }

  async function saveOrganization() {
    if (!application || !organization) return;
    setBusy(true);
    try {
      await application.admin.updateOrganization(name, timezone, organization.settings);
      setMessage('Organización actualizada y auditada.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No fue posible actualizar la organización.',
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    mfa,
    enrollment,
    code,
    setCode,
    name,
    setName,
    timezone,
    setTimezone,
    busy,
    enroll,
    verify,
    saveOrganization,
  };
}
