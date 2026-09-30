\set ON_ERROR_STOP on

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,priority,
  requires_purchase,source,is_test
)
select
  'b3000000-0000-4000-8000-000000000001',
  o.id,'SUP-E2E-PVE','PVE','CASH','LOCAL_DISPATCH',
  'Cliente Supply QA','Cali','Calle Supply QA',
  '93000000-0000-4000-8000-000000000001','COMPRAS','QUEUED','MEDIUM',
  true,'QA_BOT',true
from erp_supply.organizations o
where o.code='EI'
on conflict (organization_id,order_number) do nothing;

insert into erp_supply.purchase_requests(
  id,organization_id,order_id,status,requested_by,metadata
)
select
  'b3100000-0000-4000-8000-000000000001',o.id,
  'b3000000-0000-4000-8000-000000000001','REQUESTED',
  '93000000-0000-4000-8000-000000000004','{"fixture":true}'::jsonb
from erp_supply.organizations o where o.code='EI'
on conflict (organization_id,order_id) do nothing;

insert into erp_supply.goods_receipts(
  id,organization_id,receipt_type,document_reference,status,received_by,metadata
)
select
  'b3200000-0000-4000-8000-000000000001',o.id,'STANDALONE',
  'SUP-E2E-REC','DRAFT','93000000-0000-4000-8000-000000000004',
  '{"fixture":true}'::jsonb
from erp_supply.organizations o where o.code='EI'
on conflict (id) do nothing;

insert into erp_supply.picking_jobs(
  id,organization_id,order_id,status,assigned_profile_id,created_by,metadata
)
select
  'b3300000-0000-4000-8000-000000000001',o.id,
  'a4000000-0000-4000-8000-000000000001','IN_PROGRESS',
  '93000000-0000-4000-8000-000000000011',
  '93000000-0000-4000-8000-000000000004',
  '{"fixture":true}'::jsonb
from erp_supply.organizations o where o.code='EI'
on conflict (id) do nothing;

insert into erp_supply.cutting_jobs(
  id,organization_id,order_id,status,assigned_profile_id,created_by,metadata
)
select
  'b3400000-0000-4000-8000-000000000001',o.id,
  'a4000000-0000-4000-8000-000000000002','OPEN',
  null,
  '93000000-0000-4000-8000-000000000004',
  '{"fixture":true}'::jsonb
from erp_supply.organizations o where o.code='EI'
on conflict (id) do nothing;
