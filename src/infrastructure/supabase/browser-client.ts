import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv, hasSupabasePublicConfig } from '@/config/public-env';

export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  if (!hasSupabasePublicConfig(env)) return null;

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
