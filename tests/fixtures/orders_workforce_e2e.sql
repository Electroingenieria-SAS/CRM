\set ON_ERROR_STOP on

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,
  current_assignee_id,source,is_test,metadata
)
select
  '95000000-0000-4000-8000-000000000001',o.id,'OWF-E2E-001','PVC','CASH','LOCAL_DISPATCH',
  'Cliente Integración Workforce','Cali','Calle QA 10',
  '93000000-0000-4000-8000-000000000001','ALISTAMIENTO','ASSIGNED',
  '93000000-0000-4000-8000-000000000005','ERP',true,'{"fixture":"orders-workforce"}'::jsonb
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,assigned_profile_id,assigned_at,metadata
) values(
  '95000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000001','ALISTAMIENTO',1,'ALISTAMIENTO','ASSIGNED',
  '93000000-0000-4000-8000-000000000005',now(),'{"fixture":"orders-workforce"}'::jsonb
);

insert into erp_supply.order_events(
  organization_id,order_id,task_id,event_type,action_code,from_step_code,to_step_code,
  from_status,to_status,actor_profile_id,actor_role_code,idempotency_key,payload
)
select
  o.organization_id,o.id,'95000000-0000-4000-8000-000000000002','ORDER_TASK_CLAIMED','CLAIM',
  'ALISTAMIENTO','ALISTAMIENTO','QUEUED','ASSIGNED',
  '93000000-0000-4000-8000-000000000005','coordinador_logistico','owf-e2e-event-001',
  '{"integrationEvent":"OrderTaskClaimed","contractVersion":"1.0.0"}'::jsonb
from erp_supply.orders o where o.id='95000000-0000-4000-8000-000000000001';

do $check$
begin
  if (select count(*) from erp_supply.order_workforce_outbox where order_id='95000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Orders-Workforce trigger did not create exactly one outbox row';
  end if;
end
$check$;
