import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import {
  FinanceBillingAdapter,
  OrdersBillingAdapter,
} from '@/infrastructure/billing/billing-domain-adapters';
import { SupabaseBillingRepository } from '@/infrastructure/billing/supabase-billing-repository';
import { SupabaseFinanceRepository } from '@/infrastructure/finance/supabase-finance-repository';
import { SupabaseOrderWorkflowRepository } from '@/infrastructure/orders/supabase-order-workflow-repository';
import { SupabaseOrderEvidenceStorage } from '@/infrastructure/evidence/supabase-order-evidence-storage';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AuthService } from '@/modules/auth/application/auth-service';
import { BillingService } from '@/modules/billing/application/billing-service';
import { FinanceService } from '@/modules/finance/application/finance-service';
import { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';

export interface BillingBrowserApplication {
  readonly auth: AuthService;
  readonly billing: BillingService;
}

export function createBillingBrowserApplication(): BillingBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  const finance = new FinanceService(new SupabaseFinanceRepository(client));
  const workflow = new OrderWorkflowService(new SupabaseOrderWorkflowRepository(client));
  const orderAdapter = new OrdersBillingAdapter(workflow);

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    billing: new BillingService(
      new SupabaseBillingRepository(client),
      new FinanceBillingAdapter(finance),
      orderAdapter,
      orderAdapter,
      new SupabaseOrderEvidenceStorage(client),
    ),
  };
}
