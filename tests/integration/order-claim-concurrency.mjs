import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !publishableKey || !password) {
  throw new Error('Missing local Supabase workflow concurrency environment.');
}

function client() {
  return createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email) {
  const current = client();
  const { error } = await current.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return current;
}

const seller = await signIn('qa-seller@example.test');
const orderNumber = `CONC-${Date.now()}`;

const { data: created, error: createError } = await seller.rpc('erp_x_create_order', {
  p_payload: {
    orderNumber,
    orderType: 'PVC',
    paymentCondition: 'CASH',
    deliveryRoute: 'LOCAL_DISPATCH',
    clientName: 'Cliente concurrencia QA',
    clientCity: 'Cali',
    clientAddress: 'Calle QA 1 # 2-3',
    items: [{ description: 'Cable QA', quantity: 1 }],
  },
  p_idempotency_key: `create-${orderNumber}`,
});

if (createError || !created?.orderId) {
  throw new Error(`Could not create concurrency order: ${createError?.message ?? 'missing id'}`);
}

const coordinatorA = await signIn('qa-coordinator-a@example.test');
const coordinatorB = await signIn('qa-coordinator-b@example.test');

const { data: detail, error: detailError } = await coordinatorA.rpc('erp_x_get_order', {
  p_order_id: created.orderId,
});

if (detailError || !detail?.order?.version) {
  throw new Error(`Could not load concurrency order: ${detailError?.message ?? 'missing version'}`);
}

const [orderItem] = detail.items ?? [];
if (!orderItem?.id) {
  throw new Error('Could not resolve the concurrency order item for Reception.');
}

const receptionKey = `reception-${orderNumber}`;
const { data: reception, error: receptionError } = await coordinatorA.rpc(
  'erp_x_order_reception_create',
  {
    p_payload: {
      orderId: created.orderId,
      lines: [
        {
          orderItemId: orderItem.id,
          materialId: 'a2000000-0000-4000-8000-000000000002',
          quantity: Number(orderItem.quantity),
          unit: orderItem.unit,
          requiresCut: Boolean(orderItem.requires_cut),
        },
      ],
    },
    p_idempotency_key: `${receptionKey}:create`,
  },
);

if (receptionError || !reception?.id) {
  throw new Error(
    `Could not prepare order reception contract: ${receptionError?.message ?? 'missing reception id'}`,
  );
}

const { error: receptionConfirmError } = await coordinatorA.rpc('erp_x_order_reception_confirm', {
  p_reception_id: reception.id,
  p_idempotency_key: `${receptionKey}:confirm`,
});

if (receptionConfirmError) {
  throw new Error(`Could not confirm order reception: ${receptionConfirmError.message}`);
}

const argsA = {
  p_order_id: created.orderId,
  p_expected_version: detail.order.version,
  p_idempotency_key: `claim-a-${orderNumber}`,
};
const argsB = {
  p_order_id: created.orderId,
  p_expected_version: detail.order.version,
  p_idempotency_key: `claim-b-${orderNumber}`,
};

const [a, b] = await Promise.all([
  coordinatorA.rpc('erp_x_claim_order_task', argsA),
  coordinatorB.rpc('erp_x_claim_order_task', argsB),
]);

const results = [a, b];
const winners = results.filter((item) => !item.error && item.data?.success === true);
const losers = results.filter((item) => item.error);

if (winners.length !== 1 || losers.length !== 1) {
  throw new Error(
    `Concurrency invariant failed. winners=${winners.length} losers=${losers.length}`,
  );
}

if (!losers[0].error.message.includes('Esta tarea ya fue tomada por otro usuario.')) {
  throw new Error(`Unexpected loser message: ${losers[0].error.message}`);
}

const { data: finalDetail, error: finalError } = await coordinatorA.rpc('erp_x_get_order', {
  p_order_id: created.orderId,
});

if (finalError) throw finalError;

const active = [...(finalDetail.tasks ?? [])]
  .reverse()
  .find((task) =>
    ['QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'BLOCKED'].includes(task.status),
  );

if (!active?.assigned_profile_id || active.status !== 'ASSIGNED') {
  throw new Error('Concurrency invariant failed: active task is not assigned exactly once.');
}

const claimEvents = (finalDetail.events ?? []).filter(
  (event) => event.event_type === 'ORDER_TASK_CLAIMED',
);

if (claimEvents.length !== 1) {
  throw new Error(`Expected one claim event, found ${claimEvents.length}`);
}

const winnerClient = a.error ? coordinatorB : coordinatorA;
const claimedVersion = finalDetail.order.version;

const { data: started, error: startError } = await winnerClient.rpc('erp_x_start_order_task', {
  p_order_id: created.orderId,
  p_expected_version: claimedVersion,
  p_idempotency_key: `start-${orderNumber}`,
});

if (startError || !started?.success) {
  throw new Error(`Could not start claimed task: ${startError?.message ?? 'unknown'}`);
}

const completeKey = `complete-${orderNumber}`;
const completeArgs = {
  p_order_id: created.orderId,
  p_result_code: 'QA_COMPLETE',
  p_detail: 'Concurrency/idempotency certification',
  p_expected_version: started.version,
  p_idempotency_key: completeKey,
};

const firstComplete = await winnerClient.rpc('erp_x_complete_order_task', completeArgs);
if (firstComplete.error || !firstComplete.data?.success || firstComplete.data.idempotent) {
  throw new Error(`First completion failed: ${firstComplete.error?.message ?? 'invalid result'}`);
}

const repeatedComplete = await winnerClient.rpc('erp_x_complete_order_task', completeArgs);
if (repeatedComplete.error || repeatedComplete.data?.idempotent !== true) {
  throw new Error(
    `Repeated completion was not idempotent: ${repeatedComplete.error?.message ?? 'invalid result'}`,
  );
}

const { data: afterComplete, error: afterError } = await winnerClient.rpc('erp_x_get_order', {
  p_order_id: created.orderId,
});
if (afterError) throw afterError;

const completionEvents = (afterComplete.events ?? []).filter(
  (event) => event.event_type === 'ORDER_TASK_COMPLETED',
);
if (completionEvents.length !== 1) {
  throw new Error(`Expected one completion event, found ${completionEvents.length}`);
}

if ((afterComplete.tasks ?? []).length !== 2) {
  throw new Error(
    `Expected exactly two sequential tasks after one advance, found ${afterComplete.tasks?.length}`,
  );
}

console.log(
  'CONCURRENCY + IDEMPOTENCY OK · one claimant, one completion event, one workflow advance.',
);
