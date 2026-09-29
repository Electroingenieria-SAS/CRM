'use client';

import { useState } from 'react';
import type { AdminUser } from '@/modules/admin/application/admin.schemas';
import styles from './admin.module.css';

interface Props {
  user: AdminUser;
  canAdmin: boolean;
  onProfile(displayName: string, employeeCode?: string): Promise<void>;
}

export function AdminUserProfileEditor({ user, canAdmin, onProfile }: Props) {
  const [name, setName] = useState(user.name);
  const [employeeCode, setEmployeeCode] = useState(user.employeeCode ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onProfile(name, employeeCode || undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
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
          disabled={!canAdmin || busy}
          onClick={() => void save()}
          type="button"
        >
          Guardar perfil
        </button>
      </div>
    </details>
  );
}
