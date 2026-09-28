begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000001','authenticated','authenticated','fin-sales@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000002','authenticated','authenticated','fin-cartera@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000003','authenticated','authenticated','fin-caja@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000004','authenticated','authenticated','fin-gerencia@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000005','authenticated','authenticated','fin-audit@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000006','authenticated','authenticated','fin-admin-a@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000007','authenticated','authenticated','fin-admin-b@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('62000000-0000-4000-8000-000000000001','FIN_A','Finance A'),
('62000000-0000-4000-8000-000000000002','FIN_B','Finance B');

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
) values
('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','fin-sales@example.test','Fin Sales'),
('63000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','fin-cartera@example.test','Fin Cartera'),
('63000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003','fin-caja@example.test','Fin Caja'),
('63000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000004','fin-gerencia@example.test','Fin Gerencia'),
('63000000-0000-4000-8000-000000000005','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000005','fin-audit@example.test','Fin Auditoría'),
('63000000-0000-4000-8000-000000000006','62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000006','fin-admin-a@example.test','Fin Admin A'),
('63000000-0000-4000-8000-000000000007','62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000007','fin-admin-b@example.test','Fin Admin B');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('63000000-0000-4000-8000-000000000001','ventas',true),
('63000000-0000-4000-8000-000000000002','cartera',true),
('63000000-0000-4000-8000-000000000003','caja',true),
('63000000-0000-4000-8000-000000000004','gerencia',true),
('63000000-0000-4000-8000-000000000005','auditoria',true),
('63000000-0000-4000-8000-000000000006','super_admin',true),
('63000000-0000-4000-8000-000000000007','super_admin',true);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test
) values
('64000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','FIN-CREDIT-001','PVC','CREDIT','LOCAL_DISPATCH',
 'Cliente Crédito','9001001','Cali','Calle QA','63000000-0000-4000-8000-000000000001','CARTERA',
 'QUEUED','MEDIUM','QA',false),
('64000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','FIN-CASH-001','PVN','CASH','LOCAL_DISPATCH',
 'Cliente Caja','9001002','Cali','Calle QA','63000000-0000-4000-8000-000000000001','CAJA',
 'QUEUED','MEDIUM','QA',false),
('64000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000002','FIN-OTHER-001','PVN','CASH','LOCAL_DISPATCH',
 'Cliente Otro','9991001','Cali','Calle QA','63000000-0000-4000-8000-000000000007','CAJA',
 'QUEUED','MEDIUM','QA',false);

select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","email":"fin-sales@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_create_credit_request(
    '{"orderId":"64000000-0000-4000-8000-000000000001","requestedAmount":500000,"requestedTermDays":30}'::jsonb,
    'credit-create-1'
  )$$,
  'sales can submit a credit request'
);

select is(
  (select count(*) from erp_supply.credit_requests),
  1::bigint,
  'sales sees the created credit request through RLS'
);

select is(
  (public.erp_x_finance_create_credit_request(
    '{"orderId":"64000000-0000-4000-8000-000000000001","requestedAmount":500000,"requestedTermDays":30}'::jsonb,
    'credit-create-1'
  )->>'idempotent')::boolean,
  true,
  'credit request retry is idempotent'
);

select throws_ok(
  $$select public.erp_x_finance_decide_credit_request(
    (select id from erp_supply.credit_requests limit 1),
    'APPROVED','No debe poder','sales-decision-1'
  )$$,
  '42501',
  'No autorizado para decidir crédito',
  'sales cannot approve credit'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","email":"fin-cartera@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_take_credit_request(
    (select id from erp_supply.credit_requests limit 1),'credit-take-1'
  )$$,
  'cartera can take submitted credit'
);

select is(
  (select status from erp_supply.credit_requests limit 1),
  'UNDER_REVIEW',
  'taken credit is under review'
);

