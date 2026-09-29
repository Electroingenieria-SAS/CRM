begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('erp_supply','material_master','material master exists');
select has_table('erp_supply','material_variants','material variants exist');
select has_table('erp_supply','inventory_locations','inventory locations exist');
select has_table('erp_supply','inventory_balances','inventory balances exist');
select has_table('erp_supply','inventory_movements','immutable inventory ledger exists');
select has_table('erp_supply','inventory_reservations','inventory reservations exist');
select has_table('erp_supply','inventory_counts','physical counts exist');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='inventory_balances'),
  'inventory balances have RLS'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='inventory_movements'),
  'inventory ledger has RLS'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.inventory_balances','UPDATE'),
  'authenticated cannot edit stock directly'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.inventory_movements','INSERT'),
  'authenticated cannot inject movements directly'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.inventory_movements','UPDATE'),
  'confirmed movements cannot be updated directly'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.inventory_movements','DELETE'),
  'confirmed movements cannot be deleted directly'
);

select ok(
  not has_function_privilege('anon','public.erp_x_inventory_reserve(jsonb,text)','EXECUTE'),
  'anonymous users cannot reserve stock'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_inventory_reserve(jsonb,text)','EXECUTE'),
  'authenticated users can invoke guarded reservation API'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_inventory_list'),
  false,
  'inventory list is SECURITY INVOKER'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_inventory_availability'),
  true,
  'cross-domain availability is a narrow SECURITY DEFINER contract'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_inventory_movements_material_time'),
  'material movement timeline index exists'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_inventory_movements_order_time'),
  'order trace index exists'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='inventory_balances_identity'),
  'balance identity uniqueness exists'
);

select throws_ok(
  $$insert into erp_supply.inventory_balances(
      organization_id,material_id,location_id,on_hand,reserved,committed
    ) values(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      10,8,8
    )$$,
  '23514',null,
  'balance constraint forbids overcommitted stock before foreign keys are evaluated'
);

select throws_ok(
  $$insert into erp_supply.inventory_movements(
      organization_id,operation_id,material_id,location_id,movement_type,quantity,unit,
      on_hand_delta,reserved_delta,committed_delta,actor_profile_id
    ) values(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      'RECEIPT',0,'UND',0,0,0,
      '00000000-0000-0000-0000-000000000005'
    )$$,
  '23514',null,
  'movement quantity must be positive'
);

select * from finish();
rollback;
