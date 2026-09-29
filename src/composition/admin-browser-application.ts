import { SupabaseAdminRepository } from '@/infrastructure/admin/supabase-admin-repository';
import { SupabaseMfaGateway } from '@/infrastructure/admin/supabase-mfa-gateway';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AdminService } from '@/modules/admin/application/admin-service';
import type { MfaGateway } from '@/modules/admin/ports/mfa-gateway';
import { AuthService } from '@/modules/auth/application/auth-service';

export interface AdminBrowserApplication {
  readonly auth: AuthService;
  readonly admin: AdminService;
  readonly mfa: MfaGateway;
}

export function createAdminBrowserApplication(): AdminBrowserApplication | null {
  if (typeof window === 'undefined') return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    admin: new AdminService(new SupabaseAdminRepository(client)),
    mfa: new SupabaseMfaGateway(client),
  };
}
