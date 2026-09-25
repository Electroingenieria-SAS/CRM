export const permissionActions = [
  'read',
  'create',
  'update',
  'delete',
  'approve',
  'admin',
  'export',
] as const;

export type PermissionAction = (typeof permissionActions)[number];
export type ResourceCode = string & { readonly __resourceCode: unique symbol };
export type Permission = `${string}.${PermissionAction}`;

export interface AuthorizationContext {
  readonly permissions: ReadonlySet<Permission>;
}

export function toResourceCode(value: string): ResourceCode {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`Código de recurso inválido: ${value}`);
  }
  return normalized as ResourceCode;
}

export function toPermission(resource: ResourceCode, action: PermissionAction): Permission {
  return `${resource}.${action}`;
}

export function can(context: AuthorizationContext, permission: Permission): boolean {
  return context.permissions.has(permission);
}
