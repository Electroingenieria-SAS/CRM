import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !publishableKey || !password) {
  throw new Error('Missing local Supabase inventory concurrency environment.');
}

function client() {
  return createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn() {
  const current = client();
  const { error } = await current.auth.signInWithPassword({
    email: 'qa-aux-logistica@example.test',
    password,
  });
  if (error) throw error;
  return current;
}

async function findMaterial(current, reference) {
  const { data, error } = await current.rpc('erp_x_inventory_list', {
    p_search: reference,
    p_location_id: null,
    p_page: 1,
    p_page_size: 10,
  });
  if (error || !data?.items?.[0]) {
    throw new Error('Inventory fixture not found: ' + reference);
  }
  return data.items[0];
}

const a = await signIn();
const b = await signIn();

const reserveMaterial = await findMaterial(a, 'INV-CONC-RESERVE');
const reserveArgsA = {
  p_payload: {
    orderNumber: 'INV-CONC-A',
    materialId: reserveMaterial.materialId,
    quantity: 8,
    unit: reserveMaterial.unit,
  },
  p_idempotency_key: 'inv-conc-reserve-a',
};
const reserveArgsB = {
  p_payload: {
    orderNumber: 'INV-CONC-B',
    materialId: reserveMaterial.materialId,
    quantity: 8,
    unit: reserveMaterial.unit,
  },
  p_idempotency_key: 'inv-conc-reserve-b',
};

const [reserveA, reserveB] = await Promise.all([
  a.rpc('erp_x_inventory_reserve', reserveArgsA),
  b.rpc('erp_x_inventory_reserve', reserveArgsB),
]);
const reserveWinners = [reserveA, reserveB].filter((result) => !result.error);
const reserveLosers = [reserveA, reserveB].filter((result) => result.error);
if (reserveWinners.length !== 1 || reserveLosers.length !== 1) {
  throw new Error(
    'Double reservation invariant failed. winners=' +
      reserveWinners.length +
      ' losers=' +
      reserveLosers.length,
  );
}

const winnerArgs = reserveA.error ? reserveArgsB : reserveArgsA;
const replay = await a.rpc('erp_x_inventory_reserve', winnerArgs);
if (replay.error || replay.data?.reservationId !== reserveWinners[0].data?.reservationId) {
  throw new Error('Reservation retry did not return the original idempotent result.');
}

const { data: reserveAvailability, error: reserveAvailabilityError } = await a.rpc(
  'erp_x_inventory_availability',
  { p_material_id: reserveMaterial.materialId, p_variant_id: null },
);
if (reserveAvailabilityError || Number(reserveAvailability.reserved) !== 8) {
  throw new Error('Concurrent reservation overcommitted stock.');
}

const receiptMaterial = await findMaterial(a, 'INV-CONC-RECEIPT').catch(async () => {
  const { data, error } = await a.rpc('erp_x_inventory_availability', {
    p_material_id: 'a2000000-0000-4000-8000-000000000005',
    p_variant_id: null,
  });
  if (error) throw error;
  return {
    materialId: data.materialId,
    unit: data.unit,
    locationId: 'a1000000-0000-4000-8000-000000000001',
  };
});
const receiptArgs = {
  p_payload: {
    materialId: receiptMaterial.materialId,
    locationId: receiptMaterial.locationId ?? 'a1000000-0000-4000-8000-000000000001',
    quantity: 7,
    unit: receiptMaterial.unit,
    reference: 'INV-CONC-RECEIPT',
  },
  p_idempotency_key: 'inv-conc-receipt',
};
const [receiptA, receiptB] = await Promise.all([
  a.rpc('erp_x_inventory_receive', receiptArgs),
  b.rpc('erp_x_inventory_receive', receiptArgs),
]);
if (receiptA.error || receiptB.error || receiptA.data?.movementId !== receiptB.data?.movementId) {
  throw new Error('Double receipt idempotency failed.');
}

const mixed = await findMaterial(a, 'INV-CONC-MIXED');
const initialMixed = await a.rpc('erp_x_inventory_reserve', {
  p_payload: {
    orderNumber: 'INV-CONC-A',
    materialId: mixed.materialId,
    quantity: 5,
    unit: mixed.unit,
  },
  p_idempotency_key: 'inv-mixed-initial',
});
if (initialMixed.error) throw initialMixed.error;
const picked = await a.rpc('erp_x_inventory_pick', {
  p_reservation_id: initialMixed.data.reservationId,
  p_quantity: null,
  p_idempotency_key: 'inv-mixed-pick',
});
if (picked.error) throw picked.error;

const [newReserve, consume] = await Promise.all([
  b.rpc('erp_x_inventory_reserve', {
    p_payload: {
      orderNumber: 'INV-CONC-B',
      materialId: mixed.materialId,
      quantity: 5,
      unit: mixed.unit,
    },
    p_idempotency_key: 'inv-mixed-reserve',
  }),
  a.rpc('erp_x_inventory_consume', {
    p_reservation_id: initialMixed.data.reservationId,
    p_quantity: null,
    p_reason: 'Consumo simultáneo QA',
    p_idempotency_key: 'inv-mixed-consume',
  }),
]);
if (newReserve.error || consume.error) {
  throw new Error(
    'Reserve + consume concurrency failed: ' +
      (newReserve.error?.message ?? consume.error?.message ?? 'unknown'),
  );
}

const returnMaterial = await findMaterial(a, 'INV-CONC-RETURN');
const returnReserve = await a.rpc('erp_x_inventory_reserve', {
  p_payload: {
    orderNumber: 'INV-CONC-C',
    materialId: returnMaterial.materialId,
    quantity: 6,
    unit: returnMaterial.unit,
  },
  p_idempotency_key: 'inv-return-reserve',
});
if (returnReserve.error) throw returnReserve.error;
const returnPick = await a.rpc('erp_x_inventory_pick', {
  p_reservation_id: returnReserve.data.reservationId,
  p_quantity: null,
  p_idempotency_key: 'inv-return-pick',
});
if (returnPick.error) throw returnPick.error;

const returnArgs = {
  p_reservation_id: returnReserve.data.reservationId,
  p_quantity: null,
  p_reason: 'Sobrante QA',
  p_idempotency_key: 'inv-return-once',
};
const [returnA, returnB] = await Promise.all([
  a.rpc('erp_x_inventory_return', returnArgs),
  b.rpc('erp_x_inventory_return', returnArgs),
]);
if (returnA.error || returnB.error || returnA.data?.status !== 'CLOSED' || returnB.data?.status !== 'CLOSED') {
  throw new Error('Double return idempotency failed.');
}

console.log(
  'INVENTORY CONCURRENCY OK · no over-reservation, receipt/return retries are idempotent, reserve + consume stays consistent.',
);
