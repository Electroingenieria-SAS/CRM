begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('erp_supply','workflow_transitions','workflow transitions are persisted');
select has_table('erp_supply','order_blocks','operational blocks are persisted');
select has_table('erp_supply','order_issues','order issues are persisted separately');
select has_table('erp_supply','order_evidence','evidence references are persisted');

select ok(
  not has_function_privilege('anon','public.erp_x_claim_order_task(uuid,integer,text)','EXECUTE'),
  'anon cannot claim tasks'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_claim_order_task(uuid,integer,text)','EXECUTE'),
  'authenticated may invoke guarded claim RPC'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_claim_order_task'),
  false,
  'claim RPC is SECURITY INVOKER'
);

select ok(
  exists(select 1 from pg_indexes where schemaname='erp_supply' and indexname='uq_open_block_per_task'),
  'only one open operational block is allowed per task'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.order_events','UPDATE'),
  'order events are append-only for authenticated users'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.order_events','DELETE'),
  'order events cannot be deleted by authenticated users'
);

select is(
  (select to_step_code from erp_supply.workflow_transitions
   where from_step_code='ALISTAMIENTO' and order_type_code='PVN' and active
   order by priority limit 1),
  'CAJA_FACTURACION',
  'PVN routes from picking to cash billing'
);

select is(
  (select to_step_code from erp_supply.workflow_transitions
   where from_step_code='RECEPCION_PEDIDO' and active
   order by priority limit 1),
  'ALISTAMIENTO',
  'main order continues to picking while cut remains an integration subflow'
);

select ok(
  exists(select 1 from erp_supply.order_action_authorities where action_code='CANCEL' and role_code='jefe_logistica'),
  'cancellation authority is explicit and catalogued'
);

select * from finish();
rollback;
