begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000001','authenticated','authenticated','bill-qa@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000002','authenticated','authenticated','log-qa@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000003','authenticated','authenticated','audit-log-qa@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000004','authenticated','authenticated','log-other@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('92000000-0000-4000-8000-000000000001','LOG_A','Logistics A'),
('92000000-0000-4000-8000-000000000002','LOG_B','Logistics B');

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','bill-qa@example.test','Billing QA'),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','log-qa@example.test','Logistics QA'),
('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','audit-log-qa@example.test','Audit QA'),
('93000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000004','log-other@example.test','Other Logistics QA');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('93000000-0000-4000-8000-000000000001','caja',true),
('93000000-0000-4000-8000-000000000002','aux_logistica',true),
('93000000-0000-4000-8000-000000000003','auditoria',true),
('93000000-0000-4000-8000-000000000004','aux_logistica',true);

insert into erp_supply.freight_carriers(
  id,organization_id,code,name,active,metadata
) values(
  '94000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'QA-CARRIER','Transportadora QA',true,'{"source":"QA_SYNTHETIC"}'::jsonb
);

insert into erp_supply.freight_destinations(
  id,country_code,department_key,department_name,city_key,city_name,active,metadata
) values(
  '95000000-0000-4000-8000-000000000001',
  'CO','VALLE_DEL_CAUCA','Valle del Cauca','CALI','Cali',true,
  '{"source":"QA_SYNTHETIC"}'::jsonb
);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test
) values(
  '96000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'LOG-QA-001','PVC','CASH','NATIONAL_DISPATCH',
  'Cliente Logístico','9009001','Cali','Calle QA 10',
  '93000000-0000-4000-8000-000000000001',
  'NATIONAL_DISPATCH','IN_PROGRESS','MEDIUM','QA_BOT',true
);

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,
  assigned_profile_id,assigned_role_code,started_at
) values(
  '97000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  'NATIONAL_DISPATCH',1,'NATIONAL_DISPATCH','IN_PROGRESS',
  '93000000-0000-4000-8000-000000000002','aux_logistica',now()
);

insert into erp_supply.order_evidence(
  id,organization_id,order_id,task_id,evidence_type,storage_provider,storage_reference,
  file_name,mime_type,size_bytes,created_by,metadata
) values(
  '98000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001',
  'DELIVERY_PHOTO','EXTERNAL','qa://delivery/photo-1',
  'delivery.jpg','image/jpeg',1200,
  '93000000-0000-4000-8000-000000000002',
  '{"source":"QA_SYNTHETIC"}'::jsonb
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"bill-qa@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_register_invoice(
    '96000000-0000-4000-8000-000000000001',
    '{"invoiceNumber":"LOG-FAC-001","amount":250000,"currency":"COP"}'::jsonb,
    'log-invoice-1'
  )$$,
  'billing uses Finance invoice truth'
);

select is(
  public.erp_x_billing_readiness('96000000-0000-4000-8000-000000000001')->>'billingReady',
  'true',
  'billing readiness sees the Finance invoice'
);

select lives_ok(
  $$select public.erp_x_finance_validate_order(
    '96000000-0000-4000-8000-000000000001',
    'CAJA','APPROVED','Validación QA previa a logística',
    'LOG-QA-APPROVED','{}'::jsonb,'log-finance-approve-1'
  )$$,
  'Finance approves the CASH gate before logistics'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","email":"log-qa@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_logistics_release(
    '96000000-0000-4000-8000-000000000001',
    '{
      "carrierId":"94000000-0000-4000-8000-000000000001",
      "destinationId":"95000000-0000-4000-8000-000000000001",
      "estimatedFreight":20000,
      "estimatedFreightLow":18000,
      "estimatedFreightHigh":23000
    }'::jsonb,
    'log-release-1'
  )$$,
  'authorized logistics user releases the order'
);

select is(
  (select status from erp_supply.logistics_shipments
   where order_id='96000000-0000-4000-8000-000000000001'),
  'READY',
  'released shipment starts READY'
);

select is(
  (public.erp_x_logistics_release(
    '96000000-0000-4000-8000-000000000001',
    '{}'::jsonb,
    'log-release-1'
  )->>'idempotent')::boolean,
  true,
  'release retry is idempotent'
);

