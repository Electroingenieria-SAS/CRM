begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
(
  '00000000-0000-0000-0000-000000000000',
  'd1000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','analytics-pgtap@example.test','',now(),
  '{}','{}',now(),now()
),
(
  '00000000-0000-0000-0000-000000000000',
  'd1000000-0000-4000-8000-000000000002',
  'authenticated','authenticated','analytics-viewer@example.test','',now(),
  '{}','{}',now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  'd2000000-0000-4000-8000-000000000001',o.id,
  'd1000000-0000-4000-8000-000000000001',
  'analytics-pgtap@example.test','Analytics pgTAP','AN-PGTAP'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  'd2000000-0000-4000-8000-000000000002',o.id,
  'd1000000-0000-4000-8000-000000000002',
  'analytics-viewer@example.test','Analytics Viewer','AN-VIEW'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('d2000000-0000-4000-8000-000000000001','super_admin',true),
('d2000000-0000-4000-8000-000000000002','ventas',true);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,
  source,is_test,created_at,updated_at,closed_at
)
select
  'd3000000-0000-4000-8000-000000000001',o.id,'AN-PGTAP-FAST',
  'PVC','CASH','LOCAL_DISPATCH','Cliente Analytics','Cali','Calle Analytics',
  'd2000000-0000-4000-8000-000000000001','CLOSED','CLOSED',
  'QA_BOT',false,
  '2026-09-29 07:00:00 America/Bogota'::timestamptz,
  '2026-09-29 10:00:00 America/Bogota'::timestamptz,
  '2026-09-29 10:00:00 America/Bogota'::timestamptz
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,assigned_profile_id,
  created_at,started_at,completed_at
) values (
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'ALISTAMIENTO',1,'ALISTAMIENTO','COMPLETED',
  'd2000000-0000-4000-8000-000000000001',
  '2026-09-29 07:00:00 America/Bogota'::timestamptz,
  '2026-09-29 08:00:00 America/Bogota'::timestamptz,
  '2026-09-29 10:00:00 America/Bogota'::timestamptz
);

insert into erp_supply.order_blocks(
  id,organization_id,order_id,task_id,reason_code,detail,status,
  blocked_by,blocked_at,resolved_by,resolved_at,resolution
)
select
  'd5000000-0000-4000-8000-000000000001',o.id,
  'd3000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'MATERIAL','Bloqueo sintético','RESOLVED',
  'd2000000-0000-4000-8000-000000000001',
  '2026-09-29 09:00:00 America/Bogota'::timestamptz,
  'd2000000-0000-4000-8000-000000000001',
  '2026-09-29 09:30:00 America/Bogota'::timestamptz,
  'Resuelto'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.organizations(
  id,code,name,timezone,active
) values (
  'd6000000-0000-4000-8000-000000000001',
  'AN-OTHER','Analytics Other Org','America/Bogota',true
);

insert into erp_supply.analytics_historical_stage_events(
  id,organization_id,external_order_key,order_number,step_code,task_created_at,
  waiting_seconds,processing_seconds,blocked_seconds,source,external_key,created_by
) values (
  'd7000000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001',
  'OTHER-ORDER','OTHER-001','ALISTAMIENTO',
  '2026-09-29 07:00:00 America/Bogota'::timestamptz,
  60,120,0,'PGTAP_OTHER','OTHER-ROW',
  'd2000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","email":"analytics-pgtap@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from erp_supply.analytics_historical_stage_events
    where organization_id='d6000000-0000-4000-8000-000000000001'
  ),
  0,
  'RLS hides historical analytics from another organization'
);

select is(
  (
    select count(*)::integer
    from erp_supply.analytics_kpi_catalog
    where active
  ),
  12,
  'central KPI catalog exposes the expected definitions'
);

select is(
  (
    select waiting_seconds
    from erp_private.analytics_stage_metrics(
      erp_private.current_org_id(),
      '2026-09-29 07:00:00 America/Bogota'::timestamptz,
      '2026-09-29 11:00:00 America/Bogota'::timestamptz
    )
    where order_id='d3000000-0000-4000-8000-000000000001'
  ),
  3600::bigint,
  'stage read model calculates one business hour of waiting'
);

select is(
  (
    select blocked_seconds
    from erp_private.analytics_stage_metrics(
      erp_private.current_org_id(),
      '2026-09-29 07:00:00 America/Bogota'::timestamptz,
      '2026-09-29 11:00:00 America/Bogota'::timestamptz
    )
    where order_id='d3000000-0000-4000-8000-000000000001'
  ),
  1800::bigint,
  'stage read model isolates blocked time'
);

