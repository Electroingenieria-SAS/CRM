import { SupabaseAuditRepository } from '@/infrastructure/audit/supabase-audit-repository';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AuditService } from '@/modules/audit/application/audit-service';
import { AuthService } from '@/modules/auth/application/auth-service';

export interface AuditBrowserApplication {
  readonly auth: AuthService;
  readonly audit: AuditService;
}

export function createAuditBrowserApplication(): AuditBrowserApplication | null {
  if (typeof window === 'undefined') return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;
  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    audit: new AuditService(new SupabaseAuditRepository(client)),
  };
}