select lives_ok(
  $$select public.erp_x_logistics_save_guide(
    (select id from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    '94000000-0000-4000-8000-000000000001',
    'QA-GUIDE-001',
    'log-guide-1'
  )$$,
  'national shipment records carrier and guide'
);

select is(
  (select tracking_number from erp_supply.logistics_shipments
   where order_id='96000000-0000-4000-8000-000000000001'),
  'QA-GUIDE-001',
  'guide is stored by stable carrier id'
);

select lives_ok(
  $$select public.erp_x_logistics_dispatch(
    (select id from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    (select version from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    22000,
    'log-dispatch-1'
  )$$,
  'READY advances to IN_TRANSIT once'
);

select is(
  (select status from erp_supply.logistics_shipments
   where order_id='96000000-0000-4000-8000-000000000001'),
  'IN_TRANSIT',
  'dispatch persists IN_TRANSIT'
);

select is(
  (public.erp_x_logistics_dispatch(
    (select id from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    1,999999,'log-dispatch-1'
  )->>'idempotent')::boolean,
  true,
  'dispatch retry cannot duplicate or overwrite actual freight'
);

select is(
  (select actual_freight from erp_supply.logistics_shipments
   where order_id='96000000-0000-4000-8000-000000000001'),
  22000::numeric,
  'actual freight remains separate from the estimate'
);

select lives_ok(
  $$select public.erp_x_logistics_deliver(
    (select id from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    'Receptor QA','Entrega conforme',
    '98000000-0000-4000-8000-000000000001',
    (select version from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    'log-deliver-1'
  )$$,
  'in-transit shipment can be delivered with evidence'
);

select is(
  (select status from erp_supply.logistics_shipments
   where order_id='96000000-0000-4000-8000-000000000001'),
  'DELIVERED',
  'delivery reaches DELIVERED'
);

select is(
  (select count(*) from erp_supply.delivery_attempts
   where order_id='96000000-0000-4000-8000-000000000001' and outcome='DELIVERED'),
  1::bigint,
  'delivery creates exactly one attempt'
);

select is(
  (public.erp_x_logistics_deliver(
    (select id from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    'Otro receptor','retry',
    '98000000-0000-4000-8000-000000000001',
    1,'log-deliver-1'
  )->>'idempotent')::boolean,
  true,
  'delivery retry is idempotent'
);

select lives_ok(
  $$select public.erp_x_logistics_satisfaction(
    (select id from erp_supply.logistics_shipments
      where order_id='96000000-0000-4000-8000-000000000001'),
    5,'Entrega satisfactoria','log-satisfaction-1'
  )$$,
  'satisfaction is optional and can be recorded after delivery'
);

select is(
  (select rating from erp_supply.delivery_satisfaction
   where order_id='96000000-0000-4000-8000-000000000001'),
  5::smallint,
  'satisfaction rating is stored'
);

select ok(
  (select count(*) from erp_supply.logistics_events
   where order_id='96000000-0000-4000-8000-000000000001') >= 5,
  'critical logistics actions leave append-only events'
);

select ok(
  (select count(*) from erp_supply.order_events
   where order_id='96000000-0000-4000-8000-000000000001'
     and event_type='ORDER_LOGISTICS_EVENT') >= 5,
  'logistics events are visible in Orders trace'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated","email":"audit-log-qa@example.test"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(public.erp_x_logistics_queue(null,null,null,1,25)->'items'),
  1,
  'auditor can read organization logistics'
);

select throws_ok(
  $$select public.erp_x_logistics_set_actual_cost(
    (select id from erp_supply.logistics_shipments limit 1),
    23000,
    (select version from erp_supply.logistics_shipments limit 1),
    'audit-cost-denied'
  )$$,
  '42501',
  'No autorizado para corregir costo real',
  'auditor cannot mutate actual freight'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","email":"log-other@example.test"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from erp_supply.logistics_shipments),
  0::bigint,
  'organization B cannot read organization A shipments'
);

select is(
  jsonb_array_length(public.erp_x_logistics_queue(null,null,null,1,25)->'items'),
  0,
  'organization B queue is isolated'
);

reset role;

select * from finish();
rollback;
