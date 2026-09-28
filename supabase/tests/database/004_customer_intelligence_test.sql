begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

select has_table('erp_supply','customers','stable customer identity table exists');
select has_table('erp_supply','invoices','invoice payment ledger exists');
select has_table('erp_supply','customer_intelligence_current','current intelligence snapshot exists');
select has_table('erp_supply','customer_intelligence_history','segment history exists');

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='customer_intelligence_current'),
  'customer intelligence snapshots have RLS'
);

select ok(
  not has_function_privilege('anon','public.erp_x_customer_intelligence_list(text,text,integer,integer)','EXECUTE'),
  'anon cannot execute customer intelligence list'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_customer_intelligence_list(text,text,integer,integer)','EXECUTE'),
  'authenticated may execute guarded customer intelligence list'
);

select is(
  erp_private.customer_invoice_effective_paid(100,0,'REGISTERED'),
  100::numeric,
  'registered invoice amount is paid value'
);

select is(
  erp_private.customer_invoice_effective_paid(100,40,'PARTIALLY_REVERSED'),
  60::numeric,
  'partial reversal reduces paid value'
);

select is(
  erp_private.customer_invoice_effective_paid(100,100,'REVERSED'),
  0::numeric,
  'fully reversed invoice contributes zero'
);

select is(
  erp_private.customer_invoice_effective_paid(100,0,'VOID'),
  0::numeric,
  'void invoice contributes zero'
);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000001','authenticated','authenticated','ci-admin@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000002','authenticated','authenticated','ci-sales@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000003','authenticated','authenticated','ci-other@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000004','authenticated','authenticated','ci-no-permission@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('42000000-0000-0000-0000-000000000001','CI_A','CI A'),
('42000000-0000-0000-0000-000000000002','CI_B','CI B');

-- The organization trigger provisions algorithm version 1.0.0 automatically.

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
) values
('43000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','ci-admin@example.test','CI Admin'),
('43000000-0000-0000-0000-000000000002','42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','ci-sales@example.test','CI Sales'),
('43000000-0000-0000-0000-000000000003','42000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000003','ci-other@example.test','CI Other'),
('43000000-0000-0000-0000-000000000004','42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000004','ci-no-permission@example.test','CI Without Permission');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('43000000-0000-0000-0000-000000000001','super_admin',true),
('43000000-0000-0000-0000-000000000002','ventas',true),
('43000000-0000-0000-0000-000000000003','ventas',true),
('43000000-0000-0000-0000-000000000004','aux_logistica',true);

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test,created_at,updated_at
)
select
  '42000000-0000-0000-0000-000000000001',
  'CI-T-'||client_no||'-'||g,
  'PVC','CASH','LOCAL_DISPATCH',
  'Cliente Test '||client_no,
  'NIT-'||client_no,
  'Cali','Calle Test',
  '43000000-0000-0000-0000-000000000002',
  'CLOSED','CLOSED','MEDIUM','ERP',false,
  now()-(30-g)*interval '1 day',now()
from generate_series(1,5) client_no
cross join lateral generate_series(1,client_no+2) g;

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,amount,status,registered_by
)
select
  o.organization_id,o.id,'FAC-'||o.order_number,
  case
    when o.client_document='NIT-5' then 500000
    when o.client_document='NIT-4' then 200000
    when o.client_document='NIT-3' then 80000
    when o.client_document='NIT-2' then 10000
    else 1000
  end,
  'REGISTERED',
  '43000000-0000-0000-0000-000000000002'
from erp_supply.orders o
where o.organization_id='42000000-0000-0000-0000-000000000001';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test
) values
('42000000-0000-0000-0000-000000000001','CI-DOC-A','PVC','CASH','LOCAL_DISPATCH',
 'Documento Igual','900.123-4','Cali','Calle Test','43000000-0000-0000-0000-000000000002',
 'CLOSED','CLOSED','MEDIUM','ERP',false),
('42000000-0000-0000-0000-000000000001','CI-DOC-B','PVC','CASH','LOCAL_DISPATCH',
 'Documento Igual Renombrado','9001234','Cali','Calle Test','43000000-0000-0000-0000-000000000002',
 'CLOSED','CLOSED','MEDIUM','ERP',false),
('42000000-0000-0000-0000-000000000001','CI-NODOC-A','PVC','CASH','LOCAL_DISPATCH',
 'Nombre Repetido',null,'Cali','Calle Test','43000000-0000-0000-0000-000000000002',
 'CLOSED','CLOSED','MEDIUM','ERP',false),
('42000000-0000-0000-0000-000000000001','CI-NODOC-B','PVC','CASH','LOCAL_DISPATCH',
 'Nombre Repetido',null,'Cali','Calle Test','43000000-0000-0000-0000-000000000002',
 'CLOSED','CLOSED','MEDIUM','ERP',false);

select is(
  (select count(distinct customer_id) from erp_supply.orders where order_number in ('CI-DOC-A','CI-DOC-B')),
  1::bigint,
  'document normalization resolves variants to one customer'
);

select is(
  (select count(distinct customer_id) from erp_supply.orders where order_number in ('CI-NODOC-A','CI-NODOC-B')),
  2::bigint,
  'same textual name without document is not merged'
);


insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,amount,reversed_amount,status,
  reversal_reason,reversed_at,registered_by
)
select o.organization_id,o.id,'FAC-PARTIAL-'||o.order_number,100000,40000,
       'PARTIALLY_REVERSED','Ajuste sintético',now(),
       '43000000-0000-0000-0000-000000000002'
from erp_supply.orders o
where o.organization_id='42000000-0000-0000-0000-000000000001'
  and o.order_number='CI-T-3-1';

