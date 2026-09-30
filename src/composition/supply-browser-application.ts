import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseInventoryRepository } from '@/infrastructure/inventory/supabase-inventory-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseSupplyRepository } from '@/infrastructure/supply/supabase-supply-repository';
import { AuthService } from '@/modules/auth/application/auth-service';
import { InventoryService } from '@/modules/inventory/application/inventory-service';
import { SupplyService } from '@/modules/supply/application/supply-service';

export interface SupplyBrowserApplication {
  readonly auth: AuthService;
  readonly supply: SupplyService;
}

export function createSupplyBrowserApplication(): SupplyBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  const inventory = new InventoryService(new SupabaseInventoryRepository(client));

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    supply: new SupplyService(
      new SupabaseSupplyRepository(client),
      inventory,
      inventory,
      inventory,
    ),
  };
}
