begin;

create table erp_supply.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id) on delete restrict,
  actor_profile_id uuid references erp_supply.profiles(id) on delete set null,
  actor_kind text not null default 'USER' check (actor_kind in ('USER','SYSTEM','SERVICE')),
  module_code text not null check (btrim(module_code)<>''),
  action text not null check (btrim(action)<>''),
  resource_type text not null check (btrim(resource_type)<>''),
  resource_id text,
  result text not null check (result in ('SUCCESS','FAILED','DENIED','REQUESTED','ACKNOWLEDGED')),
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    metadata::text !~* '"(password|passwd|token|access_token|refresh_token|service_role|authorization|jwt|secret)"[[:space:]]*:'
  )
);

create index idx_audit_events_org_time
on erp_supply.audit_events(organization_id,created_at desc,id desc);

create index idx_audit_events_org_actor_time
on erp_supply.audit_events(organization_id,actor_profile_id,created_at desc);

create index idx_audit_events_org_module_action
on erp_supply.audit_events(organization_id,module_code,action,created_at desc);

alter table erp_supply.audit_events enable row level security;

create policy audit_events_read
on erp_supply.audit_events
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('audit','read')
);

grant select on erp_supply.audit_events to authenticated;
revoke insert,update,delete on erp_supply.audit_events from authenticated;

