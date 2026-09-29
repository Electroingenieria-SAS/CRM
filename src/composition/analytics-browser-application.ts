import { SupabaseAnalyticsRepository } from '@/infrastructure/analytics/supabase-analytics-repository';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AnalyticsService } from '@/modules/analytics/application/analytics-service';
import { AuthService } from '@/modules/auth/application/auth-service';

export interface AnalyticsBrowserApplication {
  readonly auth: AuthService;
  readonly analytics: AnalyticsService;
}

export function createAnalyticsBrowserApplication(): AnalyticsBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    analytics: new AnalyticsService(new SupabaseAnalyticsRepository(client)),
  };
}