select lives_ok(
  $$select public.erp_x_finance_decide_credit_request(
    (select id from erp_supply.credit_requests limit 1),
    'APPROVED','Condiciones verificadas','credit-decision-1'
  )$$,
  'cartera can approve credit'
);

select is(
  (select status from erp_supply.credit_requests limit 1),
  'APPROVED',
  'credit decision is persisted'
);

select is(
  (select count(*) from erp_supply.financial_validations
   where validation_type='CREDIT' and result='APPROVED'),
  1::bigint,
  'approved linked credit creates a financial decision without a payment amount'
);

select lives_ok(
  $$select public.erp_x_finance_create_hold(
    '64000000-0000-4000-8000-000000000001','CARTERA','OVERDUE_EXTERNAL',
    'Saldo vencido informado por Cartera',
    '{"requiresApproval":true,"source":"QA_SYNTHETIC"}'::jsonb,
    'hold-1'
  )$$,
  'cartera can place a traceable financial hold'
);

select is(
  public.erp_x_financial_gate('64000000-0000-4000-8000-000000000001')->>'decision',
  'ON_HOLD',
  'Orders gate explains active hold'
);

select throws_ok(
  $$select public.erp_x_finance_release_hold(
    (select id from erp_supply.financial_holds where status='ACTIVE' limit 1),
    'Intento sin aprobación','release-without-approval'
  )$$,
  '42501',
  'La liberación requiere una aprobación financiera vigente',
  'exception hold cannot be released before approval'
);

select lives_ok(
  $$select public.erp_x_finance_request_exception(
    '64000000-0000-4000-8000-000000000001',
    (select id from erp_supply.financial_holds where status='ACTIVE' limit 1),
    'RELEASE_EXCEPTION','Solicito liberación excepcional',
    '{}'::jsonb,'release-exception-1'
  )$$,
  'cartera can request a release exception'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000004","role":"authenticated","email":"fin-gerencia@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_decide_exception(
    (select id from erp_supply.financial_approval_requests where status='PENDING' limit 1),
    'APPROVED','Excepción autorizada','release-exception-decision-1'
  )$$,
  'gerencia can approve financial exception'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","email":"fin-cartera@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_release_hold(
    (select id from erp_supply.financial_holds where status='ACTIVE' limit 1),
    'Liberado con aprobación vigente','release-after-approval'
  )$$,
  'cartera releases hold after independent approval'
);

select is(
  (select status from erp_supply.financial_holds where reason_code='OVERDUE_EXTERNAL'),
  'RELEASED',
  'hold history is retained as released instead of deleted'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000006","role":"authenticated","email":"fin-admin-a@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_request_exception(
    '64000000-0000-4000-8000-000000000001',null,
    'CREDIT_EXCEPTION','Admin solicita excepción',
    '{}'::jsonb,'admin-own-exception'
  )$$,
  'superadmin may request an exception'
);

select throws_ok(
  $$select public.erp_x_finance_decide_exception(
    (select id from erp_supply.financial_approval_requests
      where idempotency_key='admin-own-exception'),
    'APPROVED','Autoaprobación','admin-own-decision'
  )$$,
  '42501',
  'Quien solicita una excepción no puede decidirla',
  'superadmin actions remain subject to segregation of duties'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated","email":"fin-caja@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_add_support(
    '64000000-0000-4000-8000-000000000002',null,
    '{"supportType":"TRANSFER","storageProvider":"EXTERNAL","storageReference":"qa://support/001","fileName":"support.pdf","mimeType":"application/pdf","sizeBytes":1200}'::jsonb,
    'support-1'
  )$$,
  'caja can reference payment evidence without storing binary data'
);

select lives_ok(
  $$select public.erp_x_finance_validate_support(
    (select id from erp_supply.financial_supports where idempotency_key='support-1'),
    'VALIDATED','Soporte verificado','support-validate-1'
  )$$,
  'caja can validate support according to the audited legacy responsibility'
);

