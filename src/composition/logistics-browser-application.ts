import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseOrderEvidenceStorage } from '@/infrastructure/evidence/supabase-order-evidence-storage';
import { SupabaseFreightRepository } from '@/infrastructure/freight/supabase-freight-repository';
import { SupabaseOrderWorkforceOutboxRepository } from '@/infrastructure/integrations/supabase-order-workforce-outbox-repository';
import { SupabaseWorkforceAutomationAdapter } from '@/infrastructure/integrations/supabase-workforce-automation-adapter';
import { OrdersLogisticsAdapter } from '@/infrastructure/logistics/orders-logistics-adapter';
import { SupabaseLogisticsWorkforceEvidenceAdapter } from '@/infrastructure/logistics/supabase-logistics-workforce-evidence-adapter';
import { SupabaseLogisticsRepository } from '@/infrastructure/logistics/supabase-logistics-repository';
import { SupabaseOrderWorkflowRepository } from '@/infrastructure/orders/supabase-order-workflow-repository';
import { SupabaseOrdersRepository } from '@/infrastructure/orders/supabase-orders-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseWorkforceEvidenceStorage } from '@/infrastructure/workforce/supabase-workforce-evidence-storage';
import { SupabaseWorkforceRepository } from '@/infrastructure/workforce/supabase-workforce-repository';
import { AuthService } from '@/modules/auth/application/auth-service';
import { FreightService } from '@/modules/freight/application/freight-service';
import { OrdersWorkforceAutomationService } from '@/modules/integrations/orders-workforce/application/orders-workforce-automation-service';
import { OrdersWorkforceMutationObserver } from '@/modules/integrations/orders-workforce/application/orders-workforce-mutation-observer';
import { LogisticsService } from '@/modules/logistics/application/logistics-service';
import { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';
import { OrdersService } from '@/modules/orders/application/orders-service';
import { WorkforceService } from '@/modules/workforce/application/workforce-service';

export interface LogisticsBrowserApplication {
  readonly auth: AuthService;
  readonly logistics: LogisticsService;
  readonly freight: FreightService;
}

export function createLogisticsBrowserApplication(): LogisticsBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  const orders = new OrdersService(new SupabaseOrdersRepository(client));
  const workforce = new WorkforceService(
    new SupabaseWorkforceRepository(client),
    new SupabaseWorkforceEvidenceStorage(client),
  );
  const workflow = new OrderWorkflowService(
    new SupabaseOrderWorkflowRepository(client),
    new OrdersWorkforceMutationObserver(
      new OrdersWorkforceAutomationService(
        new SupabaseOrderWorkforceOutboxRepository(client),
        new SupabaseWorkforceAutomationAdapter(client, workforce),
      ),
    ),
  );
  const freight = new FreightService(new SupabaseFreightRepository(client));
  const ordersLogistics = new OrdersLogisticsAdapter(orders, workflow);

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    logistics: new LogisticsService(
      new SupabaseLogisticsRepository(client),
      freight,
      ordersLogistics,
      ordersLogistics,
      new SupabaseLogisticsWorkforceEvidenceAdapter(client),
      new SupabaseOrderEvidenceStorage(client),
    ),
    freight,
  };
}
