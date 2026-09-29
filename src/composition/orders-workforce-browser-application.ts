import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseOrdersWorkforceIndicatorsRepository } from '@/infrastructure/integrations/supabase-orders-workforce-indicators-repository';
import { SupabaseOrderWorkforceOutboxRepository } from '@/infrastructure/integrations/supabase-order-workforce-outbox-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AuthService } from '@/modules/auth/application/auth-service';
import { OrdersWorkforceDashboardService } from '@/modules/integrations/orders-workforce/application/orders-workforce-dashboard-service';

export interface OrdersWorkforceBrowserApplication {
  readonly auth: AuthService;
  readonly dashboard: OrdersWorkforceDashboardService;
}

export function createOrdersWorkforceBrowserApplication(): OrdersWorkforceBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    dashboard: new OrdersWorkforceDashboardService(
      new SupabaseOrderWorkforceOutboxRepository(client),
      new SupabaseOrdersWorkforceIndicatorsRepository(client),
    ),
  };
}
