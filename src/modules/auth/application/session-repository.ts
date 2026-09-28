import type { SessionContext } from '@/modules/auth/application/session.schemas';

export interface SessionRepository {
  load(): Promise<SessionContext>;
}
