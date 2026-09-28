import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseCustomerIntelligenceRepository } from '@/infrastructure/customers/supabase-customer-intelligence-repository';
import { SupabaseOrderWorkflowRepository } from '@/infrastructure/orders/supabase-order-workflow-repository';
import { SupabaseOrdersRepository } from '@/infrastructure/orders/supabase-orders-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AuthService } from '@/modules/auth/application/auth-service';
import { CustomerIntelligenceService } from '@/modules/customers/application/customer-intelligence-service';
import { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';
import { OrdersService } from '@/modules/orders/application/orders-service';

export interface BrowserApplication {
  readonly auth: AuthService;
  readonly orders: OrdersService;
  readonly customerIntelligence: CustomerIntelligenceService;
  readonly orderWorkflow: OrderWorkflowService;
}

export function createBrowserApplication(): BrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    orders: new OrdersService(new SupabaseOrdersRepository(client)),
    customerIntelligence: new CustomerIntelligenceService(
      new SupabaseCustomerIntelligenceRepository(client),
    ),
    orderWorkflow: new OrderWorkflowService(new SupabaseOrderWorkflowRepository(client)),
  };
}