create or replace function erp_private.audit_safe_metadata(p_metadata jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path=pg_catalog
as $$
  select coalesce(p_metadata,'{}'::jsonb)
    - 'password'
    - 'passwd'
    - 'token'
    - 'access_token'
    - 'refresh_token'
    - 'service_role'
    - 'authorization'
    - 'jwt'
    - 'secret'
$$;

revoke all on function erp_private.audit_safe_metadata(jsonb) from public,anon;
grant execute on function erp_private.audit_safe_metadata(jsonb) to authenticated,service_role;

create or replace function erp_private.audit_event(
  p_module_code text,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_result text,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null,
  p_actor_kind text default 'USER'
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_id bigint;
begin
  if v_org is null then
    raise exception 'No active organization for audit event' using errcode='42501';
  end if;

  insert into erp_supply.audit_events(
    organization_id,actor_profile_id,actor_kind,module_code,action,
    resource_type,resource_id,result,request_id,metadata
  )
  values(
    v_org,v_actor,upper(coalesce(nullif(btrim(p_actor_kind),''),'USER')),
    lower(btrim(p_module_code)),upper(btrim(p_action)),
    lower(btrim(p_resource_type)),nullif(btrim(coalesce(p_resource_id,'')),''),
    upper(btrim(p_result)),nullif(btrim(coalesce(p_request_id,'')),''),
    erp_private.audit_safe_metadata(p_metadata)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function erp_private.audit_event(
  text,text,text,text,text,jsonb,text,text
) from public,anon;
grant execute on function erp_private.audit_event(
  text,text,text,text,text,jsonb,text,text
) to authenticated;

create or replace function erp_private.audit_events_immutable()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog
as $$
begin
  raise exception 'Audit events are append-only' using errcode='55000';
end;
$$;

create trigger trg_audit_events_immutable
before update or delete on erp_supply.audit_events
for each row execute function erp_private.audit_events_immutable();

create or replace function erp_private.audit_order_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_action text;
begin
  if old.status is distinct from new.status and new.status='CANCELLED' then
    v_action:='ORDER_CANCELLED';
  elsif old.status='CLOSED' and new.status is distinct from 'CLOSED' then
    v_action:='ORDER_REOPENED';
  else
    return new;
  end if;

  perform erp_private.audit_event(
    'orders',v_action,'order',new.id::text,'SUCCESS',
    jsonb_build_object(
      'orderNumber',new.order_number,
      'fromStatus',old.status,
      'toStatus',new.status
    )
  );
  return new;
end;
$$;

create trigger trg_orders_sensitive_audit
after update of status on erp_supply.orders
for each row execute function erp_private.audit_order_sensitive_change();

create or replace function erp_private.audit_financial_event()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  insert into erp_supply.audit_events(
    organization_id,actor_profile_id,actor_kind,module_code,action,
    resource_type,resource_id,result,metadata,created_at
  )
  values(
    new.organization_id,new.actor_profile_id,'USER','finance',upper(new.event_type),
    lower(new.aggregate_type),new.aggregate_id::text,'SUCCESS',
    erp_private.audit_safe_metadata(
      jsonb_build_object('orderId',new.order_id,'payload',new.payload)
    ),
    new.created_at
  );
  return new;
end;
$$;

create trigger trg_financial_events_audit
after insert on erp_supply.financial_events
for each row execute function erp_private.audit_financial_event();

create or replace function erp_private.audit_inventory_sensitive_movement()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if new.movement_type not in ('ADJUSTMENT_IN','ADJUSTMENT_OUT','REVERSAL') then
    return new;
  end if;

  insert into erp_supply.audit_events(
    organization_id,actor_profile_id,actor_kind,module_code,action,
    resource_type,resource_id,result,metadata,created_at
  )
  values(
    new.organization_id,new.actor_profile_id,'USER','inventory',
    'INVENTORY_'||new.movement_type,'inventory_movement',new.id::text,'SUCCESS',
    jsonb_build_object(
      'orderId',new.order_id,
      'materialId',new.material_id,
      'variantId',new.variant_id,
      'locationId',new.location_id,
      'quantity',new.quantity,
      'unit',new.unit,
      'reference',new.reference,
      'reason',new.reason
    ),
    new.created_at
  );
  return new;
end;
$$;

create trigger trg_inventory_sensitive_audit
after insert on erp_supply.inventory_movements
for each row execute function erp_private.audit_inventory_sensitive_movement();

create or replace function public.erp_x_audit_events(
  p_from date default null,
  p_to date default null,
  p_actor_id uuid default null,
  p_module text default null,
  p_action text default null,
  p_resource text default null,
  p_result text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_tz text;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_total integer;
  v_items jsonb;
begin
  if v_org is null or not erp_private.can_access_module('audit','read') then
    raise exception 'No autorizado para consultar auditoría' using errcode='42501';
  end if;

  select coalesce(timezone,'America/Bogota') into v_tz
  from erp_supply.organizations where id=v_org;

  v_to:=coalesce(p_to,(now() at time zone v_tz)::date);
  v_from:=coalesce(p_from,v_to-29);
  if v_to<v_from or v_to-v_from>365 then
    raise exception 'Rango de auditoría inválido; máximo 366 días' using errcode='22023';
  end if;

  v_start:=v_from::timestamp at time zone v_tz;
  v_end:=(v_to+1)::timestamp at time zone v_tz;

  select count(*)::integer into v_total
  from erp_supply.audit_events a
  where a.organization_id=v_org
    and a.created_at>=v_start and a.created_at<v_end
    and (p_actor_id is null or a.actor_profile_id=p_actor_id)
    and (nullif(btrim(coalesce(p_module,'')),'') is null or a.module_code=lower(btrim(p_module)))
    and (nullif(btrim(coalesce(p_action,'')),'') is null or a.action=upper(btrim(p_action)))
    and (
      nullif(btrim(coalesce(p_resource,'')),'') is null
      or a.resource_type=lower(btrim(p_resource))
      or a.resource_id=btrim(p_resource)
    )
    and (nullif(btrim(coalesce(p_result,'')),'') is null or a.result=upper(btrim(p_result)));

  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc,x.id desc),'[]'::jsonb)
  into v_items
  from (
    select
      a.id,
      a.created_at "createdAt",
      a.actor_profile_id "actorId",
      coalesce(p.display_name,case when a.actor_kind='SYSTEM' then 'Sistema' else 'Servicio' end) actor,
      a.actor_kind "actorKind",
      a.module_code module,
      a.action,
      a.resource_type "resourceType",
      a.resource_id "resourceId",
      a.result,
      a.request_id "requestId",
      a.metadata
    from erp_supply.audit_events a
    left join erp_supply.profiles p on p.id=a.actor_profile_id
    where a.organization_id=v_org
      and a.created_at>=v_start and a.created_at<v_end
      and (p_actor_id is null or a.actor_profile_id=p_actor_id)
      and (nullif(btrim(coalesce(p_module,'')),'') is null or a.module_code=lower(btrim(p_module)))
      and (nullif(btrim(coalesce(p_action,'')),'') is null or a.action=upper(btrim(p_action)))
      and (
        nullif(btrim(coalesce(p_resource,'')),'') is null
        or a.resource_type=lower(btrim(p_resource))
        or a.resource_id=btrim(p_resource)
      )
      and (nullif(btrim(coalesce(p_result,'')),'') is null or a.result=upper(btrim(p_result)))
    order by a.created_at desc,a.id desc
    limit v_size offset (v_page-1)*v_size
  ) x;

  return jsonb_build_object(
    'items',v_items,
    'range',jsonb_build_object('from',v_from,'to',v_to,'timezone',v_tz),
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_audit_events(
  date,date,uuid,text,text,text,text,integer,integer
) from public,anon;
grant execute on function public.erp_x_audit_events(
  date,date,uuid,text,text,text,text,integer,integer
) to authenticated;

commit;
