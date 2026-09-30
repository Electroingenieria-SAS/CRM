begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('erp_supply','purchase_requests','purchase requests exist');
select has_table('erp_supply','purchase_orders','purchase orders exist');
select has_table('erp_supply','goods_receipts','goods receipts exist');
select has_table('erp_supply','order_receptions','order reception exists separately');
select has_table('erp_supply','picking_jobs','picking jobs exist');
select has_table('erp_supply','cutting_jobs','cutting jobs exist');
select has_table('erp_supply','supply_events','supply audit events exist');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='purchase_requests'),
  'purchase requests have RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='goods_receipts'),
  'goods receipts have RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='picking_jobs'),
  'picking jobs have RLS'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='cutting_jobs'),
  'cutting jobs have RLS'
);

select ok(
  not has_function_privilege('anon','public.erp_x_procurement_request(jsonb,text)','EXECUTE'),
  'anonymous cannot create purchase requests'
);
select ok(
  has_function_privilege('authenticated','public.erp_x_procurement_request(jsonb,text)','EXECUTE'),
  'authenticated may invoke guarded procurement API'
);
select ok(
  not has_function_privilege('anon','public.erp_x_cutting_start(uuid,text)','EXECUTE'),
  'anonymous cannot claim cutting work'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_supply_queue'),
  false,
  'supply queue is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_procurement_request'),
  true,
  'procurement mutation is a narrow SECURITY DEFINER transaction'
);

select ok(
  exists(select 1 from pg_indexes where schemaname='erp_supply' and indexname='uq_active_picking_order'),
  'one active picking job per order is enforced'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='erp_supply' and indexname='uq_active_cutting_order'),
  'one active cutting job per order is enforced'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='erp_supply' and indexname='uq_supply_event_idempotency'),
  'supply events have idempotency guard'
);

select is(
  (select count(*)::integer from erp_supply.workflow_transitions
   where from_step_code='COMPRAS' and to_step_code='RECEPCION_MERCANCIA' and active),
  0,
  'merchandise receiving is not part of the order workflow'
);
select is(
  (select count(*)::integer from erp_supply.workflow_transitions
   where from_step_code='COMPRAS' and to_step_code='RECEPCION_PEDIDO' and active),
  1,
  'procurement continues to order reception'
);
select is(
  (select count(*)::integer from erp_supply.workflow_transitions
   where from_step_code='RECEPCION_PEDIDO' and to_step_code='CORTE'
     and requires_cut is true and active),
  1,
  'orders requiring cut route to Corte'
);
select is(
  (select count(*)::integer from erp_supply.workflow_transitions
   where from_step_code='RECEPCION_PEDIDO' and to_step_code='ALISTAMIENTO'
     and requires_cut is false and active),
  1,
  'orders without cut route directly to Alistamiento'
);

select * from finish();
rollback;
