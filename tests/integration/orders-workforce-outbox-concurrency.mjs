import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;
if (!url || !key || !password) throw new Error('Missing local E2E environment');

async function clientForCoordinator() {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: 'qa-coordinator-a@example.test',
    password,
  });
  if (error) throw error;
  return client;
}

const first = await clientForCoordinator();
const second = await clientForCoordinator();
const orderId = '95000000-0000-4000-8000-000000000001';

const { data: pending, error: pendingError } = await first.rpc('erp_x_order_workforce_pending', {
  p_order_id: orderId,
  p_limit: 10,
});
if (pendingError) throw pendingError;
const outboxId = pending?.items?.[0]?.id;
if (!outboxId) throw new Error('Expected one pending Orders-Workforce event');

const attempts = await Promise.allSettled([
  first.rpc('erp_x_order_workforce_claim_outbox', { p_outbox_id: outboxId }),
  second.rpc('erp_x_order_workforce_claim_outbox', { p_outbox_id: outboxId }),
]);

let winners = 0;
let rejected = 0;
for (const attempt of attempts) {
  if (attempt.status === 'rejected') {
    rejected += 1;
    continue;
  }
  const response = attempt.value;
  if (!response.error && response.data?.success) winners += 1;
  else if (response.error) rejected += 1;
}

if (winners !== 1 || rejected !== 1) {
  throw new Error(
    'Expected one atomic outbox winner and one rejection; got ' +
      JSON.stringify({ winners, rejected }),
  );
}

console.log('Orders-Workforce outbox concurrency OK', { winners, rejected, outboxId });
