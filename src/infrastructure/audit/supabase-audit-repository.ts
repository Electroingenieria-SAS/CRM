import type { SupabaseClient } from '@supabase/supabase-js';
import { auditResponseSchema, type AuditQuery } from '@/modules/audit/application/audit.schemas';
import type { AuditRepository } from '@/modules/audit/ports/audit-repository';
import { AppError } from '@/shared/errors/app-error';

export class SupabaseAuditRepository implements AuditRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(query: AuditQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_audit_events', {
      p_from: query.from ?? null,
      p_to: query.to ?? null,
      p_actor_id: query.actorId ?? null,
      p_module: query.module ?? null,
      p_action: query.action ?? null,
      p_resource: query.resource ?? null,
      p_result: query.result ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 50,
    });

    if (error?.code === '42501') {
      throw new AppError('AUTHORIZATION', 'No tienes acceso al visor de auditoría.');
    }
    if (error) throw new AppError('DATABASE', 'No fue posible consultar la auditoría.');
    return auditResponseSchema.parse(data);
  }
}
