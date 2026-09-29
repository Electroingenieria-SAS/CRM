import type { SupabaseClient } from '@supabase/supabase-js';
import {
  adminInviteSchema,
  adminMutationSchema,
  adminOrganizationSchema,
  adminPasswordResetSchema,
  adminRoleCatalogSchema,
  adminUsersResponseSchema,
  type AdminInviteInput,
  type AdminUserQuery,
} from '@/modules/admin/application/admin.schemas';
import type { AdminRepository } from '@/modules/admin/ports/admin-repository';
import { AppError } from '@/shared/errors/app-error';

function adminError(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === '42501') {
    if (error.message?.toLowerCase().includes('mfa')) {
      return new AppError('AUTHORIZATION', 'Esta operación requiere verificar MFA.');
    }
    return new AppError('AUTHORIZATION', 'No tienes permisos para esta operación administrativa.');
  }
  if (error?.code === '22023') return new AppError('VALIDATION', error.message ?? fallback);
  if (error?.code === '23505') return new AppError('BUSINESS_RULE', 'El usuario ya existe.');
  if (error?.code === 'P0002') return new AppError('BUSINESS_RULE', 'El recurso ya no está disponible.');
  return new AppError('DATABASE', fallback);
}

export class SupabaseAdminRepository implements AdminRepository {
  constructor(private readonly client: SupabaseClient) {}

  async users(query: AdminUserQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_admin_users', {
      p_search: query.search ?? null,
      p_active: query.active ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 50,
    });
    if (error) throw adminError(error, 'No fue posible consultar los usuarios.');
    return adminUsersResponseSchema.parse(data);
  }

  async roles() {
    const { data, error } = await this.client.rpc('erp_x_admin_roles');
    if (error) throw adminError(error, 'No fue posible consultar roles y permisos.');
    return adminRoleCatalogSchema.parse(data);
  }

  async organization() {
    const { data, error } = await this.client.rpc('erp_x_admin_organization');
    if (error) throw adminError(error, 'No fue posible consultar la organización.');
    return adminOrganizationSchema.parse(data);
  }

  async updateProfile(profileId: string, displayName: string, employeeCode?: string) {
    const { data, error } = await this.client.rpc('erp_x_admin_update_profile', {
      p_profile_id: profileId,
      p_display_name: displayName,
      p_employee_code: employeeCode ?? null,
    });
    if (error) throw adminError(error, 'No fue posible actualizar el perfil.');
    adminMutationSchema.parse(data);
  }

  async setActive(profileId: string, active: boolean, reason: string) {
    const { data, error } = await this.client.rpc('erp_x_admin_set_user_active', {
      p_profile_id: profileId,
      p_active: active,
      p_reason: reason,
    });
    if (error) throw adminError(error, 'No fue posible cambiar el estado del usuario.');
    adminMutationSchema.parse(data);
  }

  async setRoles(profileId: string, roles: string[], primaryRole: string, reason: string) {
    const { data, error } = await this.client.rpc('erp_x_admin_set_user_roles', {
      p_profile_id: profileId,
      p_roles: roles,
      p_primary_role: primaryRole,
      p_reason: reason,
    });
    if (error) throw adminError(error, 'No fue posible cambiar los roles.');
    adminMutationSchema.parse(data);
  }

  async setPermission(
    roleCode: string,
    moduleCode: string,
    capability: 'read' | 'create' | 'update' | 'approve' | 'admin',
    enabled: boolean,
    reason: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_admin_set_permission', {
      p_role_code: roleCode,
      p_module_code: moduleCode,
      p_capability: capability,
      p_enabled: enabled,
      p_reason: reason,
    });
    if (error) throw adminError(error, 'No fue posible actualizar el permiso.');
    adminMutationSchema.parse(data);
  }

  async updateOrganization(name: string, timezone: string, settings: Record<string, unknown>) {
    const { data, error } = await this.client.rpc('erp_x_admin_update_organization', {
      p_name: name,
      p_timezone: timezone,
      p_settings: settings,
    });
    if (error) throw adminError(error, 'No fue posible actualizar la organización.');
    adminOrganizationSchema.parse(data);
  }

  async startPasswordReset(profileId: string) {
    const { data, error } = await this.client.rpc('erp_x_admin_password_reset_prepare', {
      p_profile_id: profileId,
    });
    if (error) throw adminError(error, 'No fue posible iniciar el restablecimiento.');

    const prepared = adminPasswordResetSchema.parse(data);
    const redirectTo =
      typeof window === 'undefined' ? undefined : window.location.origin + '/update-password';
    const { error: resetError } = await this.client.auth.resetPasswordForEmail(prepared.email, {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (resetError) {
      throw new AppError(
        'AUTHENTICATION',
        'El proceso quedó auditado, pero Supabase no pudo enviar el correo de recuperación.',
      );
    }
  }

  async invite(input: AdminInviteInput) {
    const { data, error } = await this.client.functions.invoke('admin-users', {
      body: {
        operation: 'invite',
        email: input.email,
        displayName: input.displayName,
        employeeCode: input.employeeCode ?? null,
        roles: input.roles,
        primaryRole: input.primaryRole,
      },
    });
    if (error) {
      throw new AppError('AUTHORIZATION', 'No fue posible completar la invitación administrativa.');
    }
    adminInviteSchema.parse(data);
  }
}
