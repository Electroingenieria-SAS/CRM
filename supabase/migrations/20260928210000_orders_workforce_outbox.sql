begin;

create table erp_supply.order_workforce_step_mappings (
  step_code text primary key references erp_supply.workflow_steps(code) on delete cascade,
  workforce_catalog_code text not null,
  activity_title text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check(length(trim(workforce_catalog_code)) > 0),
  check(length(trim(activity_title)) > 0)
);

insert into erp_supply.order_workforce_step_mappings(
  step_code,workforce_catalog_code,activity_title,metadata
) values
('ALISTAMIENTO','LOG_SUPPORT_PICKING','Alistamiento de pedido','{"integration":"orders-workforce","operational":true}'::jsonb),
('CORTE','LOG_SUPPORT_CUTTING','Corte de pedido','{"integration":"orders-workforce","operational":true}'::jsonb),
('LOCAL_DISPATCH','LOG_LOADING','Despacho local','{"integration":"orders-workforce","operational":true}'::jsonb),
('NATIONAL_DISPATCH','LOG_LOADING','Despacho nacional','{"integration":"orders-workforce","operational":true}'::jsonb),
('CLIENT_POINT','LOG_LOADING','Entrega en punto','{"integration":"orders-workforce","operational":true}'::jsonb),
('CLIENT_PICKUP','LOG_LOADING','Entrega a cliente que recoge','{"integration":"orders-workforce","operational":true}'::jsonb)
on conflict(step_code) do update set
  workforce_catalog_code=excluded.workforce_catalog_code,
  activity_title=excluded.activity_title,
  active=excluded.active,
  metadata=excluded.metadata,
  updated_at=now();

create table erp_supply.order_workforce_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_event_id bigint references erp_supply.order_events(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  order_task_id uuid references erp_supply.order_tasks(id) on delete cascade,
  step_code text not null references erp_supply.workflow_steps(code),
  integration_event text not null,
  workforce_catalog_code text not null,
  actor_profile_id uuid references erp_supply.profiles(id),
  assignee_profile_id uuid references erp_supply.profiles(id),
  seller_profile_id uuid not null references erp_supply.profiles(id),
  dedupe_key text not null,
  status text not null default 'PENDING'
    check(status in('PENDING','PROCESSING','PROCESSED','FAILED','SKIPPED')),
  attempts integer not null default 0 check(attempts >= 0),
  locked_by uuid references erp_supply.profiles(id),
  locked_at timestamptz,
  processed_at timestamptz,
  next_retry_at timestamptz,
  workforce_activity_id uuid,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,dedupe_key),
  check(length(trim(integration_event)) > 0),
  check(length(trim(workforce_catalog_code)) > 0),
  check(length(trim(dedupe_key)) > 0)
);

create unique index uq_order_workforce_outbox_order_event
on erp_supply.order_workforce_outbox(order_event_id)
where order_event_id is not null;

create index idx_order_workforce_outbox_pending
on erp_supply.order_workforce_outbox(organization_id,status,created_at)
where status in('PENDING','FAILED','PROCESSING');

create index idx_order_workforce_outbox_task
on erp_supply.order_workforce_outbox(organization_id,order_task_id,created_at);

alter table erp_supply.order_workforce_step_mappings enable row level security;
alter table erp_supply.order_workforce_outbox enable row level security;

create or replace function erp_private.capture_order_workforce_event()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,erp_supply
as $$
declare
  v_step text;
  v_assignee uuid;
  v_seller uuid;
  v_mapping erp_supply.order_workforce_step_mappings%rowtype;
  v_event text:=new.payload->>'integrationEvent';
