begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('erp_supply','freight_carriers','freight carriers table exists');
select has_table('erp_supply','freight_destinations','freight destinations table exists');
select has_table('erp_supply','freight_historical_aggregates','historical aggregates table exists');
select has_table('erp_supply','freight_observations','progressive observations table exists');
select has_table('erp_supply','freight_predictions','predictions table exists');
select has_table('erp_supply','freight_prediction_outcomes','prediction outcomes table exists');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='freight_observations'),
  'freight observations has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='freight_predictions'),
  'freight predictions has RLS enabled'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_freight_predict'),
  false,
  'public freight prediction API uses SECURITY INVOKER'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.erp_x_freight_predict(uuid,text,uuid,numeric,numeric,numeric,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute freight prediction'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.erp_x_freight_predict(uuid,text,uuid,numeric,numeric,numeric,uuid)',
    'EXECUTE'
  ),
  'authenticated may execute permission-guarded freight prediction'
);

select is(
  (select coalesce(sum(sample_count),0)::bigint
   from erp_supply.freight_historical_aggregates),
  749::bigint,
  'privacy-safe historical seed contains all 749 real dispatch samples'
);

select is(
  (select count(*) from erp_supply.freight_carriers
   where organization_id=(select id from erp_supply.organizations where code='EI')),
  3::bigint,
  'historical baseline has three stable carrier identities'
);

select is(
  erp_private.freight_city_key('Armenia, Quindío'),
  'ARMENIA',
  'city normalization removes department suffix'
);

select is(
  erp_private.freight_city_key('ARMENIA Q.'),
  'ARMENIA',
  'city normalization handles Armenia abbreviation'
);

select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='erp_supply'
      and indexname='uq_freight_observation_external_key'
  ),
  'external freight keys are protected by a partial unique index'
);

select * from finish();
rollback;
