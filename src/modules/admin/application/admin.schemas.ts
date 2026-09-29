import { z } from 'zod';

const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  employeeCode: z.string().nullable(),
  active: z.boolean(),
  authLinked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  roles: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      primary: z.boolean(),
      requireMfa: z.boolean(),
    }),
  ),
});

export const adminUsersResponseSchema = z.object({
  items: z.array(adminUserSchema),
  pagination: paginationSchema,
  contractVersion: z.string(),
});

export const adminRoleCatalogSchema = z.object({
  roles: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      active: z.boolean(),
      systemRole: z.boolean(),
      requireMfa: z.boolean(),
      sensitiveAdmin: z.boolean(),
      permissions: z.array(
        z.object({
          module: z.string(),
          moduleName: z.string(),
          read: z.boolean().nullable().default(false),
          create: z.boolean().nullable().default(false),
          update: z.boolean().nullable().default(false),
          approve: z.boolean().nullable().default(false),
          admin: z.boolean().nullable().default(false),
        }),
      ),
    }),
  ),
  contractVersion: z.string(),
});

export const adminOrganizationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  timezone: z.string(),
  active: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
  contractVersion: z.string(),
});

export const adminMutationSchema = z.object({
  success: z.literal(true),
  contractVersion: z.string(),
}).passthrough();

export const adminPasswordResetSchema = z.object({
  profileId: z.string().uuid(),
  email: z.string().email(),
  contractVersion: z.string(),
});

export const adminInviteSchema = z.object({
  success: z.literal(true),
  profileId: z.string().uuid().nullable(),
  contractVersion: z.string(),
});

export const mfaStatusSchema = z.object({
  currentLevel: z.enum(['aal1', 'aal2']).nullable(),
  nextLevel: z.enum(['aal1', 'aal2']).nullable(),
  factors: z.array(
    z.object({
      id: z.string(),
      friendlyName: z.string().nullable(),
      status: z.string(),
      factorType: z.string(),
    }),
  ),
});

export const mfaEnrollmentSchema = z.object({
  factorId: z.string(),
  qrCode: z.string(),
  secret: z.string(),
});

export interface AdminUserQuery {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminInviteInput {
  email: string;
  displayName: string;
  employeeCode?: string;
  roles: string[];
  primaryRole: string;
}

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;
export type AdminRoleCatalog = z.infer<typeof adminRoleCatalogSchema>;
export type AdminOrganization = z.infer<typeof adminOrganizationSchema>;
export type MfaStatus = z.infer<typeof mfaStatusSchema>;
export type MfaEnrollment = z.infer<typeof mfaEnrollmentSchema>;
