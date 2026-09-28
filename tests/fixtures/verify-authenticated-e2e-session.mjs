import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !publishableKey || !password) {
  throw new Error('Missing local Supabase E2E environment.');
}

const client = createClient(apiUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: authData, error: authError } = await client.auth.signInWithPassword({
  email: 'qa-seller@example.test',
  password,
});

if (authError || !authData.session) {
  throw new Error(
    `Synthetic seller authentication failed: ${authError?.message ?? 'missing session'}`,
  );
}

const { data: sessionData, error: sessionError } = await client.rpc('erp_x_session');

if (sessionError) {
  throw new Error(
    `Operational session RPC failed: code=${sessionError.code ?? 'unknown'} message=${sessionError.message}`,
  );
}

if (sessionData?.profile?.email !== 'qa-seller@example.test') {
  throw new Error('Operational session did not return the synthetic seller profile.');
}

if (!Array.isArray(sessionData?.profile?.roles) || !sessionData.profile.roles.includes('ventas')) {
  throw new Error('Operational session did not return the ventas role.');
}

if (!Array.isArray(sessionData?.modules)) {
  throw new Error('Operational session did not return module capabilities.');
}

console.log('AUTH PREFLIGHT OK · synthetic seller authenticated and erp_x_session resolved.');
