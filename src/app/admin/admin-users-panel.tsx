'use client';

import type { AdminRoleCatalog, AdminUsersResponse } from '@/modules/admin/application/admin.schemas';
import { AdminUserCard } from './admin-user-card';
import type { AdminActiveFilter } from './use-admin-users-data';
import styles from './admin.module.css';

interface Props {
  users: AdminUsersResponse | null;
  roles: AdminRoleCatalog | null;
  canAdmin: boolean;
  search: string;
  activeFilter: AdminActiveFilter;
  busy: boolean;
  setSearch(value: string): void;
  setActiveFilter(value: AdminActiveFilter): void;
  load(): Promise<void>;
  onProfile(id: string, name: string, code?: string): Promise<void>;
  onActive(id: string, active: boolean, reason: string): Promise<void>;
  onRoles(id: string, roles: string[], primary: string, reason: string): Promise<void>;
  onReset(id: string): Promise<void>;
}

export function AdminUsersPanel(props: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <input
          aria-label="Buscar usuarios"
          value={props.search}
          onChange={(event) => props.setSearch(event.target.value)}
          placeholder="Nombre, correo o código"
        />
        <select
          aria-label="Estado de usuarios"
          value={props.activeFilter}
          onChange={(event) => props.setActiveFilter(event.target.value as AdminActiveFilter)}
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button className="primary-button" disabled={props.busy} onClick={() => void props.load()} type="button">
          Aplicar
        </button>
      </div>
      <div className={styles.grid}>
        {(props.users?.items ?? []).map((user) => (
          <AdminUserCard
            key={user.id}
            user={user}
            roles={props.roles?.roles ?? []}
            canAdmin={props.canAdmin}
            onProfile={(name, code) => props.onProfile(user.id, name, code)}
            onActive={(active, reason) => props.onActive(user.id, active, reason)}
            onRoles={(roles, primary, reason) => props.onRoles(user.id, roles, primary, reason)}
            onReset={() => props.onReset(user.id)}
          />
        ))}
      </div>
      {!props.users?.items.length && !props.busy ? (
        <p className={styles.muted}>No hay usuarios para estos filtros.</p>
      ) : null}
    </section>
  );
}
