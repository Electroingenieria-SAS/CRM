begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values(
  '00000000-0000-0000-0000-000000000000',
  'b1000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','supply-auditor@example.test','',now(),
  '{}'::jsonb,'{}'::jsonb,now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  'b2000000-0000-4000-8000-000000000001',
  o.id,
  'b1000000-0000-4000-8000-000000000001',
  'supply-auditor@example.test',
  'Supply Auditor',
  'SUP-AUDIT'
from erp_supply.organizations o
where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
values('b2000000-0000-4000-8000-000000000001','auditoria',true);

select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","email":"supply-auditor@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_supply_queue('PURCHASING',null,null,1,25)$$,
  'auditor can read purchasing queue'
);

select lives_ok(
  $$select public.erp_x_supply_queue('CUTTING',null,null,1,25)$$,
  'auditor can read cutting queue'
);

select throws_ok(
  $$select public.erp_x_procurement_request(
    '{"orderId":"00000000-0000-0000-0000-000000000001","lines":[]}'::jsonb,
    'auditor-must-not-create'
  )$$,
  '42501',
  'No autorizado para esta operación',
  'auditor cannot create purchase requests'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.erp_x_supply_queue('PURCHASING',null,null,1,25)$$,
  '42501',
  null,
  'anonymous cannot read supply queues'
);

select * from finish();
rollback;
