'use client';

import { useState } from 'react';
import type { AdminRoleCatalog, AdminUser } from '@/modules/admin/application/admin.schemas';
import styles from './admin.module.css';

interface AdminUserCardProps {
  user: AdminUser;
  roles: AdminRoleCatalog['roles'];
  canAdmin: boolean;
  onProfile(displayName: string, employeeCode?: string): Promise<void>;
  onActive(active: boolean, reason: string): Promise<void>;
  onRoles(roles: string[], primaryRole: string, reason: string): Promise<void>;
  onReset(): Promise<void>;
}

export function AdminUserCard(props: AdminUserCardProps) {
  const [name, setName] = useState(props.user.name);
  const [employeeCode, setEmployeeCode] = useState(props.user.employeeCode ?? '');
  const [selectedRoles, setSelectedRoles] = useState(props.user.roles.map((role) => role.code));
  const [primaryRole, setPrimaryRole] = useState(
    props.user.roles.find((role) => role.primary)?.code ?? props.user.roles[0]?.code ?? '',
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function toggleRole(role: string) {
    setSelectedRoles((current) => {
      const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
      if (!next.includes(primaryRole)) setPrimaryRole(next[0] ?? '');
      return next;
    });
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <strong>{props.user.name}</strong>
          <div className={styles.muted}>{props.user.email}</div>
        </div>
        <span className={styles.badge}>{props.user.active ? 'Activo' : 'Inactivo'}</span>
      </div>

      <div className={styles.roles}>
        {props.user.roles.map((role) => (
          <span className={styles.badge} key={role.code}>
            {role.name}{role.primary ? ' · principal' : ''}{role.requireMfa ? ' · MFA' : ''}
          </span>
        ))}
      </div>

      <details>
        <summary>Editar perfil</summary>
        <div className={styles.form}>
          <label>
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Código
            <input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
          </label>
          <button
            className={styles.secondary}
            disabled={!props.canAdmin || busy}
            onClick={() => void run(() => props.onProfile(name, employeeCode || undefined))}
            type="button"
          >
            Guardar perfil
          </button>
        </div>
      </details>

      <details>
        <summary>Roles y estado</summary>
        <div className={styles.form}>
          <div className={styles.field}>
            <span>Roles</span>
            {props.roles.map((role) => (
              <label key={role.code}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.code)}
                  disabled={!props.canAdmin || busy}
                  onChange={() => toggleRole(role.code)}
                />
                {role.name}
              </label>
            ))}
          </div>
          <label>
            Rol principal
            <select
              value={primaryRole}
              disabled={!props.canAdmin || busy}
              onChange={(event) => setPrimaryRole(event.target.value)}
            >
              {selectedRoles.map((role) => (
                <option key={role} value={role}>
                  {props.roles.find((item) => item.code === role)?.name ?? role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motivo
            <input
              value={reason}
              placeholder="Justificación del cambio"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              disabled={!props.canAdmin || busy || !selectedRoles.length || !reason.trim()}
              onClick={() =>
                void run(() => props.onRoles(selectedRoles, primaryRole, reason))
              }
              type="button"
            >
              Guardar roles
            </button>
            <button
              className={styles.secondary}
              disabled={!props.canAdmin || busy || !reason.trim()}
              onClick={() => void run(() => props.onActive(!props.user.active, reason))}
              type="button"
            >
              {props.user.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      </details>

      <div className={styles.actions}>
        <button
          className={styles.secondary}
          disabled={!props.canAdmin || busy || !props.user.active}
          onClick={() => void run(props.onReset)}
          type="button"
        >
          Enviar restablecimiento
        </button>
      </div>
    </article>
  );
}