insert into erp_supply.orders(
  organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test
) values
('42000000-0000-0000-0000-000000000001','CI-CANCELLED-HUGE','PVC','CASH','LOCAL_DISPATCH',
 'Cliente Test 5','NIT-5','Cali','Calle Test','43000000-0000-0000-0000-000000000002',
 'RECEPCION_PEDIDO','CANCELLED','MEDIUM','ERP',false),
('42000000-0000-0000-0000-000000000001','CI-DRAFT-HUGE','PVC','CASH','LOCAL_DISPATCH',
 'Cliente Test 5','NIT-5','Cali','Calle Test','43000000-0000-0000-0000-000000000002',
 'RECEPCION_PEDIDO','DRAFT','MEDIUM','ERP',false);

insert into erp_supply.invoices(
  organization_id,order_id,invoice_number,amount,status,registered_by
)
select o.organization_id,o.id,'FAC-'||o.order_number,9999999,'REGISTERED',
       '43000000-0000-0000-0000-000000000002'
from erp_supply.orders o
where o.order_number in ('CI-CANCELLED-HUGE','CI-DRAFT-HUGE');

select is(
  (select count(*) from erp_supply.customer_intelligence_algorithm_versions
   where organization_id='42000000-0000-0000-0000-000000000002'
     and version='1.0.0' and active),
  1::bigint,
  'new organizations receive the default active algorithm'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","email":"ci-admin@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_customer_intelligence_recalculate()$$,
  'superadmin can recalculate'
);

select is(
  (select count(*) from erp_supply.customer_intelligence_runs
   where organization_id='42000000-0000-0000-0000-000000000001' and status='COMPLETED'),
  1::bigint,
  'first recalculation creates one completed run'
);

select is(
  (select c.valid_order_count
   from erp_supply.customer_intelligence_current c
   join erp_supply.customers cu on cu.id=c.customer_id
   where c.organization_id='42000000-0000-0000-0000-000000000001'
     and cu.normalized_document='NIT5'),
  7::bigint,
  'draft and cancelled orders do not increase valid order count'
);

select is(
  (select c.paid_amount
   from erp_supply.customer_intelligence_current c
   join erp_supply.customers cu on cu.id=c.customer_id
   where c.organization_id='42000000-0000-0000-0000-000000000001'
     and cu.normalized_document='NIT5'),
  3500000::numeric,
  'invoices attached to draft and cancelled orders do not inflate paid amount'
);

select is(
  (select c.paid_amount
   from erp_supply.customer_intelligence_current c
   join erp_supply.customers cu on cu.id=c.customer_id
   where c.organization_id='42000000-0000-0000-0000-000000000001'
     and cu.normalized_document='NIT3'),
  460000::numeric,
  'registered invoices plus net partial reversal define paid amount'
);

select ok(
  (select c.provisional
   from erp_supply.customer_intelligence_current c
   join erp_supply.customers cu on cu.id=c.customer_id
   where c.organization_id='42000000-0000-0000-0000-000000000001'
     and cu.normalized_document='9001234'),
  'customer with only two observations remains provisional'
);

select is(
  (select c.paid_amount
   from erp_supply.customer_intelligence_current c
   join erp_supply.customers cu on cu.id=c.customer_id
   where c.organization_id='42000000-0000-0000-0000-000000000001'
     and cu.normalized_document='9001234'),
  0::numeric,
  'customer without registered invoices has zero paid value'
);

select ok(
  jsonb_array_length(public.erp_x_customer_intelligence_pareto()->'ordersSeries') > 0
  and jsonb_array_length(public.erp_x_customer_intelligence_pareto()->'paidSeries') > 0,
  'Pareto returns independent order and paid series'
);

select is(
  (public.erp_x_customer_intelligence_recalculate()->>'reused')::boolean,
  true,
  'same dataset recalculation is idempotently reused'
);

select is(
  (select count(*) from erp_supply.customer_intelligence_runs
   where organization_id='42000000-0000-0000-0000-000000000001' and status='COMPLETED'),
  1::bigint,
  'idempotent recalculation does not duplicate runs'
);

select ok(
  (select count(*) from erp_supply.customer_intelligence_history
   where organization_id='42000000-0000-0000-0000-000000000001') > 0,
  'initial segment history is preserved'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated","email":"ci-sales@example.test"}',
  true
);
set local role authenticated;

select ok(
  jsonb_array_length(public.erp_x_customer_intelligence_list(null,null,1,100)->'items') >= 5,
  'authorized sales user can read own organization ranking'
);

select throws_ok(
  $$select public.erp_x_customer_intelligence_recalculate()$$,
  '42501',
  'No autorizado para recalcular inteligencia de clientes',
  'sales user cannot trigger administrative recalculation'
);

select is(
  public.erp_x_customer_priority_signal('SIN-HISTORIA')->>'segment',
  'NORMAL',
  'new customer receives provisional Normal signal instead of an insufficient-history failure'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000004","role":"authenticated","email":"ci-no-permission@example.test"}',
  true
);
set local role authenticated;

select throws_ok(
  $select public.erp_x_customer_intelligence_list(null,null,1,100)$,
  '42501',
  'No autorizado para consultar inteligencia de clientes',
  'same-organization role without permission cannot read ranking'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated","email":"ci-other@example.test"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(public.erp_x_customer_intelligence_list(null,null,1,100)->'items'),
  0,
  'another organization cannot read organization A intelligence'
);

reset role;

select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_customer_intelligence_ranking'
  ),
  'ranking index exists'
);

select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_invoices_customer_intelligence'
  ),
  'invoice intelligence index exists'
);

select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_customer_intelligence_run_fingerprint'
  ),
  'dataset fingerprint lookup index exists'
);

select * from finish();
rollback;
