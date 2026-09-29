import { createClient } from '@supabase/supabase-js';

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !publishableKey || !password) {
  throw new Error('Missing local Supabase workforce concurrency environment.');
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

const first = await signIn('qa-coordinator-a@example.test');
const second = await signIn('qa-coordinator-a@example.test');

const { data: catalog, error: catalogError } = await first.rpc('erp_x_workforce_catalog');
if (catalogError) throw catalogError;
const meeting = catalog.items?.find((item) => item.code === 'GEN_MEETING');
if (!meeting?.id) throw new Error('GEN_MEETING catalog item is unavailable.');

const key = 'wf-concurrency-' + Date.now();
const { data: created, error: createError } = await first.rpc('erp_x_workforce_create_activity', {
  p_payload: {
    catalogId: meeting.id,
    plannedStart: '2026-09-30T07:30:00-05:00',
    plannedEnd: '2026-09-30T08:30:00-05:00',
    title: 'Concurrency ' + key,
  },
  p_idempotency_key: 'create-' + key,
});

if (createError || !created?.activityId) {
  throw new Error('Could not create workforce activity: ' + (createError?.message ?? 'missing id'));
}

const startArgs = (suffix) => ({
  p_activity_id: created.activityId,
  p_expected_version: created.version,
  p_idempotency_key: 'start-' + key + '-' + suffix,
});

const starts = await Promise.all([
  first.rpc('erp_x_workforce_start_activity', startArgs('a')),
  second.rpc('erp_x_workforce_start_activity', startArgs('b')),
]);

const startWinners = starts.filter((item) => !item.error && item.data?.success);
const startLosers = starts.filter((item) => item.error);
if (startWinners.length !== 1 || startLosers.length !== 1) {
  throw new Error(
    'Start concurrency invariant failed. winners=' +
      startWinners.length +
      ' losers=' +
      startLosers.length,
  );
}

const winner = starts[0].error ? second : first;
const started = startWinners[0].data;

const completeArgs = (suffix) => ({
  p_activity_id: created.activityId,
  p_result_note: 'Concurrency completion',
  p_expected_version: started.version,
  p_idempotency_key: 'complete-' + key + '-' + suffix,
});

const completions = await Promise.all([
  first.rpc('erp_x_workforce_complete_activity', completeArgs('a')),
  second.rpc('erp_x_workforce_complete_activity', completeArgs('b')),
]);

const completeWinners = completions.filter((item) => !item.error && item.data?.success);
const completeLosers = completions.filter((item) => item.error);
if (completeWinners.length !== 1 || completeLosers.length !== 1) {
  throw new Error(
    'Completion concurrency invariant failed. winners=' +
      completeWinners.length +
      ' losers=' +
      completeLosers.length,
  );
}

const { data: detail, error: detailError } = await first.rpc('erp_x_workforce_activity_detail', {
  p_activity_id: created.activityId,
});
if (detailError) throw detailError;

const startEvents = detail.events.filter((event) => event.eventType === 'ACTIVITY_STARTED');
const completionEvents = detail.events.filter((event) => event.eventType === 'ACTIVITY_COMPLETED');
if (startEvents.length !== 1 || completionEvents.length !== 1) {
  throw new Error(
    'Expected one start and one completion event, got start=' +
      startEvents.length +
      ' complete=' +
      completionEvents.length,
  );
}

const winningSuffix = completions[0].error ? 'b' : 'a';
const repeated = await winner.rpc('erp_x_workforce_complete_activity', completeArgs(winningSuffix));
if (repeated.error || repeated.data?.idempotent !== true) {
  throw new Error(
    'Repeated workforce completion was not idempotent: ' +
      (repeated.error?.message ?? 'invalid result'),
  );
}

console.log('WORKFORCE CONCURRENCY OK · one start, one completion, idempotent retry.');
