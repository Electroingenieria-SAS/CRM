\set ON_ERROR_STOP on

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata,created_at,updated_at
)
select
  o.id,
  'CI-URGENT-'||lpad(g::text,2,'0'),
  'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Sintético Urgente','900001','Cali','Calle QA 1',
  '93000000-0000-4000-8000-000000000001',
  'CLOSED','CLOSED','MEDIUM','ERP',false,'{"fixture":"customer-intelligence"}',
  now()-(30-g)*interval '1 day',now()
from erp_supply.organizations o
cross join generate_series(1,12) g
where o.code='EI';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata,created_at,updated_at
)
select
  o.id,'CI-PREMIUM-'||lpad(g::text,2,'0'),'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Sintético Premium','900002','Cali','Calle QA 2',
  '93000000-0000-4000-8000-000000000001','CLOSED','CLOSED','MEDIUM','ERP',false,
  '{"fixture":"customer-intelligence"}',now()-(25-g)*interval '1 day',now()
from erp_supply.organizations o
cross join generate_series(1,9) g
where o.code='EI';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata,created_at,updated_at
)
select
  o.id,'CI-NORMAL-'||lpad(g::text,2,'0'),'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Sintético Normal','900003','Cali','Calle QA 3',
  '93000000-0000-4000-8000-000000000001','CLOSED','CLOSED','MEDIUM','ERP',false,
  '{"fixture":"customer-intelligence"}',now()-(20-g)*interval '1 day',now()
from erp_supply.organizations o
cross join generate_series(1,6) g
where o.code='EI';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata,created_at,updated_at
)
select
  o.id,'CI-FREQUENT-'||lpad(g::text,2,'0'),'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Frecuente Bajo Pago','900004','Cali','Calle QA 4',
  '93000000-0000-4000-8000-000000000001','CLOSED','CLOSED','MEDIUM','ERP',false,
  '{"fixture":"customer-intelligence"}',now()-(20-g)*interval '1 day',now()
from erp_supply.organizations o
cross join generate_series(1,10) g
where o.code='EI';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata,created_at,updated_at
)
select
  o.id,'CI-HIGHVALUE-'||lpad(g::text,2,'0'),'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Pocos Pedidos Alto Pago','900005','Cali','Calle QA 5',
  '93000000-0000-4000-8000-000000000001','CLOSED','CLOSED','MEDIUM','ERP',false,
  '{"fixture":"customer-intelligence"}',now()-(10-g)*interval '1 day',now()
from erp_supply.organizations o
cross join generate_series(1,2) g
where o.code='EI';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata
)
select
  o.id,'CI-BASIC-'||lpad(g::text,2,'0'),'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Sintético Básico','900006','Cali','Calle QA 6',
  '93000000-0000-4000-8000-000000000001','CLOSED','CLOSED','MEDIUM','ERP',false,
  '{"fixture":"customer-intelligence"}'
from erp_supply.organizations o
cross join generate_series(1,3) g
where o.code='EI';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,
  current_step_code,status,priority,source,is_test,metadata
)
select
  o.id,'CI-NEW-01','PVC','CASH','LOCAL_DISPATCH',
  'Cliente Nuevo Sin Histórico','900007','Cali','Calle QA 7',
  '93000000-0000-4000-8000-000000000001','CLOSED','CLOSED','MEDIUM','ERP',false,
  '{"fixture":"customer-intelligence"}'
from erp_supply.organizations o
where o.code='EI';

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-'||o.order_number,current_date,500000,'REGISTERED',
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number like 'CI-URGENT-%';

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-'||o.order_number,current_date,280000,'REGISTERED',
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number like 'CI-PREMIUM-%';

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-'||o.order_number,current_date,70000,'REGISTERED',
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number like 'CI-NORMAL-%';

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-'||o.order_number,current_date,10000,'REGISTERED',
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number like 'CI-FREQUENT-%';

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-'||o.order_number,current_date,900000,'REGISTERED',
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number like 'CI-HIGHVALUE-%';

-- Pago parcial: una segunda factura registrada suma pago real.
insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-PARTIAL-'||o.order_number,current_date,15000,'REGISTERED',
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number='CI-NORMAL-01';

-- Reversión parcial: solo el neto conserva valor pagado.
insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,invoice_date,amount,reversed_amount,status,
  reversal_reason,reversed_at,registered_by
)
select o.organization_id,o.id,'FAC-REV-'||o.order_number,current_date,20000,8000,
       'PARTIALLY_REVERSED','Fixture de reversión parcial',now(),
       '93000000-0000-4000-8000-000000000001'
from erp_supply.orders o
where o.order_number='CI-NORMAL-02';

begin;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select id from auth.users where email='qa-superadmin@example.test'),
    'role','authenticated',
    'email','qa-superadmin@example.test'
  )::text,
  true
);
set local role authenticated;
select public.erp_x_customer_intelligence_recalculate();
reset role;
commit;
