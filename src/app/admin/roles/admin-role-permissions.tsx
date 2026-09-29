'use client';

import type { AdminRoleCatalog } from '@/modules/admin/application/admin.schemas';
import {
  adminCapabilities,
  type AdminCapability,
} from './use-admin-roles-data';
import styles from '../admin.module.css';

interface Props {
  catalog: AdminRoleCatalog | null;
  canAdmin: boolean;
  busy: boolean;
  reason: string;
  change(role: string, module: string, capability: AdminCapability, enabled: boolean): Promise<void>;
}

export function AdminRolePermissions({ catalog, canAdmin, busy, reason, change }: Props) {
  return (
    <div className={styles.rolesGrid}>
      {(catalog?.roles ?? []).map((role) => (
        <section className={styles.panel} key={role.code}>
          <div className={styles.roleHeader}>
            <div>
              <h2>{role.name}</h2>
              <p className={styles.muted}>{role.description}</p>
            </div>
            <div className={styles.roles}>
              {role.requireMfa ? <span className={styles.badge}>MFA obligatorio</span> : null}
              {role.sensitiveAdmin ? <span className={styles.badge}>Administrativo sensible</span> : null}
            </div>
          </div>
          {role.permissions.map((permission) => (
            <div className={styles.permissionRow} key={permission.module}>
              <strong>{permission.moduleName}</strong>
              {adminCapabilities.map((capability) => (
                <label key={capability}>
                  <input
                    type="checkbox"
                    checked={Boolean(permission[capability])}
                    disabled={!canAdmin || busy || !reason.trim()}
                    onChange={(event) =>
                      void change(role.code, permission.module, capability, event.target.checked)
                    }
                  />
                  {capability}
                </label>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
