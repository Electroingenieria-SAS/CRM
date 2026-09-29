import { SupabaseAnalyticsRepository } from '@/infrastructure/analytics/supabase-analytics-repository';
import { SupabaseAssistantRepository } from '@/infrastructure/assistant/supabase-assistant-repository';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseOrdersRepository } from '@/infrastructure/orders/supabase-orders-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseWorkforceEvidenceStorage } from '@/infrastructure/workforce/supabase-workforce-evidence-storage';
import { SupabaseWorkforceRepository } from '@/infrastructure/workforce/supabase-workforce-repository';
import { AnalyticsService } from '@/modules/analytics/application/analytics-service';
import { PacoService } from '@/modules/assistant/application/paco-service';
import { AuthService } from '@/modules/auth/application/auth-service';
import { OrdersService } from '@/modules/orders/application/orders-service';
import { WorkforceService } from '@/modules/workforce/application/workforce-service';

export interface PacoBrowserApplication {
  readonly auth: AuthService;
  readonly paco: PacoService;
}

export function createPacoBrowserApplication(): PacoBrowserApplication | null {
  if (typeof window === 'undefined') return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;

  const workforce = new WorkforceService(
    new SupabaseWorkforceRepository(client),
    new SupabaseWorkforceEvidenceStorage(client),
  );

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    paco: new PacoService(
      new SupabaseAssistantRepository(client),
      new OrdersService(new SupabaseOrdersRepository(client)),
      workforce,
      new AnalyticsService(new SupabaseAnalyticsRepository(client)),
    ),
  };
}
