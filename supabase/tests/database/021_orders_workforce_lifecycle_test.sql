begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000001','authenticated','authenticated','owf-a@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000002','authenticated','authenticated','owf-b@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('82000000-0000-4000-8000-000000000001','OWF_A','OWF A'),
('82000000-0000-4000-8000-000000000002','OWF_B','OWF B');

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','owf-a@example.test','OWF A'),
('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','owf-b@example.test','OWF B');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('83000000-0000-4000-8000-000000000001','coordinador_logistico',true),
('83000000-0000-4000-8000-000000000002','coordinador_logistico',true);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,source,is_test
) values
('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','OWF-OP-1','PVC','CASH','LOCAL_DISPATCH',
 'Cliente A','Cali','Calle Test 1','83000000-0000-4000-8000-000000000001','ALISTAMIENTO','ASSIGNED','ERP',true),
('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','OWF-ADMIN-1','PVC','CASH','LOCAL_DISPATCH',
 'Cliente A','Cali','Calle Test 2','83000000-0000-4000-8000-000000000001','FACTURACION','ASSIGNED','ERP',true);

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,assigned_profile_id,assigned_at
) values
('85000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','ALISTAMIENTO',1,'ALISTAMIENTO','ASSIGNED','83000000-0000-4000-8000-000000000001',now()),
('85000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000002','FACTURACION',1,'FACTURACION','ASSIGNED','83000000-0000-4000-8000-000000000001',now());

insert into erp_supply.order_events(
  organization_id,order_id,task_id,event_type,action_code,
  from_step_code,to_step_code,from_status,to_status,
  actor_profile_id,actor_role_code,idempotency_key,payload
) values
('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001',
 'ORDER_TASK_CLAIMED','CLAIM','ALISTAMIENTO','ALISTAMIENTO','QUEUED','ASSIGNED',
 '83000000-0000-4000-8000-000000000001','coordinador_logistico','owf-db-event-1',
 '{"integrationEvent":"OrderTaskClaimed","contractVersion":"1.0.0"}'::jsonb),
('82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000002',
 'ORDER_TASK_ASSIGNED','ASSIGN','FACTURACION','FACTURACION','QUEUED','ASSIGNED',
 '83000000-0000-4000-8000-000000000001','coordinador_logistico','owf-db-event-2',
 '{"integrationEvent":"OrderTaskAssigned","contractVersion":"1.0.0"}'::jsonb);

select is(
  (select count(*)::integer from erp_supply.order_workforce_outbox where order_id='84000000-0000-4000-8000-000000000001'),
  1,
  'one operational event creates exactly one outbox row'
);

select is(
  (select count(*)::integer from erp_supply.order_workforce_outbox where order_id='84000000-0000-4000-8000-000000000002'),
  0,
  'administrative step does not create Workforce integration'
);

select is(
  (select seller_profile_id from erp_supply.order_workforce_outbox where order_task_id='85000000-0000-4000-8000-000000000001'),
  '83000000-0000-4000-8000-000000000001'::uuid,
  'seller reference is preserved independently'
);

select is(
  (select assignee_profile_id from erp_supply.order_workforce_outbox where order_task_id='85000000-0000-4000-8000-000000000001'),
  '83000000-0000-4000-8000-000000000001'::uuid,
  'responsible comes from the operational task assignment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","email":"owf-a@example.test"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from erp_supply.order_workforce_outbox),
  1::bigint,
  'organization A can read its integration row'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","email":"owf-b@example.test"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from erp_supply.order_workforce_outbox),
  0::bigint,
  'organization B cannot read organization A integration rows'
);

select * from finish();
rollback;
