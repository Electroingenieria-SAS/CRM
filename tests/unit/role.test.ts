import { describe, expect, it } from 'vitest';
import { parseRoleCode, privilegedRoleCodes } from '@/modules/auth/domain/role';

describe('role codes', () => {
  it('normalizes role codes without hardcoding the full production catalog', () => {
    expect(parseRoleCode(' Aux_Logistica ')).toBe('aux_logistica');
    expect(privilegedRoleCodes.superAdmin).toBe('super_admin');
  });

  it('rejects malformed role codes', () => {
    expect(() => parseRoleCode('admin/root')).toThrow('Código de rol inválido');
  });
});
