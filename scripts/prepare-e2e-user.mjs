const baseUrl = process.env.E2E_SUPABASE_URL;
const serviceRole = process.env.E2E_SERVICE_ROLE_KEY;
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

if (!baseUrl || !serviceRole || !email || !password) {
  throw new Error('Missing local E2E Supabase environment.');
}

const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  'Content-Type': 'application/json',
};

const create = await fetch(`${baseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic: true, purpose: 'crm-e2e' },
  }),
});

if (!create.ok) {
  throw new Error(`Unable to create E2E auth user: ${create.status} ${await create.text()}`);
}

const user = await create.json();
if (!user.id) {
  throw new Error('Auth admin response did not include a user id.');
}

const bind = await fetch(`${baseUrl}/rest/v1/rpc/e2e_bind_user`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    p_email: email,
    p_auth_user_id: user.id,
  }),
});

if (!bind.ok) {
  throw new Error(`Unable to bind E2E profile: ${bind.status} ${await bind.text()}`);
}

process.stdout.write('Synthetic E2E user prepared.\n');
