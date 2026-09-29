import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

type InviteBody = {
  operation?: unknown;
  email?: unknown;
  displayName?: unknown;
  employeeCode?: unknown;
  roles?: unknown;
  primaryRole?: unknown;
};

function envKey(name: string, jsonName: string) {
  const direct = Deno.env.get(name)?.trim();
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get(jsonName) ?? '{}') as Record<string, string>;
    return parsed.default?.trim() ?? '';
  } catch {
    return '';
  }
}

function allowedOrigins() {
  return new Set(
    (Deno.env.get('APP_ALLOWED_ORIGINS') ?? 'http://127.0.0.1:3000,http://localhost:3000')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins().has(origin) ? origin : '';
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

function json(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

function text(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim())
    : [];
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (origin && !allowedOrigins().has(origin)) {
    return json(origin, 403, { error: 'Origin not allowed.' });
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json(origin, 405, { error: 'Method not allowed.' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(origin, 401, { error: 'Authentication required.' });
  }

  const url = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
  const publicKey =
    envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ||
    '';
  const serviceKey =
    envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS') ||
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim() ||
    '';

  if (!url || !publicKey || !serviceKey) {
    return json(origin, 500, { error: 'Function configuration incomplete.' });
  }

  const token = authHeader.slice('Bearer '.length);
  const userClient = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: identity, error: identityError } = await userClient.auth.getUser(token);
  if (identityError || !identity.user) {
    return json(origin, 401, { error: 'Invalid user session.' });
  }

  let body: InviteBody;
  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return json(origin, 400, { error: 'Invalid JSON body.' });
  }

  if (body.operation !== 'invite') {
    return json(origin, 400, { error: 'Unsupported operation.' });
  }

  const email = text(body.email, 254).toLowerCase();
  const displayName = text(body.displayName, 160);
  const employeeCode = text(body.employeeCode, 80) || null;
  const roles = stringArray(body.roles);
  const primaryRole = text(body.primaryRole, 80).toLowerCase();

  const { data: prepared, error: prepareError } = await userClient.rpc('erp_x_admin_invite_prepare', {
    p_email: email,
    p_display_name: displayName,
    p_employee_code: employeeCode,
    p_roles: roles,
    p_primary_role: primaryRole,
  });

  if (prepareError || !prepared) {
    return json(origin, prepareError?.code === '42501' ? 403 : 400, {
      error: prepareError?.message ?? 'Invite could not be authorized.',
    });
  }

  const preparedInvite = prepared as {
    organizationId: string;
    actorProfileId: string;
    email: string;
    displayName: string;
    employeeCode: string | null;
    roles: string[];
    primaryRole: string;
  };

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    preparedInvite.email,
    {
      data: {
        display_name: preparedInvite.displayName,
        employee_code: preparedInvite.employeeCode,
      },
    },
  );

  if (inviteError || !invited.user) {
    return json(origin, 502, { error: 'Supabase could not send the invitation.' });
  }

  const { data: finalized, error: finalizeError } = await adminClient.rpc(
    'erp_x_admin_invite_finalize',
    {
      p_organization_id: preparedInvite.organizationId,
      p_actor_profile_id: preparedInvite.actorProfileId,
      p_auth_user_id: invited.user.id,
      p_email: preparedInvite.email,
      p_display_name: preparedInvite.displayName,
      p_employee_code: preparedInvite.employeeCode,
      p_roles: preparedInvite.roles,
      p_primary_role: preparedInvite.primaryRole,
    },
  );

  if (finalizeError || !finalized) {
    return json(origin, 500, { error: 'Invitation sent, but CRM profile finalization failed.' });
  }

  return json(origin, 200, {
    success: true,
    profileId: (finalized as { profileId?: string }).profileId ?? null,
    contractVersion: '1.0.0',
  });
});
