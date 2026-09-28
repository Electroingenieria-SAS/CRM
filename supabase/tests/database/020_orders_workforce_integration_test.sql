begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('erp_supply','order_workforce_step_mappings','step mapping exists');
select has_table('erp_supply','order_workforce_outbox','durable outbox exists');
select has_function('public','erp_x_order_workforce_pending',array['uuid','integer'],'pending RPC exists');
select has_function('public','erp_x_order_workforce_claim_outbox',array['uuid'],'claim RPC exists');
select has_function('public','erp_x_order_workforce_reconcile',array['uuid','boolean'],'reconciliation RPC exists');
select has_function('public','erp_x_order_workforce_binding',array['uuid'],'binding RPC exists');
select has_function('public','erp_x_order_workforce_health',array[]::text[],'health RPC exists');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='order_workforce_outbox'),
  'outbox RLS is enabled'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_order_workforce_claim_outbox'),
  false,
  'public outbox claim is SECURITY INVOKER'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_order_workforce_health'),
  false,
  'integration health is SECURITY INVOKER'
);

select ok(
  not has_function_privilege('anon','public.erp_x_order_workforce_claim_outbox(uuid)','EXECUTE'),
  'anon cannot claim integration events'
);

select ok(
  not has_function_privilege('anon','public.erp_x_order_workforce_binding(uuid)','EXECUTE'),
  'anon cannot resolve task-to-activity bindings'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_order_workforce_claim_outbox(uuid)','EXECUTE'),
  'authenticated may execute guarded claim'
);

select is(
  (select count(*)::integer from erp_supply.order_workforce_step_mappings where active),
  6,
  'only audited operational delivery/picking/cutting steps are mapped'
);

select ok(
  not exists(
    select 1
    from erp_supply.order_workforce_step_mappings
    where step_code in('CARTERA','CAJA','COMPRAS','FACTURACION')
  ),
  'administrative and financial steps are not mapped'
);

select ok(
  not exists(
    select 1
    from erp_supply.order_workforce_step_mappings
    where step_code='PRODUCCION'
  ),
  'production is not invented when source workflow has no separate production step'
);

select * from finish();
rollback;
