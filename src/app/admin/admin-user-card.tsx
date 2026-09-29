'use client';

import { useState } from 'react';
import type { AdminRoleCatalog, AdminUser } from '@/modules/admin/application/admin.schemas';
import { AdminUserProfileEditor } from './admin-user-profile-editor';
import { AdminUserRoleEditor } from './admin-user-role-editor';
import styles from './admin.module.css';

interface Props {
  user: AdminUser;
  roles: AdminRoleCatalog['roles'];
  canAdmin: boolean;
  onProfile(displayName: string, employeeCode?: string): Promise<void>;
  onActive(active: boolean, reason: string): Promise<void>;
  onRoles(roles: string[], primaryRole: string, reason: string): Promise<void>;
  onReset(): Promise<void>;
}

export function AdminUserCard(props: Props) {
  const [resetting, setResetting] = useState(false);

  async function resetPassword() {
    setResetting(true);
    try {
      await props.onReset();
    } finally {
      setResetting(false);
    }
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
      <AdminUserProfileEditor
        user={props.user}
        canAdmin={props.canAdmin}
        onProfile={props.onProfile}
      />
      <AdminUserRoleEditor
        user={props.user}
        roles={props.roles}
        canAdmin={props.canAdmin}
        onActive={props.onActive}
        onRoles={props.onRoles}
      />
      <button
        className={styles.secondary}
        disabled={!props.canAdmin || resetting || !props.user.active}
        onClick={() => void resetPassword()}
        type="button"
      >
        Enviar restablecimiento
      </button>
    </article>
  );
}
