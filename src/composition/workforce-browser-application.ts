import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseWorkforceEvidenceStorage } from '@/infrastructure/workforce/supabase-workforce-evidence-storage';
import { SupabaseWorkforceRepository } from '@/infrastructure/workforce/supabase-workforce-repository';
import { AuthService } from '@/modules/auth/application/auth-service';
import { WorkforceService } from '@/modules/workforce/application/workforce-service';

export interface WorkforceBrowserApplication {
  readonly auth: AuthService;
  readonly workforce: WorkforceService;
}

export function createWorkforceBrowserApplication(): WorkforceBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    workforce: new WorkforceService(
      new SupabaseWorkforceRepository(client),
      new SupabaseWorkforceEvidenceStorage(client),
    ),
  };
}
