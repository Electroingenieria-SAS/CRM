begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_schema('erp_supply','internal operational schema exists');
select has_schema('erp_private','private security helper schema exists');
select has_table('erp_supply','profiles','profiles table exists');
select has_table('erp_supply','role_module_permissions','permission table exists');
select has_table('erp_supply','orders','orders table exists');
select has_table('erp_supply','order_items','order items table exists');
select has_table('erp_supply','order_tasks','order tasks table exists');
select has_table('erp_supply','order_events','order events table exists');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='orders'),
  'orders has RLS enabled'
);

select ok(
  not has_function_privilege('anon','public.erp_x_create_order(jsonb,text)','EXECUTE'),
  'anon cannot execute order creation'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_create_order(jsonb,text)','EXECUTE'),
  'authenticated may execute guarded order creation'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_create_order'),
  false,
  'public order API uses SECURITY INVOKER'
);

select * from finish();
rollback;
