begin;

create table erp_supply.logistics_shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  route_code text not null references erp_supply.delivery_routes(code),
  status text not null default 'READY'
    check (status in ('READY','IN_TRANSIT','DELIVERED','DELIVERY_FAILED','RETURNED','CANCELLED')),
  carrier_id uuid references erp_supply.freight_carriers(id),
  destination_id uuid references erp_supply.freight_destinations(id),
  prediction_id uuid references erp_supply.freight_predictions(id),
  tracking_number text,
  estimated_freight numeric(18,2) check (estimated_freight is null or estimated_freight>=0),
  estimated_freight_low numeric(18,2) check (estimated_freight_low is null or estimated_freight_low>=0),
  estimated_freight_high numeric(18,2) check (estimated_freight_high is null or estimated_freight_high>=0),
  actual_freight numeric(18,2) check (actual_freight is null or actual_freight>=0),
  freight_sync_status text not null default 'NOT_REQUIRED'
    check (freight_sync_status in ('NOT_REQUIRED','PENDING','SYNCED','FAILED')),
  released_by uuid not null references erp_supply.profiles(id),
  released_at timestamptz not null default now(),
  dispatched_by uuid references erp_supply.profiles(id),
  dispatched_at timestamptz,
  delivered_by uuid references erp_supply.profiles(id),
  delivered_at timestamptz,
  received_by text,
  return_reason text,
  version integer not null default 1 check (version>0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,order_id),
  check (delivered_at is null or dispatched_at is null or delivered_at>=dispatched_at),
  check (
    (status='READY' and delivered_at is null)
    or status<>'READY'
  )
);

create unique index uq_logistics_tracking
on erp_supply.logistics_shipments(organization_id,carrier_id,tracking_number)
where carrier_id is not null and tracking_number is not null;

create index idx_logistics_queue
on erp_supply.logistics_shipments(organization_id,status,route_code,updated_at desc);

create table erp_supply.logistics_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id),
  shipment_id uuid not null references erp_supply.logistics_shipments(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_profile_id uuid not null references erp_supply.profiles(id),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id,idempotency_key)
);

create index idx_logistics_events_order
on erp_supply.logistics_events(organization_id,order_id,created_at desc);

create table erp_supply.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  shipment_id uuid not null references erp_supply.logistics_shipments(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  attempt_no integer not null check (attempt_no>0),
  outcome text not null check (outcome in ('DELIVERED','FAILED','RETURNED')),
  occurred_at timestamptz not null default now(),
  evidence_id uuid references erp_supply.order_evidence(id),
  received_by text,
  reason text,
  observation text,
  next_state text check (next_state is null or next_state in ('READY','RETURNED','CANCELLED')),
  actor_profile_id uuid not null references erp_supply.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  unique (shipment_id,attempt_no)
);

create table erp_supply.delivery_satisfaction (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  shipment_id uuid not null references erp_supply.logistics_shipments(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  comment text check (comment is null or length(comment)<=1000),
  recorded_by uuid not null references erp_supply.profiles(id),
  recorded_at timestamptz not null default now(),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id,order_id),
  unique (organization_id,idempotency_key)
);

alter table erp_supply.logistics_shipments enable row level security;
alter table erp_supply.logistics_events enable row level security;
alter table erp_supply.delivery_attempts enable row level security;
alter table erp_supply.delivery_satisfaction enable row level security;

create policy logistics_shipments_read
on erp_supply.logistics_shipments for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('billing','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  )
);

create policy logistics_shipments_insert
on erp_supply.logistics_shipments for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and released_by=erp_private.current_profile_id()
  and erp_private.can_access_module('shipping','create')
);

create policy logistics_shipments_update
on erp_supply.logistics_shipments for update to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('shipping','update')
)
with check (organization_id=erp_private.current_org_id());

create policy logistics_events_read
on erp_supply.logistics_events for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  )
);

create policy logistics_events_insert
on erp_supply.logistics_events for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and actor_profile_id=erp_private.current_profile_id()
  and erp_private.can_access_module('shipping','update')
);

create policy delivery_attempts_read
on erp_supply.delivery_attempts for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  )
);

create policy delivery_attempts_insert
on erp_supply.delivery_attempts for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and actor_profile_id=erp_private.current_profile_id()
  and erp_private.can_access_module('shipping','update')
);

create policy delivery_satisfaction_read
on erp_supply.delivery_satisfaction for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  )
);

create policy delivery_satisfaction_insert
on erp_supply.delivery_satisfaction for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and recorded_by=erp_private.current_profile_id()
  and (
    erp_private.can_access_module('shipping','update')
    or erp_private.can_access_module('sales','create')
  )
);

grant select,insert,update on erp_supply.logistics_shipments to authenticated;
grant select,insert on erp_supply.logistics_events to authenticated;
grant usage,select on sequence erp_supply.logistics_events_id_seq to authenticated;
grant select,insert on erp_supply.delivery_attempts to authenticated;
grant select,insert on erp_supply.delivery_satisfaction to authenticated;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
) values
  ('aux_logistica','shipping',true,true,true,false,false),
  ('coordinador_logistico','shipping',true,true,true,false,false),
  ('lider_logistica','shipping',true,true,true,false,false),
  ('jefe_logistica','shipping',true,true,true,true,false),
  ('ventas','shipping',true,false,false,false,false),
  ('auditoria','shipping',true,false,false,false,false),
  ('coordinador_logistico','billing',true,false,false,false,false),
  ('lider_logistica','billing',true,false,false,false,false),
  ('jefe_logistica','billing',true,false,false,true,false),
  ('auditoria','billing',true,false,false,false,false),
  ('super_admin','shipping',true,true,true,true,true),
  ('super_admin','billing',true,true,true,true,true)
on conflict(role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

create or replace function erp_private.logistics_lock(p_scope text,p_key text)
returns void
language plpgsql
security invoker
set search_path=pg_catalog,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_key text:=nullif(trim(coalesce(p_key,'')),'');
begin
  if v_org is null or v_key is null then
    raise exception 'Organización e idempotency key son obligatorias' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text||':'||upper(p_scope)||':'||v_key,0));
end;
$$;

create or replace function erp_private.logistics_append_event(
  p_shipment_id uuid,
  p_order_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_payload jsonb,
  p_idempotency_key text
)
returns bigint
language plpgsql
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_id bigint;
begin
  insert into erp_supply.logistics_events(
    organization_id,shipment_id,order_id,event_type,from_status,to_status,
    actor_profile_id,idempotency_key,payload
  ) values(
    erp_private.current_org_id(),p_shipment_id,p_order_id,upper(trim(p_event_type)),
    p_from_status,p_to_status,erp_private.current_profile_id(),trim(p_idempotency_key),
    coalesce(p_payload,'{}'::jsonb)
  )
  on conflict(organization_id,idempotency_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function erp_private.logistics_lock(text,text) from public,anon;
revoke all on function erp_private.logistics_append_event(uuid,uuid,text,text,text,jsonb,text)
from public,anon;
grant execute on function erp_private.logistics_lock(text,text) to authenticated;
grant execute on function erp_private.logistics_append_event(uuid,uuid,text,text,text,jsonb,text)
to authenticated;

commit;
