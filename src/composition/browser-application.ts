import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseCustomerIntelligenceRepository } from '@/infrastructure/customers/supabase-customer-intelligence-repository';
import { SupabaseFinanceRepository } from '@/infrastructure/finance/supabase-finance-repository';
import { SupabaseFreightRepository } from '@/infrastructure/freight/supabase-freight-repository';
import { SupabaseOrderWorkforceOutboxRepository } from '@/infrastructure/integrations/supabase-order-workforce-outbox-repository';
import { SupabaseWorkforceAutomationAdapter } from '@/infrastructure/integrations/supabase-workforce-automation-adapter';
import { SupabaseOrderWorkflowRepository } from '@/infrastructure/orders/supabase-order-workflow-repository';
import { SupabaseOrdersRepository } from '@/infrastructure/orders/supabase-orders-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseWorkforceEvidenceStorage } from '@/infrastructure/workforce/supabase-workforce-evidence-storage';
import { SupabaseWorkforceRepository } from '@/infrastructure/workforce/supabase-workforce-repository';
import { AuthService } from '@/modules/auth/application/auth-service';
import { CustomerIntelligenceService } from '@/modules/customers/application/customer-intelligence-service';
import { FinanceService } from '@/modules/finance/application/finance-service';
import { FreightService } from '@/modules/freight/application/freight-service';
import { OrdersWorkforceAutomationService } from '@/modules/integrations/orders-workforce/application/orders-workforce-automation-service';
import { OrdersWorkforceMutationObserver } from '@/modules/integrations/orders-workforce/application/orders-workforce-mutation-observer';
import { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';
import { OrdersService } from '@/modules/orders/application/orders-service';
import { WorkforceService } from '@/modules/workforce/application/workforce-service';

export interface BrowserApplication {
  readonly auth: AuthService;
  readonly orders: OrdersService;
  readonly customerIntelligence: CustomerIntelligenceService;
  readonly freight: FreightService;
  readonly finance: FinanceService;
  readonly orderWorkflow: OrderWorkflowService;
}

export function createBrowserApplication(): BrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  const workforce = new WorkforceService(
    new SupabaseWorkforceRepository(client),
    new SupabaseWorkforceEvidenceStorage(client),
  );
  const automation = new OrdersWorkforceAutomationService(
    new SupabaseOrderWorkforceOutboxRepository(client),
    new SupabaseWorkforceAutomationAdapter(client, workforce),
  );

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    orders: new OrdersService(new SupabaseOrdersRepository(client)),
    customerIntelligence: new CustomerIntelligenceService(
      new SupabaseCustomerIntelligenceRepository(client),
    ),
    orderWorkflow: new OrderWorkflowService(
      new SupabaseOrderWorkflowRepository(client),
      new OrdersWorkforceMutationObserver(automation),
    ),
    freight: new FreightService(new SupabaseFreightRepository(client)),
    finance: new FinanceService(new SupabaseFinanceRepository(client)),
  };
}
