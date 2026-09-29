begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into erp_supply.organizations(id,code,name)
values('71000000-0000-4000-8000-000000000001','WF_CONTRACT','Workforce Contract');

select has_table('erp_supply','workforce_activity_catalog','workforce catalog exists');
select has_table('erp_supply','workforce_activities','workforce activities exist');
select has_table('erp_supply','workforce_activity_evidence','workforce evidence references exist');
select has_table('erp_supply','workforce_activity_events','workforce event ledger exists');
select has_table('erp_supply','workforce_profile_policies','profile metric policies exist');
select has_table('erp_supply','workforce_schedule_segments','schedule segments exist');
select has_table('erp_supply','workforce_holidays','holiday calendar exists');

select is(
  (select count(*) from erp_supply.workforce_schedule_segments
   where organization_id='71000000-0000-4000-8000-000000000001' and active),
  10::bigint,
  'five weekdays receive morning and afternoon segments'
);

select is(
  (select count(*) from erp_supply.workforce_schedule_segments
   where organization_id='71000000-0000-4000-8000-000000000001'
     and iso_weekday in (6,7)),
  0::bigint,
  'weekends are excluded from ordinary schedule'
);

select ok(
  exists(
    select 1 from erp_supply.workforce_holidays
    where organization_id='71000000-0000-4000-8000-000000000001'
      and holiday_date=date '2026-07-13'
      and legal_basis='Ley 2578 de 2026'
  ),
  '2026 Chiquinquira holiday is versioned on the observed Monday'
);

select is(
  erp_private.workforce_business_seconds(
    '71000000-0000-4000-8000-000000000001',
    '2026-09-29 07:00-05'::timestamptz,
    '2026-09-29 12:00-05'::timestamptz
  ),
  16200::bigint,
  'Tuesday-Friday morning business interval is four and a half hours'
);

select is(
  erp_private.workforce_business_seconds(
    '71000000-0000-4000-8000-000000000001',
    '2026-09-29 12:00-05'::timestamptz,
    '2026-09-29 13:30-05'::timestamptz
  ),
  0::bigint,
  'lunch break is excluded'
);

select is(
  erp_private.workforce_business_seconds(
    '71000000-0000-4000-8000-000000000001',
    '2026-09-28 13:30-05'::timestamptz,
    '2026-09-28 17:30-05'::timestamptz
  ),
  12600::bigint,
  'Monday afternoon ends at 17:00'
);

select is(
  erp_private.workforce_business_seconds(
    '71000000-0000-4000-8000-000000000001',
    '2026-09-29 13:30-05'::timestamptz,
    '2026-09-29 17:30-05'::timestamptz
  ),
  14400::bigint,
  'Tuesday-Friday afternoon runs until 17:30'
);

select is(
  erp_private.workforce_business_seconds(
    '71000000-0000-4000-8000-000000000001',
    '2026-07-13 07:30-05'::timestamptz,
    '2026-07-13 09:00-05'::timestamptz
  ),
  0::bigint,
  'national holidays are excluded'
);

select is(
  erp_private.workforce_business_seconds(
    '71000000-0000-4000-8000-000000000001',
    '2026-10-03 07:30-05'::timestamptz,
    '2026-10-03 09:00-05'::timestamptz
  ),
  0::bigint,
  'Saturday is excluded'
);

select ok(
  (select count(*) from erp_supply.workforce_activity_catalog
   where organization_id='71000000-0000-4000-8000-000000000001' and active) >= 14,
  'legacy valid activity catalog is preserved'
);

select ok(
  not has_function_privilege('anon','public.erp_x_workforce_create_activity(jsonb,text)','EXECUTE'),
  'anon cannot create workforce activities'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_workforce_create_activity(jsonb,text)','EXECUTE'),
  'authenticated may invoke guarded create RPC'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_workforce_create_activity'),
  false,
  'public create RPC uses SECURITY INVOKER'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.workforce_activity_events','UPDATE'),
  'workforce event ledger cannot be updated by authenticated users'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.workforce_activity_events','DELETE'),
  'workforce event ledger cannot be deleted by authenticated users'
);

select * from finish();
rollback;
