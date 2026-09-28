import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sessionContextSchema,
  type SessionContext,
} from '@/modules/auth/application/session.schemas';
import type { SessionRepository } from '@/modules/auth/application/session-repository';
import { AppError } from '@/shared/errors/app-error';

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(): Promise<SessionContext> {
    const { data, error } = await this.client.rpc('erp_x_session');

    if (error) {
      if (error.code === '42501') {
        throw new AppError('AUTHORIZATION', 'Tu usuario no tiene un perfil operativo activo.');
      }
      throw new AppError('DATABASE', 'No fue posible cargar tu contexto de trabajo.');
    }

    return sessionContextSchema.parse(data);
  }
}
