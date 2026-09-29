begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','86100000-0000-4000-8000-000000000001','authenticated','authenticated','owf-leader@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select '86200000-0000-4000-8000-000000000001',o.id,
       '86100000-0000-4000-8000-000000000001','owf-leader@example.test','OWF Líder','OWF-LEADER'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,email,display_name,employee_code
)
select '86200000-0000-4000-8000-000000000002',o.id,
       'owf-aux-a@example.test','OWF Auxiliar A','OWF-A'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,email,display_name,employee_code
)
select '86200000-0000-4000-8000-000000000003',o.id,
       'owf-aux-b@example.test','OWF Auxiliar B','OWF-B'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('86200000-0000-4000-8000-000000000001','lider_logistica',true),
('86200000-0000-4000-8000-000000000002','aux_logistica',true),
('86200000-0000-4000-8000-000000000003','aux_logistica',true);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,
  current_assignee_id,source,is_test
)
select '86300000-0000-4000-8000-000000000001',o.id,'OWF-RUNTIME-1','PVC','CASH','LOCAL_DISPATCH',
       'Cliente Runtime','Cali','Calle Runtime',
       '86200000-0000-4000-8000-000000000001','ALISTAMIENTO','ASSIGNED',
       '86200000-0000-4000-8000-000000000002','ERP',true
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,assigned_profile_id,assigned_at
) values(
  '86400000-0000-4000-8000-000000000001',
  '86300000-0000-4000-8000-000000000001',
  'ALISTAMIENTO',1,'ALISTAMIENTO','ASSIGNED',
  '86200000-0000-4000-8000-000000000002',now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"86100000-0000-4000-8000-000000000001","role":"authenticated","email":"owf-leader@example.test"}',
  true
);
set local role authenticated;

create temporary table runtime_result as
select public.erp_x_workforce_create_from_order_event(
  jsonb_build_object(
    'contractVersion','1.0.0',
    'orderEventId',9001,
    'orderId','86300000-0000-4000-8000-000000000001',
    'orderTaskId','86400000-0000-4000-8000-000000000001',
    'stepCode','ALISTAMIENTO',
    'integrationEvent','OrderTaskClaimed',
    'workforceCatalogCode','LOG_SUPPORT_PICKING',
    'activityTitle','Alistamiento runtime',
    'actorProfileId','86200000-0000-4000-8000-000000000001',
    'assigneeProfileId','86200000-0000-4000-8000-000000000002',
    'sellerProfileId','86200000-0000-4000-8000-000000000001',
    'occurredAt',now()
  ),
  'owf-runtime:create'
) result;

select is(
  (select source from erp_supply.workforce_activities
   where id=((select result->>'activityId' from runtime_result))::uuid),
  'ORDER_EVENT',
  'order integration creates Workforce activity with ORDER_EVENT source'
);

select is(
  (select order_task_id from erp_supply.workforce_activities
   where id=((select result->>'activityId' from runtime_result))::uuid),
  '86400000-0000-4000-8000-000000000001'::uuid,
  'activity keeps the order task reference'
);

create temporary table started_result as
select public.erp_x_workforce_start_activity(
  ((select result->>'activityId' from runtime_result))::uuid,
  1,
  'owf-runtime:start'
) result;

select is(
  (select result->>'status' from started_result),
  'IN_PROGRESS',
  'created activity can start through Workforce lifecycle'
);

create temporary table reassigned_result as
select public.erp_x_workforce_reassign_from_order_event(
  ((select result->>'activityId' from runtime_result))::uuid,
  jsonb_build_object(
    'contractVersion','1.0.0',
    'orderEventId',9002,
    'orderId','86300000-0000-4000-8000-000000000001',
    'orderTaskId','86400000-0000-4000-8000-000000000001',
    'stepCode','ALISTAMIENTO',
    'integrationEvent','OrderTaskAssigned',
    'workforceCatalogCode','LOG_SUPPORT_PICKING',
    'activityTitle','Alistamiento runtime',
    'actorProfileId','86200000-0000-4000-8000-000000000001',
    'assigneeProfileId','86200000-0000-4000-8000-000000000003',
    'sellerProfileId','86200000-0000-4000-8000-000000000001',
    'occurredAt',now()
  ),
  'owf-runtime:reassign'
) result;

select is(
  (select status from erp_supply.workforce_activities
   where id=((select result->>'activityId' from runtime_result))::uuid),
  'CANCELLED',
  'active reassignment closes the previous responsible segment'
);

select is(
  (select assignee_profile_id from erp_supply.workforce_activities
   where id=((select result->>'activityId' from reassigned_result))::uuid),
  '86200000-0000-4000-8000-000000000003'::uuid,
  'active reassignment creates a continuation for the new responsible'
);

select is(
  (select result->>'status' from reassigned_result),
  'IN_PROGRESS',
  'continuation preserves the in-progress lifecycle'
);

insert into erp_supply.order_workforce_outbox(
  organization_id,order_id,order_task_id,step_code,integration_event,
  workforce_catalog_code,actor_profile_id,assignee_profile_id,seller_profile_id,
  dedupe_key,status,attempts,processed_at,workforce_activity_id,payload
)
select o.organization_id,o.id,'86400000-0000-4000-8000-000000000001','ALISTAMIENTO',
       'OrderTaskAssigned','LOG_SUPPORT_PICKING',
       '86200000-0000-4000-8000-000000000001',
       '86200000-0000-4000-8000-000000000003',
       o.seller_profile_id,'owf-runtime:outbox','PROCESSED',1,now(),
       ((select result->>'activityId' from reassigned_result))::uuid,
       '{}'::jsonb
from erp_supply.orders o
where o.id='86300000-0000-4000-8000-000000000001';

select is(
  (public.erp_x_order_workforce_completion_readiness(
    '86300000-0000-4000-8000-000000000001'
  )->>'ready')::boolean,
  true,
  'evidence-free Workforce activity is ready before Orders completion'
);

select ok(
  (public.erp_x_order_workforce_indicators(null,null)->>'activeActivities')::integer >= 1,
  'integrated indicators include active Workforce activities'
);

select ok(
  (public.erp_x_order_workforce_indicators(null,null)->'ordersByStep' ? 'ALISTAMIENTO'),
  'integrated indicators aggregate operational orders by catalog step'
);

select ok(
  jsonb_array_length(public.erp_x_order_workforce_indicators(null,null)->'people') >= 3,
  'integrated indicators return people occupancy without human ranking'
);

select * from finish();
rollback;