begin
  if v_event is null or v_event not in(
    'OrderTaskClaimed',
    'OrderTaskAssigned',
    'OrderTaskStarted',
    'OrderBlocked',
    'OrderTaskResumed',
    'OrderTaskCompleted',
    'OrderCancelled'
  ) then
    return new;
  end if;

  if new.task_id is not null then
    select t.step_code,t.assigned_profile_id
    into v_step,v_assignee
    from erp_supply.order_tasks t
    where t.id=new.task_id;
  end if;

  v_step:=coalesce(v_step,new.to_step_code,new.from_step_code);
  if v_step is null then return new; end if;

  select * into v_mapping
  from erp_supply.order_workforce_step_mappings m
  where m.step_code=v_step and m.active;

  if not found then return new; end if;

  select o.seller_profile_id into v_seller
  from erp_supply.orders o
  where o.id=new.order_id and o.organization_id=new.organization_id;

  v_assignee:=coalesce(
    nullif(new.payload->>'assignedProfileId','')::uuid,
    v_assignee,
    new.actor_profile_id
  );

  insert into erp_supply.order_workforce_outbox(
    organization_id,order_event_id,order_id,order_task_id,step_code,
    integration_event,workforce_catalog_code,actor_profile_id,
    assignee_profile_id,seller_profile_id,dedupe_key,payload
  ) values(
    new.organization_id,new.id,new.order_id,new.task_id,v_step,
    v_event,v_mapping.workforce_catalog_code,new.actor_profile_id,
    v_assignee,v_seller,'order-event:'||new.id::text,
    jsonb_build_object(
      'contractVersion','1.0.0',
      'orderEventId',new.id,
      'orderId',new.order_id,
      'orderTaskId',new.task_id,
      'stepCode',v_step,
      'integrationEvent',v_event,
      'workforceCatalogCode',v_mapping.workforce_catalog_code,
      'activityTitle',v_mapping.activity_title,
      'actorProfileId',new.actor_profile_id,
      'assigneeProfileId',v_assignee,
      'sellerProfileId',v_seller,
      'occurredAt',new.created_at,
      'orderPayload',new.payload
    )
  )
  on conflict(organization_id,dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function erp_private.capture_order_workforce_event() from public,anon,authenticated;

drop trigger if exists trg_capture_order_workforce_event on erp_supply.order_events;
create trigger trg_capture_order_workforce_event
after insert on erp_supply.order_events
for each row execute function erp_private.capture_order_workforce_event();

create policy order_workforce_mapping_read
on erp_supply.order_workforce_step_mappings
for select to authenticated
using(active);

create policy order_workforce_outbox_read
on erp_supply.order_workforce_outbox
for select to authenticated
using(
  organization_id=erp_private.current_org_id()
  and (
    actor_profile_id=erp_private.current_profile_id()
    or assignee_profile_id=erp_private.current_profile_id()
    or erp_private.can_access_module('orders','update')
    or erp_private.can_access_module('workforce','read')
  )
);

create policy order_workforce_outbox_update
on erp_supply.order_workforce_outbox
for update to authenticated
using(
  organization_id=erp_private.current_org_id()
  and (
    actor_profile_id=erp_private.current_profile_id()
    or assignee_profile_id=erp_private.current_profile_id()
    or erp_private.can_access_module('orders','update')
    or erp_private.can_access_module('workforce','admin')
  )
)
with check(organization_id=erp_private.current_org_id());

create policy order_workforce_outbox_reconcile_insert
on erp_supply.order_workforce_outbox
for insert to authenticated
with check(
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('orders','update')
    or erp_private.can_access_module('workforce','admin')
  )
);

grant select on erp_supply.order_workforce_step_mappings to authenticated;
grant select,insert,update on erp_supply.order_workforce_outbox to authenticated;

create or replace function public.erp_x_order_workforce_pending(
  p_order_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
  select jsonb_build_object(
    'items',
    coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,
      'orderId',x.order_id,
      'orderTaskId',x.order_task_id,
      'stepCode',x.step_code,
      'integrationEvent',x.integration_event,
      'workforceCatalogCode',x.workforce_catalog_code,
      'actorProfileId',x.actor_profile_id,
      'assigneeProfileId',x.assignee_profile_id,
      'sellerProfileId',x.seller_profile_id,
      'dedupeKey',x.dedupe_key,
      'status',x.status,
      'attempts',x.attempts,
      'workforceActivityId',x.workforce_activity_id,
      'payload',x.payload,
      'createdAt',x.created_at
    ) order by x.created_at,x.id),'[]'::jsonb),
    'contractVersion','1.0.0'
  )
  from (
    select o.*
    from erp_supply.order_workforce_outbox o
    where (p_order_id is null or o.order_id=p_order_id)
      and (
        o.status in('PENDING','FAILED')
        or (o.status='PROCESSING' and o.locked_at < now()-interval '5 minutes')
      )
      and (o.next_retry_at is null or o.next_retry_at<=now())
    order by o.created_at,o.id
    limit least(greatest(coalesce(p_limit,20),1),100)
  ) x
