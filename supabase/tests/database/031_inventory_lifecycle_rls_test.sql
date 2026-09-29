begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'b1000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','inventory-pgtap@example.test','',now(),
  '{}','{}',now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  'b2000000-0000-4000-8000-000000000001',o.id,
  'b1000000-0000-4000-8000-000000000001',
  'inventory-pgtap@example.test','Inventory pgTAP','INV-PGTAP'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
values ('b2000000-0000-4000-8000-000000000001','super_admin',true);

insert into erp_supply.material_master(id,organization_id,reference,name,unit)
select 'b3000000-0000-4000-8000-000000000001',o.id,'PGTAP-INV','Material pgTAP','UND'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.inventory_locations(id,organization_id,code,name)
select 'b4000000-0000-4000-8000-000000000001',o.id,'PGTAP-BOD','Bodega pgTAP'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,source,is_test
)
select v.id,o.id,v.number,'PVC','CASH','LOCAL_DISPATCH',
       'Cliente pgTAP','Cali','Calle pgTAP',
       'b2000000-0000-4000-8000-000000000001','ALISTAMIENTO','QUEUED','QA_BOT',true
from erp_supply.organizations o
cross join (
  values
    ('b5000000-0000-4000-8000-000000000001'::uuid,'PGTAP-INV-A'),
    ('b5000000-0000-4000-8000-000000000002'::uuid,'PGTAP-INV-B')
) v(id,number)
where o.code='EI';

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","email":"inventory-pgtap@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_inventory_receive(
    '{"materialId":"b3000000-0000-4000-8000-000000000001","locationId":"b4000000-0000-4000-8000-000000000001","quantity":10,"unit":"UND"}'::jsonb,
    'pgtap-receive'
  )$$,
  'receipt creates physical stock'
);

select is(
  (public.erp_x_inventory_availability(
    'b3000000-0000-4000-8000-000000000001',null
  )->>'available')::numeric,
  10::numeric,
  'availability begins at ten'
);

select lives_ok(
  $$select public.erp_x_inventory_reserve(
    '{"orderId":"b5000000-0000-4000-8000-000000000001","materialId":"b3000000-0000-4000-8000-000000000001","quantity":8,"unit":"UND"}'::jsonb,
    'pgtap-reserve-a'
  )$$,
  'reservation succeeds when stock exists'
);

select is(
  (public.erp_x_inventory_availability(
    'b3000000-0000-4000-8000-000000000001',null
  )->>'available')::numeric,
  2::numeric,
  'reservation reduces available stock'
);

select throws_ok(
  $$select public.erp_x_inventory_reserve(
    '{"orderId":"b5000000-0000-4000-8000-000000000002","materialId":"b3000000-0000-4000-8000-000000000001","quantity":8,"unit":"UND"}'::jsonb,
    'pgtap-reserve-b'
  )$$,
  '23514',null,
  'over-reservation is rejected in the database'
);

select lives_ok(
  $$select public.erp_x_inventory_pick(
    (
      select id from erp_supply.inventory_reservations
      where order_id='b5000000-0000-4000-8000-000000000001'
    ),
    null,'pgtap-pick'
  )$$,
  'picking converts reserved stock into committed stock'
);

select lives_ok(
  $$select public.erp_x_inventory_consume(
    (
      select id from erp_supply.inventory_reservations
      where order_id='b5000000-0000-4000-8000-000000000001'
    ),
    5,'Consumo pgTAP','pgtap-consume'
  )$$,
  'consumption removes physical and committed stock'
);

select lives_ok(
  $$select public.erp_x_inventory_return(
    (
      select id from erp_supply.inventory_reservations
      where order_id='b5000000-0000-4000-8000-000000000001'
    ),
    3,'Sobrante reutilizable','pgtap-return'
  )$$,
  'reusable remainder returns committed material to availability'
);

select is(
  (public.erp_x_inventory_availability(
    'b3000000-0000-4000-8000-000000000001',null
  )->>'onHand')::numeric,
  5::numeric,
  'only consumed material leaves physical stock'
);

select is(
  (public.erp_x_inventory_availability(
    'b3000000-0000-4000-8000-000000000001',null
  )->>'available')::numeric,
  5::numeric,
  'reusable remainder becomes available again'
);

select is(
  (
    select count(*)::integer
    from erp_supply.inventory_movements
    where material_id='b3000000-0000-4000-8000-000000000001'
      and movement_type in('RECEIPT','RESERVE','PICK','CONSUME','RETURN')
  ),
  5,
  'ledger explains the complete lifecycle'
);

select lives_ok(
  $$select public.erp_x_inventory_submit_count(
    (
      select id from erp_supply.inventory_balances
      where material_id='b3000000-0000-4000-8000-000000000001'
    ),
    5,'Conteo exacto','pgtap-count'
  )$$,
  'blind physical count can be submitted'
);

select is(
  (
    select status
    from erp_supply.inventory_counts
    where material_id='b3000000-0000-4000-8000-000000000001'
  ),
  'SUBMITTED',
  'count waits for independent review'
);

select lives_ok(
  $$select public.erp_x_inventory_review_count(
    (
      select id from erp_supply.inventory_counts
      where material_id='b3000000-0000-4000-8000-000000000001'
    ),
    'APPROVE','Conteo validado','pgtap-count-review'
  )$$,
  'authorized controller approves the count'
);

select is(
  (
    select status
    from erp_supply.inventory_counts
    where material_id='b3000000-0000-4000-8000-000000000001'
  ),
  'APPLIED',
  'exact count applies without fabricating a movement'
);

select * from finish();
rollback;
