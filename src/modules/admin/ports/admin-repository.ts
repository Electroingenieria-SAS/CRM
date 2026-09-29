import type {
  AdminInviteInput,
  AdminOrganization,
  AdminRoleCatalog,
  AdminUserQuery,
  AdminUsersResponse,
} from '@/modules/admin/application/admin.schemas';

export interface AdminRepository {
  users(query?: AdminUserQuery): Promise<AdminUsersResponse>;
  roles(): Promise<AdminRoleCatalog>;
  organization(): Promise<AdminOrganization>;
  updateProfile(profileId: string, displayName: string, employeeCode?: string): Promise<void>;
  setActive(profileId: string, active: boolean, reason: string): Promise<void>;
  setRoles(profileId: string, roles: string[], primaryRole: string, reason: string): Promise<void>;
  setPermission(
    roleCode: string,
    moduleCode: string,
    capability: 'read' | 'create' | 'update' | 'approve' | 'admin',
    enabled: boolean,
    reason: string,
  ): Promise<void>;
  updateOrganization(name: string, timezone: string, settings: Record<string, unknown>): Promise<void>;
  startPasswordReset(profileId: string): Promise<void>;
  invite(input: AdminInviteInput): Promise<void>;
}
