'use client';

import { useState } from 'react';
import type { AdminInviteInput, AdminRoleCatalog } from '@/modules/admin/application/admin.schemas';
import styles from './admin.module.css';

interface AdminInviteFormProps {
  roles: AdminRoleCatalog['roles'];
  disabled: boolean;
  onInvite(input: AdminInviteInput): Promise<void>;
}

export function AdminInviteForm({ roles, disabled, onInvite }: AdminInviteFormProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [primaryRole, setPrimaryRole] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleRole(role: string) {
    setSelectedRoles((current) => {
      const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
      if (!next.includes(primaryRole)) setPrimaryRole(next[0] ?? '');
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    try {
      await onInvite({
        email,
        displayName,
        employeeCode: employeeCode || undefined,
        roles: selectedRoles,
        primaryRole,
      });
      setEmail('');
      setDisplayName('');
      setEmployeeCode('');
      setSelectedRoles([]);
      setPrimaryRole('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2>Invitar usuario</h2>
      <p className={styles.muted}>La invitación usa Supabase Auth; el CRM nunca crea ni muestra una contraseña.</p>
      <div className={styles.form}>
        <label>
          Correo
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Nombre
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          Código
          <input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
        </label>
        <div className={styles.field}>
          <span>Roles</span>
          {roles.map((role) => (
            <label key={role.code}>
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.code)}
                onChange={() => toggleRole(role.code)}
              />
              {role.name}
            </label>
          ))}
        </div>
        <label>
          Principal
          <select value={primaryRole} onChange={(event) => setPrimaryRole(event.target.value)}>
            <option value="">Seleccionar</option>
            {selectedRoles.map((role) => (
              <option key={role} value={role}>
                {roles.find((item) => item.code === role)?.name ?? role}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary-button"
          disabled={disabled || busy || !email || !displayName || !selectedRoles.length || !primaryRole}
          onClick={() => void submit()}
          type="button"
        >
          {busy ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </div>
    </section>
  );
}
