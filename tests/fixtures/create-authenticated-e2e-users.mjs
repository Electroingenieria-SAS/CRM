import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_LOCAL_SECRET_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !secretKey || !password) {
  throw new Error('Missing local Supabase E2E environment.');
}

const admin = createClient(apiUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  'qa-seller@example.test',
  'qa-auditor@example.test',
  'qa-recovery@example.test',
  'qa-superadmin@example.test',
];

for (const email of users) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture: 'e2e' },
  });

  if (error) {
    throw new Error(`Could not create synthetic E2E user ${email}: ${error.message}`);
  }
}
