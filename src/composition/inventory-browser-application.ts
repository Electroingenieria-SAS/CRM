import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { SupabaseSessionRepository } from '@/infrastructure/auth/supabase-session-repository';
import { SupabaseInventoryRepository } from '@/infrastructure/inventory/supabase-inventory-repository';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { AuthService } from '@/modules/auth/application/auth-service';
import { InventoryService } from '@/modules/inventory/application/inventory-service';

export interface InventoryBrowserApplication {
  readonly auth: AuthService;
  readonly inventory: InventoryService;
}

export function createInventoryBrowserApplication(): InventoryBrowserApplication | null {
  if (typeof window === 'undefined') return null;

  const client = createSupabaseBrowserClient();
  if (!client) return null;

  return {
    auth: new AuthService(new SupabaseAuthGateway(client), new SupabaseSessionRepository(client)),
    inventory: new InventoryService(new SupabaseInventoryRepository(client)),
  };
}
