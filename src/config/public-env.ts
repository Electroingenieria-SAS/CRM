import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('staging'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional().or(z.literal('')),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function hasSupabasePublicConfig(env: PublicEnv = getPublicEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
