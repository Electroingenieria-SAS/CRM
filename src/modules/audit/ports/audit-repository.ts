import type { AuditQuery, AuditResponse } from '@/modules/audit/application/audit.schemas';

export interface AuditRepository {
  list(query?: AuditQuery): Promise<AuditResponse>;
}
