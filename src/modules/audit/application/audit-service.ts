import type { AuditRepository } from '@/modules/audit/ports/audit-repository';
import type { AuditQuery } from './audit.schemas';

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  list(query: AuditQuery = {}) {
    return this.repository.list({
      ...query,
      module: query.module?.trim() || undefined,
      action: query.action?.trim() || undefined,
      resource: query.resource?.trim() || undefined,
      result: query.result?.trim() || undefined,
      page: Math.max(query.page ?? 1, 1),
      pageSize: Math.min(Math.max(query.pageSize ?? 50, 1), 100),
    });
  }
}
