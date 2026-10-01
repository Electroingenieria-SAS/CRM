import postgres from 'postgres';

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
const AUDIENCE = 'crm-migration-source-export';
const REPOSITORY = 'Electroingenieria-SAS/CRM';
const REPOSITORY_ID = '1387615740';
const REPOSITORY_OWNER_ID = '308466143';
const ACTOR_ID = '282648667';
const WORKFLOW_PREFIX = 'Electroingenieria-SAS/CRM/.github/workflows/migration-dry-run.yml@';

const TABLES = new Set([
  'organizations',
  'roles',
  'profiles',
  'profile_roles',
  'orders',
  'order_items',
  'order_tasks',
  'invoices',
  'material_master',
  'material_variants',
  'inventory_items',
  'inventory_lots',
  'material_reservations',
  'deliveries',
  'inventory_movements',
  'work_activity_catalog',
  'work_assignments',
  'work_assignment_members',
  'work_executions',
  'work_evidence',
  'system_audit',
]);

const dbUrl = Deno.env.get('SUPABASE_DB_URL');
if (!dbUrl) throw new Error('SUPABASE_DB_URL unavailable');

const sql = postgres(dbUrl, {
  max: 1,
  prepare: false,
  idle_timeout: 5,
  connect_timeout: 10,
});

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function responseJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function decodeBase64Url(value: string): Uint8Array {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  normalized += '='.repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

type Claims = {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  repository?: string;
  repository_id?: string;
  repository_owner_id?: string;
  event_name?: string;
  head_ref?: string;
  base_ref?: string;
  ref?: string;
  workflow?: string;
  workflow_ref?: string;
  actor_id?: string;
  runner_environment?: string;
};

async function verifyOidc(token: string): Promise<Claims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed OIDC token');

  const header = JSON.parse(decoder.decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(decoder.decode(decodeBase64Url(parts[1]))) as Claims;

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Unsupported signing header');
  }

  const jwksResponse = await fetch(JWKS_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!jwksResponse.ok) throw new Error('GitHub JWKS unavailable');

  const jwks = await jwksResponse.json();
  const jwk = jwks.keys?.find(
    (candidate: Record<string, unknown>) =>
      candidate.kid === header.kid && candidate.kty === 'RSA',
  );
  if (!jwk) throw new Error('OIDC signing key not found');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    decodeBase64Url(parts[2]),
    encoder.encode(parts[0] + '.' + parts[1]),
  );
  if (!valid) throw new Error('OIDC signature rejected');

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (claims.iss !== ISSUER) throw new Error('OIDC issuer rejected');
  if (!audiences.includes(AUDIENCE)) throw new Error('OIDC audience rejected');
  if (!claims.exp || claims.exp < now - 30) throw new Error('OIDC expired');
  if (claims.nbf && claims.nbf > now + 30) throw new Error('OIDC not active');

  if (
    claims.repository !== REPOSITORY ||
    String(claims.repository_id) !== REPOSITORY_ID ||
    String(claims.repository_owner_id) !== REPOSITORY_OWNER_ID ||
    String(claims.actor_id) !== ACTOR_ID
  ) {
    throw new Error('Repository or actor rejected');
  }

  if (
    claims.runner_environment !== 'github-hosted' ||
    claims.workflow !== 'Migration dry-run' ||
    !claims.workflow_ref?.startsWith(WORKFLOW_PREFIX)
  ) {
    throw new Error('Runner or workflow rejected');
  }

  if (claims.event_name === 'pull_request') {
    if (
      claims.head_ref !== 'release/hilo15-oidc-source-rehearsal' ||
      claims.base_ref !== 'release/hilo15-controlled-production-migration'
    ) {
      throw new Error('PR refs rejected');
    }
  } else if (claims.event_name === 'workflow_dispatch') {
    if (claims.ref !== 'refs/heads/release/hilo15-controlled-production-migration') {
      throw new Error('Dispatch ref rejected');
    }
  } else {
    throw new Error('Event rejected');
  }

  return claims;
}

async function authorize(req: Request): Promise<Claims> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) throw new Error('Bearer token required');
  return await verifyOidc(header.slice(7));
}

function allowedTable(url: URL): string {
  const table = url.searchParams.get('table') ?? '';
  if (!TABLES.has(table)) throw new Error('Table rejected');
  return table;
}

async function fingerprint(table: string) {
  const query =
    'select count(*)::text as row_count,' +
    "coalesce(md5(string_agg(row_hash,'' order by row_hash)),md5('')) as digest " +
    'from (select md5(row_to_json(t)::text) row_hash from erp_supply.' +
    table +
    ' t) s';
  const rows = await sql.unsafe(query);
  return {
    table,
    count: Number(rows[0]?.row_count ?? 0),
    digest: String(rows[0]?.digest ?? ''),
  };
}

async function tablePage(table: string, offset: number, limit: number): Promise<Response> {
  const query =
    "select replace(encode(convert_to(payload,'UTF8'),'base64'),E'\\n','') payload " +
    'from (select row_to_json(t)::text payload from erp_supply.' +
    table +
    ' t) s order by md5(payload),payload limit $1 offset $2';
  const rows = await sql.unsafe(query, [limit, offset]);
  const payloads = rows.map((row) => String(row.payload));
  return new Response(payloads.length ? payloads.join('\n') + '\n' : '', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Row-Count': String(payloads.length),
      'X-Table': table,
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'GET') {
      return responseJson({ error: 'Method not allowed' }, 405);
    }

    const claims = await authorize(req);
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') ?? 'health';

    if (mode === 'health') {
      return responseJson({
        ok: true,
        repository: claims.repository,
        event: claims.event_name,
      });
    }

    if (mode === 'fingerprint') {
      return responseJson(await fingerprint(allowedTable(url)));
    }

    if (mode === 'table') {
      const table = allowedTable(url);
      const offset = Number(url.searchParams.get('offset') ?? '0');
      const limit = Number(url.searchParams.get('limit') ?? '250');
      if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 250
      ) {
        return responseJson({ error: 'Invalid pagination' }, 400);
      }
      return await tablePage(table, offset, limit);
    }

    return responseJson({ error: 'Unknown mode' }, 404);
  } catch (error) {
    console.error('migration-source-export rejected request', {
      message: error instanceof Error ? error.message : String(error),
    });
    return responseJson({ error: 'Unauthorized or export failed' }, 401);
  }
});
