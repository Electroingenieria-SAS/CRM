\set ON_ERROR_STOP on

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_document,client_city,client_address,seller_profile_id,current_step_code,
  status,priority,source,is_test,created_at,updated_at,closed_at
)
select
  v.id,o.id,v.order_number,'PVC','CASH',v.route,
  v.client_name,v.document,'Cali','Calle Analytics E2E',
  '93000000-0000-4000-8000-000000000004',
  v.step_code,v.status,'MEDIUM','QA_BOT',false,
  v.created_at,v.updated_at,v.closed_at
from erp_supply.organizations o
cross join (
  values
    (
      'aa100000-0000-4000-8000-000000000001'::uuid,
      'AN-E2E-FAST','Cliente rápido','AN-E2E-FAST-DOC',
      'LOCAL_DISPATCH','CLOSED','CLOSED',
      '2026-09-29 07:00 America/Bogota'::timestamptz,
      '2026-09-29 08:00 America/Bogota'::timestamptz,
      '2026-09-29 08:00 America/Bogota'::timestamptz
    ),
    (
      'aa100000-0000-4000-8000-000000000002'::uuid,
      'AN-E2E-SLOW','Cliente lento','AN-E2E-SLOW-DOC',
      'NATIONAL_DISPATCH','CORTE','IN_PROGRESS',
      '2026-09-29 07:00 America/Bogota'::timestamptz,
      '2026-09-29 11:30 America/Bogota'::timestamptz,
      null::timestamptz
    ),
    (
      'aa100000-0000-4000-8000-000000000003'::uuid,
      'AN-E2E-BLOCKED','Cliente bloqueado','AN-E2E-BLOCKED-DOC',
      'CLIENT_PICKUP','ALISTAMIENTO','BLOCKED',
      '2026-09-29 07:00 America/Bogota'::timestamptz,
      '2026-09-29 09:00 America/Bogota'::timestamptz,
      null::timestamptz
    )
) v(id,order_number,client_name,document,route,step_code,status,created_at,updated_at,closed_at)
where o.code='EI'
on conflict (organization_id,order_number) do nothing;

insert into erp_supply.order_tasks(
  id,order_id,step_code,sequence_no,queue_code,status,assigned_profile_id,
  created_at,started_at,completed_at
) values
(
  'aa200000-0000-4000-8000-000000000001',
  'aa100000-0000-4000-8000-000000000001',
  'ALISTAMIENTO',1,'ALISTAMIENTO','COMPLETED',
  '93000000-0000-4000-8000-000000000011',
  '2026-09-29 07:00 America/Bogota'::timestamptz,
  '2026-09-29 07:15 America/Bogota'::timestamptz,
  '2026-09-29 08:00 America/Bogota'::timestamptz
),
(
  'aa200000-0000-4000-8000-000000000002',
  'aa100000-0000-4000-8000-000000000002',
  'CORTE',1,'CORTE','IN_PROGRESS',
  '93000000-0000-4000-8000-000000000011',
  '2026-09-29 07:00 America/Bogota'::timestamptz,
  '2026-09-29 08:30 America/Bogota'::timestamptz,
  null
),
(
  'aa200000-0000-4000-8000-000000000003',
  'aa100000-0000-4000-8000-000000000003',
  'ALISTAMIENTO',1,'ALISTAMIENTO','BLOCKED',
  '93000000-0000-4000-8000-000000000011',
  '2026-09-29 07:00 America/Bogota'::timestamptz,
  '2026-09-29 07:30 America/Bogota'::timestamptz,
  null
)
on conflict (id) do nothing;

insert into erp_supply.order_blocks(
  id,organization_id,order_id,task_id,reason_code,detail,status,
  blocked_by,blocked_at,metadata
)
select
  'aa300000-0000-4000-8000-000000000001',o.id,
  'aa100000-0000-4000-8000-000000000003',
  'aa200000-0000-4000-8000-000000000003',
  'MATERIAL','Bloqueo sintético para Analytics','OPEN',
  '93000000-0000-4000-8000-000000000011',
  '2026-09-29 08:00 America/Bogota'::timestamptz,
  '{"synthetic":true}'::jsonb
from erp_supply.organizations o
where o.code='EI'
on conflict (id) do nothing;
