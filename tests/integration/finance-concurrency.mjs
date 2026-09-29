import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !publishableKey || !password) {
  throw new Error('Missing local Supabase finance concurrency environment.');
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
const cajaA = await signIn('qa-caja-a@example.test');
const cajaB = await signIn('qa-caja-b@example.test');
const cartera = await signIn('qa-cartera@example.test');
const gerencia = await signIn('qa-gerencia@example.test');
const adminA = await signIn('qa-superadmin@example.test');

const suffix = Date.now();
const orderNumber = 'FIN-CONC-' + suffix;

const { data: created, error: createError } = await seller.rpc('erp_x_create_order', {
  p_payload: {
    orderNumber,
    orderType: 'PVN',
    paymentCondition: 'CASH',
    deliveryRoute: 'LOCAL_DISPATCH',
    clientName: 'Cliente financiero concurrencia',
    clientDocument: 'FIN-' + suffix,
    clientCity: 'Cali',
    clientAddress: 'Calle QA 1 # 2-3',
    heldByCashier: true,
    items: [{ description: 'Producto QA', quantity: 1 }],
  },
  p_idempotency_key: 'create-' + orderNumber,
});

if (createError || !created?.orderId) {
  throw new Error(
    'Could not create finance concurrency order: ' + (createError?.message ?? 'missing id'),
  );
}

const invoiceKey = 'invoice-' + orderNumber;
const invoiceArgs = {
  p_order_id: created.orderId,
  p_payload: {
    invoiceNumber: 'FAC-' + orderNumber,
    amount: 125000.005,
    currency: 'COP',
  },
  p_idempotency_key: invoiceKey,
};

const [invoiceA, invoiceB] = await Promise.all([
  adminA.rpc('erp_x_finance_register_invoice', invoiceArgs),
  adminA.rpc('erp_x_finance_register_invoice', invoiceArgs),
]);

if (invoiceA.error || invoiceB.error) {
  throw new Error(
    'Concurrent invoice retry failed: ' +
      (invoiceA.error?.message ?? invoiceB.error?.message ?? 'unknown'),
  );
}

const idempotentFlags = [invoiceA.data?.idempotent, invoiceB.data?.idempotent].sort();
if (idempotentFlags[0] !== false || idempotentFlags[1] !== true) {
  throw new Error('Expected one invoice creation and one idempotent replay.');
}

const { data: summary, error: summaryError } = await adminA.rpc('erp_x_finance_order_summary', {
  p_order_id: created.orderId,
});
if (summaryError) throw summaryError;
if (summary.invoices?.length !== 1 || Number(summary.paidAmount) !== 125000.01) {
  throw new Error('Invoice concurrency/rounding invariant failed: ' + JSON.stringify(summary));
}

const supportKey = 'support-' + orderNumber;
const { data: support, error: supportError } = await cajaA.rpc('erp_x_finance_add_support', {
  p_order_id: created.orderId,
  p_invoice_id: null,
  p_payload: {
    supportType: 'TRANSFER',
    storageProvider: 'QA',
    storageReference: 'qa://finance/' + orderNumber,
  },
  p_idempotency_key: supportKey,
});
if (supportError || !support?.supportId) {
  throw new Error(
    'Could not create concurrent support fixture: ' + (supportError?.message ?? 'missing id'),
  );
}

const [supportA, supportB] = await Promise.all([
  cajaA.rpc('erp_x_finance_validate_support', {
    p_support_id: support.supportId,
    p_decision: 'VALIDATED',
    p_reason: 'Caja A valida',
    p_idempotency_key: 'support-a-' + orderNumber,
  }),
  cajaB.rpc('erp_x_finance_validate_support', {
    p_support_id: support.supportId,
    p_decision: 'REJECTED',
    p_reason: 'Caja B rechaza',
    p_idempotency_key: 'support-b-' + orderNumber,
  }),
]);

const supportWinners = [supportA, supportB].filter((result) => !result.error);
const supportLosers = [supportA, supportB].filter((result) => result.error);
if (supportWinners.length !== 1 || supportLosers.length !== 1) {
  throw new Error(
    'Support concurrency invariant failed. winners=' +
      supportWinners.length +
      ' losers=' +
      supportLosers.length,
  );
}

const { data: customerSearch, error: customerError } = await seller.rpc(
  'erp_x_finance_customer_search',
  { p_search: 'FIN-' + suffix, p_limit: 5 },
);
if (customerError || !customerSearch?.items?.[0]?.id) {
  throw new Error('Could not resolve customer for credit concurrency fixture.');
}

const { data: credit, error: creditError } = await seller.rpc(
  'erp_x_finance_create_credit_request',
  {
    p_payload: {
      customerId: customerSearch.items[0].id,
      requestedAmount: 500000,
      requestedTermDays: 30,
    },
    p_idempotency_key: 'credit-' + orderNumber,
  },
);
if (creditError || !credit?.requestId) {
  throw new Error(
    'Could not create credit concurrency fixture: ' + (creditError?.message ?? 'missing id'),
  );
}

const [creditA, creditB] = await Promise.all([
  cartera.rpc('erp_x_finance_decide_credit_request', {
    p_request_id: credit.requestId,
    p_decision: 'APPROVED',
    p_reason: 'Cartera aprueba',
    p_idempotency_key: 'credit-a-' + orderNumber,
  }),
  gerencia.rpc('erp_x_finance_decide_credit_request', {
    p_request_id: credit.requestId,
    p_decision: 'REJECTED',
    p_reason: 'Gerencia rechaza',
    p_idempotency_key: 'credit-b-' + orderNumber,
  }),
]);

const creditWinners = [creditA, creditB].filter((result) => !result.error);
const creditLosers = [creditA, creditB].filter((result) => result.error);
if (creditWinners.length !== 1 || creditLosers.length !== 1) {
  throw new Error(
    'Credit decision concurrency invariant failed. winners=' +
      creditWinners.length +
      ' losers=' +
      creditLosers.length,
  );
}

console.log(
  'FINANCE CONCURRENCY OK · invoice idempotency, support validation and credit decision are single-winner.',
);
