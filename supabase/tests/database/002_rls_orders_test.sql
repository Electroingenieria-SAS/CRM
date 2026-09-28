begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','authenticated','authenticated','seller@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000002','authenticated','authenticated','auditor@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000003','authenticated','authenticated','other@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('20000000-0000-0000-0000-000000000001','TEST_A','Test A'),
('20000000-0000-0000-0000-000000000002','TEST_B','Test B');

insert into erp_supply.profiles(id,organization_id,auth_user_id,email,display_name) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','seller@example.test','Seller'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','auditor@example.test','Auditor'),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','other@example.test','Other Org');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('30000000-0000-0000-0000-000000000001','ventas',true),
('30000000-0000-0000-0000-000000000002','auditoria',true),
('30000000-0000-0000-0000-000000000003','ventas',true);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"seller@example.test"}',
  true
);
set local role authenticated;

select is((select count(*) from erp_supply.organizations),1::bigint,'seller sees one organization');
select is((select count(*) from erp_supply.profiles),2::bigint,'seller sees only profiles in own organization');
select ok(erp_private.can_access_module('orders','create'),'ventas can create orders');
select lives_ok($$select public.erp_x_session()$$,'seller session resolves');

select lives_ok(
  $$select public.erp_x_create_order(
    '{"orderNumber":"TEST-001","orderType":"PVC","paymentCondition":"CASH","deliveryRoute":"LOCAL_DISPATCH","clientName":"Cliente Test","clientCity":"Cali","clientAddress":"Calle 1 # 2-3","items":[{"description":"Cable","quantity":2}]}'::jsonb,
    'idem-test-001'
  )$$,
  'seller creates a valid order'
);

select is((select count(*) from erp_supply.orders),1::bigint,'seller sees created order');
select is(
  (public.erp_x_create_order(
    '{"orderNumber":"IGNORED-BY-IDEMPOTENCY","orderType":"PVC","paymentCondition":"CASH","deliveryRoute":"LOCAL_DISPATCH","clientName":"Cliente Test","clientCity":"Cali","clientAddress":"Calle 1 # 2-3","items":[{"description":"Cable","quantity":2}]}'::jsonb,
    'idem-test-001'
  )->>'idempotent')::boolean,
  true,
  'repeated idempotency key does not duplicate order'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"auditor@example.test"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.erp_x_create_order(
    '{"orderNumber":"TEST-002","orderType":"PVC","paymentCondition":"CASH","deliveryRoute":"LOCAL_DISPATCH","clientName":"Cliente Test","clientCity":"Cali","clientAddress":"Calle 1 # 2-3","items":[{"description":"Cable","quantity":1}]}'::jsonb,
    'idem-test-002'
  )$$,
  '42501',
  'No autorizado para crear pedidos',
  'auditor cannot create orders'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"other@example.test"}',
  true
);
set local role authenticated;

select is((select count(*) from erp_supply.orders),0::bigint,'other organization cannot read seller order');

select * from finish();
rollback;
