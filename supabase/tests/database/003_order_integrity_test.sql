begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select col_not_null('erp_supply','orders','organization_id','order organization is required');
select col_not_null('erp_supply','orders','seller_profile_id','order seller is required');
select col_not_null('erp_supply','order_items','quantity','item quantity is required');

select throws_ok(
  $$insert into erp_supply.order_items(order_id,line_number,description,quantity,requires_cut)
    values ('00000000-0000-0000-0000-000000000000',1,'Invalid',1,false)$$,
  '23503',
  null,
  'orphan item is rejected by foreign key'
);

select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='uq_active_task_per_order'
  ),
  'active task uniqueness index exists'
);

select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='uq_event_idempotency'
  ),
  'event idempotency index exists'
);

select is(
  erp_supply.initial_step('PVE','CASH',false,false,false),
  'COMPRAS',
  'PVE starts in purchasing'
);

select * from finish();
rollback;
