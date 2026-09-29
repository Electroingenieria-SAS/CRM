import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !publishableKey || !password) {
  throw new Error('Missing local Supabase logistics concurrency environment.');
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

function oneWinner(label, results) {
  const winners = results.filter((item) => !item.error && item.data?.success === true);
  const losers = results.filter((item) => item.error);
  if (winners.length !== 1 || losers.length !== 1) {
    throw new Error(
      `${label} concurrency failed. winners=${winners.length} losers=${losers.length}`,
    );
  }
  return winners[0];
}

const coordinatorA = await signIn('qa-coordinator-a@example.test');
const coordinatorB = await signIn('qa-coordinator-b@example.test');
const orderId = '99100000-0000-4000-8000-000000000020';
const carrierId = '99100000-0000-4000-8000-000000000001';
const destinationId = '99100000-0000-4000-8000-000000000002';
const evidenceId = '99100000-0000-4000-8000-000000000040';

const { data: release, error: releaseError } = await coordinatorA.rpc('erp_x_logistics_release', {
  p_order_id: orderId,
  p_payload: {
    carrierId,
    destinationId,
    estimatedFreight: 20000,
    estimatedFreightLow: 18000,
    estimatedFreightHigh: 23000,
  },
  p_idempotency_key: 'conc-release-1',
});

if (releaseError || !release?.shipmentId) {
  throw new Error(
    'Could not release concurrency shipment: ' + (releaseError?.message ?? 'missing id'),
  );
}

const shipmentId = release.shipmentId;

const guideResults = await Promise.all([
  coordinatorA.rpc('erp_x_logistics_save_guide', {
    p_shipment_id: shipmentId,
    p_carrier_id: carrierId,
    p_tracking_number: 'CONC-GUIDE-A',
    p_idempotency_key: 'conc-guide-a',
  }),
  coordinatorB.rpc('erp_x_logistics_save_guide', {
    p_shipment_id: shipmentId,
    p_carrier_id: carrierId,
    p_tracking_number: 'CONC-GUIDE-B',
    p_idempotency_key: 'conc-guide-b',
  }),
]);

oneWinner('guide', guideResults);

const { data: afterGuide, error: guideDetailError } = await coordinatorA.rpc(
  'erp_x_logistics_detail',
  { p_order_id: orderId },
);
if (guideDetailError || !afterGuide?.shipment?.version)
  throw guideDetailError ?? new Error('Missing guide detail');

const dispatchResults = await Promise.all([
  coordinatorA.rpc('erp_x_logistics_dispatch', {
    p_shipment_id: shipmentId,
    p_expected_version: afterGuide.shipment.version,
    p_actual_freight: 22000,
    p_idempotency_key: 'conc-dispatch-a',
  }),
  coordinatorB.rpc('erp_x_logistics_dispatch', {
    p_shipment_id: shipmentId,
    p_expected_version: afterGuide.shipment.version,
    p_actual_freight: 24000,
    p_idempotency_key: 'conc-dispatch-b',
  }),
]);

const dispatchWinner = oneWinner('dispatch', dispatchResults);
const dispatchWinnerKey =
  dispatchResults[0] === dispatchWinner ? 'conc-dispatch-a' : 'conc-dispatch-b';

const retryDispatch = await coordinatorA.rpc('erp_x_logistics_dispatch', {
  p_shipment_id: shipmentId,
  p_expected_version: 1,
  p_actual_freight: 999999,
  p_idempotency_key: dispatchWinnerKey,
});
if (retryDispatch.error || retryDispatch.data?.idempotent !== true) {
  throw new Error('Dispatch retry was not idempotent.');
}

const { data: afterDispatch, error: dispatchDetailError } = await coordinatorA.rpc(
  'erp_x_logistics_detail',
  { p_order_id: orderId },
);
if (dispatchDetailError || afterDispatch?.shipment?.status !== 'IN_TRANSIT') {
  throw dispatchDetailError ?? new Error('Shipment did not reach IN_TRANSIT');
}

const deliveryVersion = afterDispatch.shipment.version;
const deliveryResults = await Promise.all([
  coordinatorA.rpc('erp_x_logistics_deliver', {
    p_shipment_id: shipmentId,
    p_received_by: 'Receptor A',
    p_observation: 'Concurrent delivery A',
    p_evidence_id: evidenceId,
    p_expected_version: deliveryVersion,
    p_idempotency_key: 'conc-deliver-a',
  }),
  coordinatorB.rpc('erp_x_logistics_deliver', {
    p_shipment_id: shipmentId,
    p_received_by: 'Receptor B',
    p_observation: 'Concurrent delivery B',
    p_evidence_id: evidenceId,
    p_expected_version: deliveryVersion,
    p_idempotency_key: 'conc-deliver-b',
  }),
]);

const deliveryWinner = oneWinner('delivery', deliveryResults);
const deliveryWinnerKey =
  deliveryResults[0] === deliveryWinner ? 'conc-deliver-a' : 'conc-deliver-b';

const retryDelivery = await coordinatorA.rpc('erp_x_logistics_deliver', {
  p_shipment_id: shipmentId,
  p_received_by: 'Retry receptor',
  p_observation: 'Must not duplicate',
  p_evidence_id: evidenceId,
  p_expected_version: 1,
  p_idempotency_key: deliveryWinnerKey,
});
if (retryDelivery.error || retryDelivery.data?.idempotent !== true) {
  throw new Error('Delivery retry was not idempotent.');
}

const { data: finalDetail, error: finalError } = await coordinatorA.rpc('erp_x_logistics_detail', {
  p_order_id: orderId,
});
if (finalError) throw finalError;
if (finalDetail.shipment?.status !== 'DELIVERED') {
  throw new Error('Concurrent delivery did not produce one DELIVERED shipment.');
}

const events = finalDetail.events ?? [];
for (const type of ['GUIDE_RECORDED', 'DISPATCHED', 'DELIVERED']) {
  const count = events.filter((event) => event.eventType === type).length;
  if (count !== 1) throw new Error(`Expected one ${type} event, found ${count}`);
}

if (
  (finalDetail.attempts ?? []).filter((attempt) => attempt.outcome === 'DELIVERED').length !== 1
) {
  throw new Error('Expected exactly one delivered attempt.');
}

console.log(
  'LOGISTICS CONCURRENCY OK · single guide, single dispatch, single delivery and idempotent retries.',
);
