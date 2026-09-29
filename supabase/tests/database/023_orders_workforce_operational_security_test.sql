begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

select is(
  (select prosecdef
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_claim_order_task'),
  true,
  'claim uses a narrow SECURITY DEFINER boundary'
);

select is(
  (select prosecdef
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_start_order_task'),
  true,
  'start uses a narrow SECURITY DEFINER boundary'
);

select is(
  (select prosecdef
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_block_order_task'),
  true,
  'block uses a narrow SECURITY DEFINER boundary'
);

select is(
  (select prosecdef
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_resume_order_task'),
  true,
  'resume uses a narrow SECURITY DEFINER boundary'
);

select is(
  (select prosecdef
   from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_complete_order_task'),
  true,
  'complete uses a narrow SECURITY DEFINER boundary'
);

select ok(
  not has_function_privilege('anon','public.erp_x_claim_order_task(uuid,integer,text)','EXECUTE')
  and not has_function_privilege('anon','public.erp_x_start_order_task(uuid,integer,text)','EXECUTE')
  and not has_function_privilege('anon','public.erp_x_block_order_task(uuid,text,text,integer,text)','EXECUTE')
  and not has_function_privilege('anon','public.erp_x_resume_order_task(uuid,text,integer,text)','EXECUTE')
  and not has_function_privilege('anon','public.erp_x_complete_order_task(uuid,text,text,integer,text)','EXECUTE'),
  'anonymous users cannot execute operational lifecycle mutations'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '87100000-0000-4000-8000-000000000001',
  'authenticated','authenticated','owf-minimal-aux@example.test','',now(),
  '{}','{}',now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '87200000-0000-4000-8000-000000000001',
  o.id,
  '87100000-0000-4000-8000-000000000001',
  'owf-minimal-aux@example.test',
  'OWF Auxiliar mínimo',
  'OWF-MIN-AUX'
from erp_supply.organizations o
where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
values ('87200000-0000-4000-8000-000000000001','aux_logistica',true);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,source,is_test
)
select
  '87300000-0000-4000-8000-000000000001',
  o.id,
  'OWF-MIN-RLS-1',
  'PVC','CASH','LOCAL_DISPATCH',
  'Cliente RLS mínimo','Cali','Calle RLS',
  '87200000-0000-4000-8000-000000000001',
  'ALISTAMIENTO','QUEUED','ERP',true
from erp_supply.organizations o
where o.code='EI';

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,assigned_role_code
) values (
  '87400000-0000-4000-8000-000000000001',
  '87300000-0000-4000-8000-000000000001',
  'ALISTAMIENTO',1,'ALISTAMIENTO','QUEUED','aux_logistica'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"87100000-0000-4000-8000-000000000001","role":"authenticated","email":"owf-minimal-aux@example.test"}',
  true
);
set local role authenticated;

select is(
  erp_private.can_access_module('orders','update'),
  false,
  'auxiliary keeps broad orders.update denied'
);

select lives_ok(
  $$select public.erp_x_claim_order_task(
    '87300000-0000-4000-8000-000000000001'::uuid,
    1,
    'owf-minimal:claim'
  )$$,
  'authorized auxiliary can claim through the narrow lifecycle RPC'
);

select is(
  (select assigned_profile_id
   from erp_supply.order_tasks
   where id='87400000-0000-4000-8000-000000000001'::uuid),
  '87200000-0000-4000-8000-000000000001'::uuid,
  'claim assigns the task to the authorized auxiliary without broad update permission'
);

select * from finish();
rollback;
