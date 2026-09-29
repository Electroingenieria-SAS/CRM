import { SupabaseObservabilityReporter } from '@/infrastructure/observability/supabase-observability-reporter';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';

export function createTelemetryBrowserReporter() {
  if (typeof window === 'undefined') return null;
  const client = createSupabaseBrowserClient();
  if (!client) return null;
  return new SupabaseObservabilityReporter(client);
}
