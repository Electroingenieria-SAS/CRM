'use client';

import { useState } from 'react';
import type { AdminRoleCatalog, AdminUser } from '@/modules/admin/application/admin.schemas';
import styles from './admin.module.css';

interface Props {
  user: AdminUser;
  roles: AdminRoleCatalog['roles'];
  canAdmin: boolean;
  onActive(active: boolean, reason: string): Promise<void>;
  onRoles(roles: string[], primaryRole: string, reason: string): Promise<void>;
}

export function AdminUserRoleEditor({ user, roles, canAdmin, onActive, onRoles }: Props) {
  const [selected, setSelected] = useState(user.roles.map((role) => role.code));
  const [primary, setPrimary] = useState(
    user.roles.find((role) => role.primary)?.code ?? user.roles[0]?.code ?? '',
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(role: string) {
    setSelected((current) => {
      const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
      if (!next.includes(primary)) setPrimary(next[0] ?? '');
      return next;
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details>
      <summary>Roles y estado</summary>
      <div className={styles.form}>
        <div className={styles.field}>
          <span>Roles</span>
          {roles.map((role) => (
            <label key={role.code}>
              <input
                type="checkbox"
                checked={selected.includes(role.code)}
                disabled={!canAdmin || busy}
                onChange={() => toggle(role.code)}
              />
              {role.name}
            </label>
          ))}
        </div>
        <label>
          Rol principal
          <select value={primary} disabled={!canAdmin || busy} onChange={(event) => setPrimary(event.target.value)}>
            {selected.map((role) => <option key={role}>{role}</option>)}
          </select>
        </label>
        <label>
          Motivo
          <input value={reason} placeholder="Justificación del cambio" onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            disabled={!canAdmin || busy || !selected.length || !reason.trim()}
            onClick={() => void run(() => onRoles(selected, primary, reason))}
            type="button"
          >
            Guardar roles
          </button>
          <button
            className={styles.secondary}
            disabled={!canAdmin || busy || !reason.trim()}
            onClick={() => void run(() => onActive(!user.active, reason))}
            type="button"
          >
            {user.active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </details>
  );
}