select lives_ok(
  $$select public.erp_x_finance_register_invoice(
    '64000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'invoiceNumber','FIN-INV-001','invoiceDate',current_date::text,
      'amount',100000,'currency','COP',
      'supportId',(select id::text from erp_supply.financial_supports where idempotency_key='support-1')
    ),
    'invoice-1'
  )$$,
  'caja registers first paid invoice evidence'
);

select lives_ok(
  $$select public.erp_x_finance_register_invoice(
    '64000000-0000-4000-8000-000000000002',
    '{"invoiceNumber":"FIN-INV-002","amount":50000,"currency":"COP"}'::jsonb,
    'invoice-2'
  )$$,
  'multiple invoice entries support progressive paid value'
);

select is(
  erp_private.finance_order_paid_total('64000000-0000-4000-8000-000000000002'),
  150000::numeric,
  'multiple registered invoices add to effective paid value'
);

select is(
  (public.erp_x_finance_register_invoice(
    '64000000-0000-4000-8000-000000000002',
    '{"invoiceNumber":"IGNORED-RETRY","amount":999999,"currency":"COP"}'::jsonb,
    'invoice-1'
  )->>'idempotent')::boolean,
  true,
  'invoice registration retry cannot duplicate paid money'
);

select throws_ok(
  $$select public.erp_x_finance_reverse_invoice(
    (select id from erp_supply.invoices where invoice_number='FIN-INV-001'),
    30000,'Caja no aprueba reversos','reverse-caja-denied'
  )$$,
  '42501',
  'El reverso requiere autoridad de aprobación financiera',
  'caja operator cannot approve a reversal'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000004","role":"authenticated","email":"fin-gerencia@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_reverse_invoice(
    (select id from erp_supply.invoices where invoice_number='FIN-INV-001'),
    30000,'Reverso parcial autorizado','reverse-1'
  )$$,
  'gerencia can authorize a partial invoice reversal'
);

select is(
  erp_private.finance_order_paid_total('64000000-0000-4000-8000-000000000002'),
  120000::numeric,
  'partial reversal reduces order paid value without deleting history'
);

select lives_ok(
  $$select public.erp_x_finance_void_invoice(
    (select id from erp_supply.invoices where invoice_number='FIN-INV-002'),
    'Factura anulada por QA','void-2'
  )$$,
  'gerencia can void an unreversed invoice'
);

select is(
  erp_private.finance_order_paid_total('64000000-0000-4000-8000-000000000002'),
  70000::numeric,
  'void invoice contributes zero while partial invoice retains net value'
);

select is(
  (public.erp_x_finance_customer_paid(
    (select customer_id from erp_supply.orders where id='64000000-0000-4000-8000-000000000002')
  )->>'totalPaid')::numeric,
  70000::numeric,
  'Customer Intelligence projection derives paid value from invoices net of reversals'
);

select is(
  public.erp_x_finance_order_summary('64000000-0000-4000-8000-000000000002')->>'availableCreditReason',
  'NO_AUDITED_REUSABLE_CREDIT_LIMIT',
  'system refuses to invent an unaudited reusable credit limit'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated","email":"fin-audit@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_finance_order_summary('64000000-0000-4000-8000-000000000002')$$,
  'auditor can read financial summary'
);

select throws_ok(
  $$select public.erp_x_finance_validate_order(
    '64000000-0000-4000-8000-000000000002','CAJA','APPROVED',
    'Auditor no modifica',null,'{}'::jsonb,'audit-write'
  )$$,
  '42501',
  'No autorizado para registrar validaciones financieras',
  'auditor cannot mutate financial decisions'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000007","role":"authenticated","email":"fin-admin-b@example.test"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from erp_supply.financial_events),
  0::bigint,
  'organization B cannot read organization A financial ledger'
);

select is(
  jsonb_array_length(public.erp_x_finance_queue('CAJA',null,null,1,100)->'items'),
  1,
  'organization B sees only its own synthetic cash order'
);

reset role;

select * from finish();
rollback;