select is(
  (
    select processing_seconds
    from erp_private.analytics_stage_metrics(
      erp_private.current_org_id(),
      '2026-09-29 07:00:00 America/Bogota'::timestamptz,
      '2026-09-29 11:00:00 America/Bogota'::timestamptz
    )
    where order_id='d3000000-0000-4000-8000-000000000001'
  ),
  5400::bigint,
  'processing time excludes explicit blocked time'
);

select is(
  (
    public.erp_x_analytics_dashboard(
      '2026-09-29','2026-09-29',null,null,null,null,null,null,null
    )->'summary'->>'ordersTotal'
  )::integer,
  1,
  'dashboard counts orders created in the local calendar day'
);

select is(
  (
    public.erp_x_analytics_dashboard(
      '2026-09-29','2026-09-29',null,null,null,null,null,null,null
    )->'summary'->>'ordersClosed'
  )::integer,
  1,
  'dashboard counts closures using the same local date range'
);

select is(
  (
    public.erp_x_analytics_vsm_summary(
      '2026-09-29','2026-09-29',null,null,'ALISTAMIENTO',null,null,null
    )->'stages'->0->>'medianMinutes'
  )::numeric,
  180::numeric,
  'VSM median is calculated from total business cycle time'
);

select is(
  (
    public.erp_x_analytics_order_vsm(
      'd3000000-0000-4000-8000-000000000001',null
    )->>'leadTimeMinutes'
  )::numeric,
  180::numeric,
  'order VSM reports lead time separately from processing time'
);

select is(
  (
    public.erp_x_analytics_report(
      'orders',
      '{"from":"2026-09-29","to":"2026-09-29","search":"AN-PGTAP"}'::jsonb,
      1,25
    )->'pagination'->>'totalItems'
  )::integer,
  1,
  'report explorer applies date and search filters server side'
);

select ok(
  jsonb_array_length(public.erp_x_analytics_report_catalog()->'items')>=5,
  'report catalog is capability driven and reusable'
);

select lives_ok(
  $$select public.erp_x_analytics_record_export(
    'orders','{"from":"2026-09-29","to":"2026-09-29"}'::jsonb,'CSV',1
  )$$,
  'controlled page export is audited'
);

select is(
  (
    select count(*)::integer from erp_supply.analytics_export_audit
    where actor_profile_id='d2000000-0000-4000-8000-000000000001'
  ),
  1,
  'export audit records actor and scope'
);

select is(
  (
    public.erp_x_analytics_import_preview(
      'ORDER_STAGE_HISTORY_V1',
      'analytics-history.csv',
      repeat('a',64),
      512,
      'PGTAP_IMPORT',
      '[{
        "externalKey":"ROW-1",
        "externalOrderKey":"HIST-1",
        "orderNumber":"HIST-001",
        "clientName":"Cliente histórico",
        "sellerReference":"V-1",
        "routeCode":"LOCAL_DISPATCH",
        "stepCode":"ALISTAMIENTO",
        "taskCreatedAt":"2026-09-28T12:00:00Z",
        "startedAt":"2026-09-28T13:00:00Z",
        "completedAt":"2026-09-28T14:00:00Z",
        "waitingSeconds":"3600",
        "processingSeconds":"3600",
        "blockedSeconds":"0",
        "transitSeconds":"0"
      }]'::jsonb
    )->>'validRows'
  )::integer,
  1,
  'historical import preview validates a synthetic row'
);

select is(
  (
    public.erp_x_analytics_import_preview(
      'ORDER_STAGE_HISTORY_V1',
      'analytics-history.csv',
      repeat('a',64),
      512,
      'PGTAP_IMPORT',
      '[{"externalKey":"IGNORED"}]'::jsonb
    )->>'idempotent'
  )::boolean,
  true,
  'same checksum reuses the existing import batch'
);

select lives_ok(
  $$select public.erp_x_analytics_import_apply(
    (
      select id from erp_supply.analytics_import_batches
      where checksum_sha256=repeat('a',64)
    )
  )$$,
  'valid historical rows apply through staging'
);

select is(
  (
    select count(*)::integer
    from erp_supply.analytics_historical_stage_events
    where organization_id=erp_private.current_org_id()
      and source='PGTAP_IMPORT'
      and external_key='ROW-1'
  ),
  1,
  'applied import creates exactly one analytics historical fact'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","email":"analytics-viewer@example.test"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.erp_x_analytics_import_preview(
    'ORDER_STAGE_HISTORY_V1','viewer.csv',repeat('b',64),128,'VIEWER',
    '[{"externalKey":"ROW"}]'::jsonb
  )$$,
  '42501',null,
  'read-only analytics user cannot create historical imports'
);

select * from finish();
rollback;