$$;

create or replace function public.erp_x_order_workforce_claim_outbox(
  p_outbox_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_row erp_supply.order_workforce_outbox%rowtype;
begin
  if v_actor is null then raise exception 'Usuario sin perfil operativo activo' using errcode='42501'; end if;

  update erp_supply.order_workforce_outbox
  set status='PROCESSING',attempts=attempts+1,locked_by=v_actor,locked_at=now(),
      last_error=null,updated_at=now()
  where id=p_outbox_id
    and (
      status in('PENDING','FAILED')
      or (status='PROCESSING' and locked_at < now()-interval '5 minutes')
    )
    and (next_retry_at is null or next_retry_at<=now())
  returning * into v_row;

  if not found then
    select * into v_row from erp_supply.order_workforce_outbox where id=p_outbox_id;
    if v_row.status='PROCESSED' then
      return jsonb_build_object(
        'success',true,'idempotent',true,'outboxId',v_row.id,
        'status',v_row.status,'workforceActivityId',v_row.workforce_activity_id,
        'contractVersion','1.0.0'
      );
    end if;
    raise exception 'El evento de integración ya está siendo procesado o no está disponible' using errcode='40001';
  end if;

  return jsonb_build_object(
    'success',true,'idempotent',false,'outboxId',v_row.id,
    'status',v_row.status,'event',v_row.payload,'dedupeKey',v_row.dedupe_key,
    'attempts',v_row.attempts,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_order_workforce_mark_processed(
  p_outbox_id uuid,
  p_workforce_activity_id uuid,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_row erp_supply.order_workforce_outbox%rowtype;
begin
  update erp_supply.order_workforce_outbox
  set status='PROCESSED',workforce_activity_id=p_workforce_activity_id,
      processed_at=now(),locked_by=null,locked_at=null,next_retry_at=null,
      payload=payload||jsonb_build_object('workforceResult',coalesce(p_result,'{}'::jsonb)),
      updated_at=now()
  where id=p_outbox_id
    and status='PROCESSING'
    and locked_by=v_actor
  returning * into v_row;

  if not found then
    select * into v_row from erp_supply.order_workforce_outbox where id=p_outbox_id;
    if v_row.status='PROCESSED' and v_row.workforce_activity_id=p_workforce_activity_id then
      return jsonb_build_object('success',true,'idempotent',true,'outboxId',v_row.id,'contractVersion','1.0.0');
    end if;
    raise exception 'No puedes confirmar este evento de integración' using errcode='42501';
  end if;

  return jsonb_build_object(
    'success',true,'idempotent',false,'outboxId',v_row.id,
    'workforceActivityId',v_row.workforce_activity_id,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_order_workforce_mark_failed(
  p_outbox_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_row erp_supply.order_workforce_outbox%rowtype;
begin
  if nullif(trim(p_error),'') is null then raise exception 'Detalle de error requerido' using errcode='22023'; end if;

  update erp_supply.order_workforce_outbox
  set status='FAILED',last_error=left(trim(p_error),1000),
      next_retry_at=now()+make_interval(mins=>least(30,greatest(1,attempts*2))),
      locked_by=null,locked_at=null,updated_at=now()
  where id=p_outbox_id and status='PROCESSING' and locked_by=v_actor
  returning * into v_row;

  if not found then raise exception 'No puedes marcar este evento como fallido' using errcode='42501'; end if;

  return jsonb_build_object(
    'success',true,'outboxId',v_row.id,'status','FAILED',
    'nextRetryAt',v_row.next_retry_at,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_order_workforce_reconcile(
  p_order_id uuid default null,
  p_repair boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_repaired integer:=0;
  v_items jsonb;
begin
  if not (
    erp_private.can_access_module('orders','update')
    or erp_private.can_access_module('workforce','admin')
  ) then
    raise exception 'No autorizado para reconciliar Orders y Workforce' using errcode='42501';
  end if;

  if p_repair then
    insert into erp_supply.order_workforce_outbox(
      organization_id,order_id,order_task_id,step_code,integration_event,
      workforce_catalog_code,actor_profile_id,assignee_profile_id,
      seller_profile_id,dedupe_key,payload
    )
    select
      o.organization_id,o.id,t.id,t.step_code,'ReconcileOrderTask',
      m.workforce_catalog_code,v_actor,t.assigned_profile_id,o.seller_profile_id,
      'reconcile:'||t.id::text||':'||t.status||':'||coalesce(t.assigned_profile_id::text,'unassigned'),
      jsonb_build_object(
        'contractVersion','1.0.0',
        'integrationEvent','ReconcileOrderTask',
        'orderId',o.id,
        'orderTaskId',t.id,
        'stepCode',t.step_code,
        'workforceCatalogCode',m.workforce_catalog_code,
        'assigneeProfileId',t.assigned_profile_id,
        'sellerProfileId',o.seller_profile_id,
        'orderTaskStatus',t.status,
        'occurredAt',now(),
        'reconciliation',true
      )
    from erp_supply.order_tasks t
    join erp_supply.orders o on o.id=t.order_id
    join erp_supply.order_workforce_step_mappings m on m.step_code=t.step_code and m.active
    where o.organization_id=v_org
      and (p_order_id is null or o.id=p_order_id)
      and t.status in('ASSIGNED','IN_PROGRESS','BLOCKED')
      and not exists(
        select 1 from erp_supply.order_workforce_outbox x
        where x.organization_id=v_org
          and x.order_task_id=t.id
          and x.status='PROCESSED'
          and x.workforce_activity_id is not null
      )
    on conflict(organization_id,dedupe_key) do nothing;

    get diagnostics v_repaired=row_count;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',o.id,
    'orderNumber',o.order_number,
    'orderTaskId',t.id,
    'stepCode',t.step_code,
    'taskStatus',t.status,
    'assigneeProfileId',t.assigned_profile_id,
    'sellerProfileId',o.seller_profile_id,
    'issue',case
      when x.id is null then 'MISSING_INTEGRATION_EVENT'
      when x.status='FAILED' then 'FAILED_INTEGRATION_EVENT'
      when x.status='PROCESSING' and x.locked_at < now()-interval '5 minutes' then 'STALE_PROCESSING_EVENT'
      else 'PENDING_INTEGRATION_EVENT'
    end
  ) order by o.updated_at desc),'[]'::jsonb)
  into v_items
  from erp_supply.order_tasks t
  join erp_supply.orders o on o.id=t.order_id
  join erp_supply.order_workforce_step_mappings m on m.step_code=t.step_code and m.active
  left join lateral (
    select y.*
    from erp_supply.order_workforce_outbox y
    where y.organization_id=v_org and y.order_task_id=t.id
    order by y.created_at desc
    limit 1
  ) x on true
  where o.organization_id=v_org
    and (p_order_id is null or o.id=p_order_id)
    and t.status in('ASSIGNED','IN_PROGRESS','BLOCKED')
    and coalesce(x.status,'PENDING')<>'PROCESSED';

  return jsonb_build_object(
    'items',v_items,
    'repaired',v_repaired,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_order_workforce_pending(uuid,integer) from public,anon;
revoke all on function public.erp_x_order_workforce_claim_outbox(uuid) from public,anon;
revoke all on function public.erp_x_order_workforce_mark_processed(uuid,uuid,jsonb) from public,anon;
revoke all on function public.erp_x_order_workforce_mark_failed(uuid,text) from public,anon;
revoke all on function public.erp_x_order_workforce_reconcile(uuid,boolean) from public,anon;

grant execute on function public.erp_x_order_workforce_pending(uuid,integer) to authenticated;
grant execute on function public.erp_x_order_workforce_claim_outbox(uuid) to authenticated;
grant execute on function public.erp_x_order_workforce_mark_processed(uuid,uuid,jsonb) to authenticated;
grant execute on function public.erp_x_order_workforce_mark_failed(uuid,text) to authenticated;
grant execute on function public.erp_x_order_workforce_reconcile(uuid,boolean) to authenticated;

commit;
