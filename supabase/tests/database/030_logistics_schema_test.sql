begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

select has_table('erp_supply','logistics_shipments','shipment ledger exists');
select has_table('erp_supply','logistics_events','append-only logistics events exist');
select has_table('erp_supply','delivery_attempts','delivery attempts exist');
select has_table('erp_supply','delivery_satisfaction','delivery satisfaction exists');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='logistics_shipments'),
  'shipments have RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='logistics_events'),
  'logistics events have RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='delivery_attempts'),
  'delivery attempts have RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='delivery_satisfaction'),
  'satisfaction has RLS'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='uq_logistics_tracking'),
  'tracking uniqueness index exists'
);
select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_logistics_queue'),
  'queue index exists'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.logistics_events','UPDATE'),
  'logistics event ledger cannot be updated'
);
select ok(
  not has_table_privilege('authenticated','erp_supply.logistics_events','DELETE'),
  'logistics event ledger cannot be deleted'
);
select ok(
  not has_table_privilege('authenticated','erp_supply.delivery_attempts','UPDATE'),
  'delivery attempts cannot be rewritten'
);
select ok(
  not has_table_privilege('authenticated','erp_supply.delivery_attempts','DELETE'),
  'delivery attempts cannot be deleted'
);

select ok(
  not has_function_privilege('anon','public.erp_x_logistics_release(uuid,jsonb,text)','EXECUTE'),
  'anonymous users cannot release shipments'
);
select ok(
  not has_function_privilege('anon','public.erp_x_logistics_dispatch(uuid,integer,numeric,text)','EXECUTE'),
  'anonymous users cannot dispatch'
);
select ok(
  not has_function_privilege('anon','public.erp_x_logistics_deliver(uuid,text,text,uuid,integer,text)','EXECUTE'),
  'anonymous users cannot confirm delivery'
);
select ok(
  has_function_privilege('authenticated','public.erp_x_logistics_release(uuid,jsonb,text)','EXECUTE'),
  'authenticated users may invoke guarded release RPC'
);
select ok(
  has_function_privilege('authenticated','public.erp_x_logistics_dispatch(uuid,integer,numeric,text)','EXECUTE'),
  'authenticated users may invoke guarded dispatch RPC'
);
select ok(
  has_function_privilege('authenticated','public.erp_x_logistics_deliver(uuid,text,text,uuid,integer,text)','EXECUTE'),
  'authenticated users may invoke guarded delivery RPC'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_logistics_dispatch'),
  false,
  'dispatch RPC is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_logistics_deliver'),
  false,
  'delivery RPC is SECURITY INVOKER'
);

select ok(
  exists(
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='erp_supply' and t.relname='logistics_shipments'
      and c.contype='c' and pg_get_constraintdef(c.oid) like '%actual_freight%'
  ),
  'shipment costs are protected by a database check'
);

select ok(
  exists(
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='erp_supply' and t.relname='logistics_shipments'
      and c.contype='u'
  ),
  'shipment uniqueness is enforced'
);

select ok(
  exists(
    select 1 from storage.buckets
    where id='order-finalization-evidence' and not public and file_size_limit=15728640
  ),
  'finalization evidence bucket is private and limited to 15 MB'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='order_finalization_storage_insert'
  ),
  'evidence upload has an organization-aware storage policy'
);

select * from finish();
rollback;
