\set ON_ERROR_STOP on

insert into erp_supply.freight_carriers(
  id,organization_id,code,name,active,metadata
)
select
  '99100000-0000-4000-8000-000000000001',
  o.id,'QA-LOG-CARRIER','Transportadora QA Logística',true,
  '{"source":"QA_SYNTHETIC"}'::jsonb
from erp_supply.organizations o
where o.code='EI'
on conflict (organization_id,code) do nothing;

insert into erp_supply.freight_destinations(
  id,country_code,department_key,department_name,city_key,city_name,active,metadata
) values(
  '99100000-0000-4000-8000-000000000002',
  'CO','QA_LOGISTICS','QA Logistics','QA_LOGISTICS_CITY','QA Logistics City',true,
  '{"source":"QA_SYNTHETIC"}'::jsonb
)
on conflict (country_code,department_key,city_key) do nothing;

insert into erp_supply.freight_observations(
  id,organization_id,carrier_id,destination_id,route_code,actual_cost,
  observed_at,source,external_key,created_by,metadata
)
select
  '99100000-0000-4000-8000-000000000003',
  o.id,
  '99100000-0000-4000-8000-000000000001',
  '99100000-0000-4000-8000-000000000002',
  'NATIONAL_DISPATCH',20000,now(),'QA_SYNTHETIC',
  'LOG-E2E-QA-OBS-001',
  '93000000-0000-4000-8000-000000000005',
  '{"source":"QA_SYNTHETIC"}'::jsonb
from erp_supply.organizations o
where o.code='EI'
on conflict (id) do nothing;

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test
)
select
  '99100000-0000-4000-8000-000000000010',
  o.id,'LOG-E2E-BILLING','PVC','CASH','NATIONAL_DISPATCH',
  'Cliente Logística E2E','QA-LOG-BILL','Armenia','Carrera QA 10',
  '93000000-0000-4000-8000-000000000001',
  'FACTURACION','IN_PROGRESS','MEDIUM','QA_BOT',false
from erp_supply.organizations o
where o.code='EI'
on conflict (organization_id,order_number) do nothing;

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,
  assigned_profile_id,assigned_role_code,started_at
) values(
  '99100000-0000-4000-8000-000000000011',
  '99100000-0000-4000-8000-000000000010',
  'FACTURACION',1,'FACTURACION','IN_PROGRESS',
  '93000000-0000-4000-8000-000000000005',
  'coordinador_logistico',now()
)
on conflict(id) do nothing;

insert into erp_supply.financial_validations(
  id,organization_id,order_id,validation_type,result,reason,reference,
  actor_profile_id,idempotency_key,metadata
)
select
  '99100000-0000-4000-8000-000000000012',
  o.organization_id,o.id,'CAJA','APPROVED',
  'Validación QA previa a logística','LOG-E2E-APPROVED',
  '93000000-0000-4000-8000-000000000008',
  'log-e2e-finance-approve-1',
  '{"source":"QA_SYNTHETIC"}'::jsonb
from erp_supply.orders o
where o.id='99100000-0000-4000-8000-000000000010'
on conflict (id) do nothing;

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test
)
select
  '99100000-0000-4000-8000-000000000020',
  o.id,'LOG-CONC-001','PVC','CASH','NATIONAL_DISPATCH',
  'Cliente Concurrencia Logística','QA-LOG-CONC','Armenia','Calle QA 20',
  '93000000-0000-4000-8000-000000000001',
  'NATIONAL_DISPATCH','IN_PROGRESS','MEDIUM','QA_BOT',false
from erp_supply.organizations o
where o.code='EI'
on conflict (organization_id,order_number) do nothing;

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,
  assigned_profile_id,assigned_role_code,started_at
) values(
  '99100000-0000-4000-8000-000000000021',
  '99100000-0000-4000-8000-000000000020',
  'NATIONAL_DISPATCH',1,'NATIONAL_DISPATCH','IN_PROGRESS',
  '93000000-0000-4000-8000-000000000005',
  'coordinador_logistico',now()
)
on conflict(id) do nothing;

insert into erp_supply.invoices(
  id,organization_id,order_id,invoice_number,invoice_date,amount,reversed_amount,
  currency,status,registered_by,updated_by,metadata
)
select
  '99100000-0000-4000-8000-000000000030',
  o.organization_id,o.id,'LOG-CONC-FAC-001',current_date,180000,0,
  'COP','REGISTERED','93000000-0000-4000-8000-000000000008',
  '93000000-0000-4000-8000-000000000008',
  '{"source":"QA_SYNTHETIC"}'::jsonb
from erp_supply.orders o
where o.id='99100000-0000-4000-8000-000000000020'
on conflict (organization_id,invoice_number) do nothing;

insert into erp_supply.order_evidence(
  id,organization_id,order_id,task_id,evidence_type,storage_provider,storage_reference,
  file_name,mime_type,size_bytes,created_by,metadata
)
select
  '99100000-0000-4000-8000-000000000040',
  o.organization_id,o.id,
  '99100000-0000-4000-8000-000000000021',
  'DELIVERY_PHOTO','EXTERNAL','qa://logistics/concurrency-delivery',
  'delivery.jpg','image/jpeg',1024,
  '93000000-0000-4000-8000-000000000005',
  '{"source":"QA_SYNTHETIC"}'::jsonb
from erp_supply.orders o
where o.id='99100000-0000-4000-8000-000000000020'
on conflict(id) do nothing;
