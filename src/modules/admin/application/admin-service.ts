import type { AdminRepository } from '@/modules/admin/ports/admin-repository';
import type { AdminInviteInput, AdminUserQuery } from './admin.schemas';

function required(value: string, message: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  users(query: AdminUserQuery = {}) {
    return this.repository.users({
      ...query,
      search: query.search?.trim() || undefined,
      page: Math.max(query.page ?? 1, 1),
      pageSize: Math.min(Math.max(query.pageSize ?? 50, 1), 100),
    });
  }

  roles() {
    return this.repository.roles();
  }

  organization() {
    return this.repository.organization();
  }

  updateProfile(profileId: string, displayName: string, employeeCode?: string) {
    return this.repository.updateProfile(
      required(profileId, 'El perfil es obligatorio.'),
      required(displayName, 'El nombre es obligatorio.'),
      employeeCode?.trim() || undefined,
    );
  }

  setActive(profileId: string, active: boolean, reason: string) {
    return this.repository.setActive(
      required(profileId, 'El perfil es obligatorio.'),
      active,
      required(reason, 'El motivo es obligatorio.'),
    );
  }

  setRoles(profileId: string, roles: string[], primaryRole: string, reason: string) {
    if (!roles.length) throw new Error('Selecciona al menos un rol.');
    return this.repository.setRoles(
      required(profileId, 'El perfil es obligatorio.'),
      roles,
      required(primaryRole, 'El rol principal es obligatorio.'),
      required(reason, 'El motivo es obligatorio.'),
    );
  }

  setPermission(
    role: string,
    module: string,
    capability: 'read' | 'create' | 'update' | 'approve' | 'admin',
    enabled: boolean,
    reason: string,
  ) {
    return this.repository.setPermission(
      required(role, 'El rol es obligatorio.'),
      required(module, 'El módulo es obligatorio.'),
      capability,
      enabled,
      required(reason, 'El motivo es obligatorio.'),
    );
  }

  updateOrganization(name: string, timezone: string, settings: Record<string, unknown>) {
    return this.repository.updateOrganization(
      required(name, 'El nombre de la organización es obligatorio.'),
      required(timezone, 'La zona horaria es obligatoria.'),
      settings,
    );
  }

  startPasswordReset(profileId: string) {
    return this.repository.startPasswordReset(required(profileId, 'El perfil es obligatorio.'));
  }

  invite(input: AdminInviteInput) {
    if (!input.roles.length) throw new Error('Selecciona al menos un rol.');
    return this.repository.invite({
      ...input,
      email: required(input.email, 'El correo es obligatorio.').toLowerCase(),
      displayName: required(input.displayName, 'El nombre es obligatorio.'),
      primaryRole: required(input.primaryRole, 'El rol principal es obligatorio.'),
    });
  }
}
