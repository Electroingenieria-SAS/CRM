const ROLE_CODE_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export type RoleCode = string & { readonly __roleCode: unique symbol };

export function parseRoleCode(value: string): RoleCode {
  const normalized = value.trim().toLowerCase();
  if (!ROLE_CODE_PATTERN.test(normalized)) {
    throw new Error(`Código de rol inválido: ${value}`);
  }
  return normalized as RoleCode;
}

export const privilegedRoleCodes = {
  superAdmin: parseRoleCode('super_admin'),
  admin: parseRoleCode('admin'),
  management: parseRoleCode('gerencia'),
  audit: parseRoleCode('auditoria'),
} as const;
