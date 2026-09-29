begin;

create table erp_supply.observability_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  profile_id uuid references erp_supply.profiles(id) on delete set null,
  level text not null check (level in ('WARN','ERROR')),
  event text not null check (length(btrim(event)) between 1 and 120),
  module text,
  correlation_id text,
  duration_ms integer check (duration_ms is null or duration_ms>=0),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    context::text !~* '"(password|passwd|token|access_token|refresh_token|service_role|authorization|jwt|secret|email|phone|address)"[[:space:]]*:'
  )
);

create index idx_observability_events_org_time
on erp_supply.observability_events(organization_id,created_at desc);

create index idx_observability_events_org_level
on erp_supply.observability_events(organization_id,level,created_at desc);

alter table erp_supply.observability_events enable row level security;

create policy observability_events_read
on erp_supply.observability_events
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('admin','read')
    or erp_private.can_access_module('audit','read')
  )
);

grant select on erp_supply.observability_events to authenticated;
revoke insert,update,delete on erp_supply.observability_events from authenticated;

create or replace function erp_private.observability_rate_limit()
returns boolean
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_profile uuid:=erp_private.current_profile_id();
  v_count integer;
begin
  if v_org is null or v_profile is null then
    return false;
  end if;

  select count(*)::integer into v_count
  from erp_supply.observability_events
  where organization_id=v_org
    and profile_id=v_profile
    and created_at>=now()-interval '1 minute';

  return v_count<30;
end;
$$;

revoke all on function erp_private.observability_rate_limit() from public,anon;
grant execute on function erp_private.observability_rate_limit() to authenticated;

create or replace function public.erp_x_observability_record(
  p_level text,
  p_event text,
  p_module text default null,
  p_correlation_id text default null,
  p_duration_ms integer default null,
  p_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_profile uuid:=erp_private.current_profile_id();
  v_level text:=upper(btrim(coalesce(p_level,'')));
  v_event text:=btrim(coalesce(p_event,''));
  v_context jsonb:=erp_private.audit_safe_metadata(coalesce(p_context,'{}'::jsonb))
    - 'email'
    - 'phone'
    - 'address';
begin
  if v_org is null or v_profile is null then
    raise exception 'Sesión inválida para telemetría' using errcode='42501';
  end if;
  if v_level not in('WARN','ERROR') or v_event='' or length(v_event)>120 then
    raise exception 'Evento de telemetría inválido' using errcode='22023';
  end if;
  if not erp_private.observability_rate_limit() then
    return jsonb_build_object('accepted',false,'reason','RATE_LIMIT','contractVersion','1.0.0');
  end if;

  insert into erp_supply.observability_events(
    organization_id,profile_id,level,event,module,correlation_id,duration_ms,context
  )
  values(
    v_org,v_profile,v_level,v_event,
    nullif(btrim(coalesce(p_module,'')),''),
    nullif(btrim(coalesce(p_correlation_id,'')),''),
    p_duration_ms,
    v_context
  );

  return jsonb_build_object('accepted',true,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_release_health()
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_workforce jsonb;
begin
  if v_org is null or not (
    erp_private.can_access_module('admin','read')
    or erp_private.can_access_module('audit','read')
  ) then
    raise exception 'No autorizado para consultar salud del release' using errcode='42501';
  end if;

  v_workforce:=public.erp_x_order_workforce_health();

  return jsonb_build_object(
    'errors24h',(
      select count(*)::integer
      from erp_supply.observability_events
      where organization_id=v_org
        and level='ERROR'
        and created_at>=now()-interval '24 hours'
    ),
    'warnings24h',(
      select count(*)::integer
      from erp_supply.observability_events
      where organization_id=v_org
        and level='WARN'
        and created_at>=now()-interval '24 hours'
    ),
    'slowOperations24h',(
      select count(*)::integer
      from erp_supply.observability_events
      where organization_id=v_org
        and duration_ms>=2000
        and created_at>=now()-interval '24 hours'
    ),
    'imports',jsonb_build_object(
      'failed24h',(
        select count(*)::integer
        from erp_supply.analytics_import_batches
        where organization_id=v_org
          and status='FAILED'
          and created_at>=now()-interval '24 hours'
      ),
      'applying',(
        select count(*)::integer
        from erp_supply.analytics_import_batches
        where organization_id=v_org
          and status='APPLYING'
      )
    ),
    'orderWorkforce',v_workforce->'summary',
    'oldestOrderWorkforcePendingAt',v_workforce->'oldestPendingAt',
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_observability_record(
  text,text,text,text,integer,jsonb
) from public,anon;
revoke all on function public.erp_x_release_health() from public,anon;

grant execute on function public.erp_x_observability_record(
  text,text,text,text,integer,jsonb
) to authenticated;
grant execute on function public.erp_x_release_health() to authenticated;

commit;
