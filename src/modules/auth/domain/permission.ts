export type Permission =
  | 'orders.read'
  | 'orders.create'
  | 'orders.take'
  | 'orders.dispatch'
  | 'users.read'
  | 'users.update'
  | 'roles.manage'
  | 'reports.export';

export interface AuthorizationContext {
  readonly permissions: ReadonlySet<Permission>;
}

export function can(context: AuthorizationContext, permission: Permission): boolean {
  return context.permissions.has(permission);
}
