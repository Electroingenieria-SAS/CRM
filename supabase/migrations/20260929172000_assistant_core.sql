begin;

create table erp_supply.assistant_settings (
  organization_id uuid primary key references erp_supply.organizations(id) on delete cascade,
  cooldown_minutes integer not null default 30 check (cooldown_minutes between 5 and 240),
  leadership_roles text[] not null default array[
    'super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico'
  ]::text[],
  voice_enabled boolean not null default true,
  updated_by uuid references erp_supply.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table erp_supply.assistant_role_alert_policies (
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  role_code text not null references erp_supply.roles(code) on delete cascade,
  inactivity_threshold_minutes integer not null default 20
    check (inactivity_threshold_minutes between 5 and 240),
  inactivity_alerts boolean not null default false,
  delayed_order_alerts boolean not null default true,
  active boolean not null default true,
  updated_by uuid references erp_supply.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id,role_code)
);

create table erp_supply.assistant_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  alert_type text not null check (alert_type in ('ORDER_DELAY','INACTIVITY')),
  dedupe_key text not null,
  target_profile_id uuid references erp_supply.profiles(id) on delete cascade,
  order_id uuid references erp_supply.orders(id) on delete cascade,
  audience_roles text[] not null default '{}',
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  message text not null,
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','RESOLVED')),
  occurrence_count integer not null default 1 check (occurrence_count>0),
  last_notified_at timestamptz,
  acknowledged_by uuid references erp_supply.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,dedupe_key)
);

create index idx_assistant_alerts_visible
on erp_supply.assistant_alerts(organization_id,status,updated_at desc);

create table erp_supply.assistant_rate_windows (
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  profile_id uuid not null references erp_supply.profiles(id) on delete cascade,
  operation text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count>0),
  primary key (organization_id,profile_id,operation,window_start)
);

alter table erp_supply.assistant_settings enable row level security;
alter table erp_supply.assistant_role_alert_policies enable row level security;
alter table erp_supply.assistant_alerts enable row level security;
alter table erp_supply.assistant_rate_windows enable row level security;

create policy assistant_settings_read
on erp_supply.assistant_settings for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('assistant','read')
);

create policy assistant_role_alert_policies_read
on erp_supply.assistant_role_alert_policies for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('assistant','read')
);

create policy assistant_alerts_read
on erp_supply.assistant_alerts for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('assistant','read')
  and (
    target_profile_id is null
    or target_profile_id=erp_private.current_profile_id()
    or audience_roles && erp_private.current_roles()
  )
);

grant select on erp_supply.assistant_settings to authenticated;
grant select on erp_supply.assistant_role_alert_policies to authenticated;
grant select on erp_supply.assistant_alerts to authenticated;
revoke insert,update,delete on erp_supply.assistant_settings from authenticated;
revoke insert,update,delete on erp_supply.assistant_role_alert_policies from authenticated;
revoke insert,update,delete on erp_supply.assistant_alerts from authenticated;
revoke all on erp_supply.assistant_rate_windows from authenticated;

create or replace function erp_private.assistant_rate_limit(
  p_operation text,
  p_limit integer default 30,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_profile uuid:=erp_private.current_profile_id();
  v_operation text:=lower(btrim(coalesce(p_operation,'')));
  v_window timestamptz;
  v_count integer;
begin
  if v_org is null or v_profile is null or not erp_private.can_access_module('assistant','read') then
    raise exception 'PACO no autorizado' using errcode='42501';
  end if;
  if v_operation='' or p_limit not between 1 and 300 or p_window_seconds not between 10 and 3600 then
    raise exception 'Límite inválido' using errcode='22023';
  end if;

  v_window:=to_timestamp(
    floor(extract(epoch from now())/p_window_seconds)*p_window_seconds
  );

  insert into erp_supply.assistant_rate_windows(
    organization_id,profile_id,operation,window_start,request_count
  )
  values(v_org,v_profile,v_operation,v_window,1)
  on conflict (organization_id,profile_id,operation,window_start)
  do update set request_count=erp_supply.assistant_rate_windows.request_count+1
  returning request_count into v_count;

  delete from erp_supply.assistant_rate_windows
  where window_start<now()-interval '2 hours';

  return v_count<=p_limit;
end;
$$;

revoke all on function erp_private.assistant_rate_limit(text,integer,integer) from public,anon;
grant execute on function erp_private.assistant_rate_limit(text,integer,integer) to authenticated;

create or replace function public.erp_x_assistant_rate_limit(
  p_operation text default 'message'
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_allowed boolean;
begin
  v_allowed:=erp_private.assistant_rate_limit(
    p_operation,
    case lower(btrim(coalesce(p_operation,'')))
      when 'activity_create' then 10
      else 30
    end,
    60
  );
  return jsonb_build_object(
    'allowed',v_allowed,
    'retryAfterSeconds',case when v_allowed then 0 else 60 end,
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function erp_private.assistant_refresh_alerts()
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_dashboard jsonb;
  v_alert jsonb;
  v_person jsonb;
  v_settings erp_supply.assistant_settings%rowtype;
  v_current text[]:=array[]::text[];
  v_key text;
  v_target uuid;
  v_threshold integer;
  v_roles text[];
begin
  if v_org is null or not erp_private.can_access_module('assistant','read') then
    raise exception 'PACO no autorizado' using errcode='42501';
  end if;

  insert into erp_supply.assistant_settings(organization_id)
  values(v_org)
  on conflict (organization_id) do nothing;

  select * into v_settings
  from erp_supply.assistant_settings
  where organization_id=v_org;

  v_dashboard:=public.erp_x_analytics_dashboard(
    (now() at time zone 'America/Bogota')::date,
    (now() at time zone 'America/Bogota')::date,
    null,null,null,null,null,null,null
  );

  for v_alert in
    select value from jsonb_array_elements(coalesce(v_dashboard->'alerts','[]'::jsonb))
  loop
    v_key:='ORDER_DELAY:'||(v_alert->>'orderId')||':'||(v_alert->>'stepCode');
    v_current:=array_append(v_current,v_key);

    select current_assignee_id into v_target
    from erp_supply.orders
    where id=(v_alert->>'orderId')::uuid and organization_id=v_org;

    insert into erp_supply.assistant_alerts(
      organization_id,alert_type,dedupe_key,target_profile_id,order_id,audience_roles,
      severity,title,message,metadata
    )
    values(
      v_org,'ORDER_DELAY',v_key,v_target,(v_alert->>'orderId')::uuid,
      v_settings.leadership_roles,
      case when v_alert->>'severity'='critical' then 'critical' else 'warning' end,
      'Pedido requiere atención',
      concat(
        'El pedido ',v_alert->>'orderNumber',' lleva ',
        coalesce(v_alert->>'ageMinutes','0'),' minutos sin avance en ',
        v_alert->>'stepName','.'
      ),
      jsonb_build_object(
        'orderNumber',v_alert->>'orderNumber',
        'stepCode',v_alert->>'stepCode',
        'stepName',v_alert->>'stepName',
        'ageMinutes',v_alert->>'ageMinutes',
        'clientName',v_alert->>'clientName'
      )
    )
    on conflict (organization_id,dedupe_key) do update set
      target_profile_id=excluded.target_profile_id,
      severity=excluded.severity,
      title=excluded.title,
      message=excluded.message,
      occurrence_count=erp_supply.assistant_alerts.occurrence_count+1,
      metadata=excluded.metadata,
      updated_at=now(),
      status=case
        when erp_supply.assistant_alerts.status='ACKNOWLEDGED'
          then 'ACKNOWLEDGED'
        else 'OPEN'
      end;
  end loop;

  for v_person in
    select value
    from jsonb_array_elements(coalesce(v_dashboard->'workforce'->'people','[]'::jsonb))
  loop
    if v_person->>'occupancy'<>'AVAILABLE'
       or (v_person->>'inactivityMinutes') is null
       or coalesce((v_person->>'excludedFromOccupancyMetrics')::boolean,false) then
      continue;
    end if;

    v_target:=(v_person->>'profileId')::uuid;
    select coalesce(array_agg(pr.role_code),array[]::text[])
    into v_roles
    from erp_supply.profile_roles pr
    where pr.profile_id=v_target;

    select min(p.inactivity_threshold_minutes)
    into v_threshold
    from erp_supply.assistant_role_alert_policies p
    where p.organization_id=v_org
      and p.active
      and p.inactivity_alerts
      and p.role_code=any(v_roles);

    if v_threshold is null or (v_person->>'inactivityMinutes')::numeric<=v_threshold then
      continue;
    end if;

    v_key:='INACTIVITY:'||v_target::text;
    v_current:=array_append(v_current,v_key);

    insert into erp_supply.assistant_alerts(
      organization_id,alert_type,dedupe_key,target_profile_id,audience_roles,
      severity,title,message,metadata
    )
    values(
      v_org,'INACTIVITY',v_key,v_target,v_settings.leadership_roles,
      'warning','Inactividad operativa',
      concat(
        v_person->>'name',' lleva ',round((v_person->>'inactivityMinutes')::numeric),
        ' minutos disponible sin actividad.'
      ),
      jsonb_build_object(
        'profileId',v_target,
        'name',v_person->>'name',
        'inactivityMinutes',v_person->>'inactivityMinutes',
        'thresholdMinutes',v_threshold
      )
    )
    on conflict (organization_id,dedupe_key) do update set
      message=excluded.message,
      occurrence_count=erp_supply.assistant_alerts.occurrence_count+1,
      metadata=excluded.metadata,
      updated_at=now(),
      status=case
        when erp_supply.assistant_alerts.status='ACKNOWLEDGED'
          then 'ACKNOWLEDGED'
        else 'OPEN'
      end;
  end loop;

  update erp_supply.assistant_alerts
  set status='RESOLVED',updated_at=now()
  where organization_id=v_org
    and alert_type in('ORDER_DELAY','INACTIVITY')
    and status<>'RESOLVED'
    and not (dedupe_key=any(v_current));
end;
$$;

revoke all on function erp_private.assistant_refresh_alerts() from public,anon,authenticated;

create or replace function public.erp_x_assistant_alerts(
  p_refresh boolean default true,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_profile uuid:=erp_private.current_profile_id();
  v_roles text[]:=erp_private.current_roles();
  v_limit integer:=least(greatest(coalesce(p_limit,20),1),50);
  v_cooldown integer;
  v_items jsonb;
begin
  if v_org is null or v_profile is null or not erp_private.can_access_module('assistant','read') then
    raise exception 'PACO no autorizado' using errcode='42501';
  end if;

  if p_refresh then
    perform erp_private.assistant_refresh_alerts();
  end if;

  select coalesce(cooldown_minutes,30) into v_cooldown
  from erp_supply.assistant_settings where organization_id=v_org;

  with visible as(
    select a.*
    from erp_supply.assistant_alerts a
    where a.organization_id=v_org
      and a.status in('OPEN','ACKNOWLEDGED')
      and (
        a.target_profile_id is null
        or a.target_profile_id=v_profile
        or a.audience_roles && v_roles
      )
    order by
      case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
      a.updated_at desc
    limit v_limit
  ),
  notify as(
    update erp_supply.assistant_alerts a
    set last_notified_at=now()
    from visible v
    where a.id=v.id
      and a.status='OPEN'
      and (
        a.last_notified_at is null
        or a.last_notified_at<=now()-make_interval(mins=>v_cooldown)
      )
    returning a.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,
    'type',v.alert_type,
    'severity',v.severity,
    'title',v.title,
    'message',v.message,
    'status',v.status,
    'targetProfileId',v.target_profile_id,
    'orderId',v.order_id,
    'metadata',v.metadata,
    'shouldNotify',exists(select 1 from notify n where n.id=v.id),
    'updatedAt',v.updated_at
  ) order by
    case v.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
    v.updated_at desc),'[]'::jsonb)
  into v_items
  from visible v;

  return jsonb_build_object('items',v_items,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_assistant_ack_alert(p_alert_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_profile uuid:=erp_private.current_profile_id();
  v_roles text[]:=erp_private.current_roles();
begin
  if v_org is null or v_profile is null or not erp_private.can_access_module('assistant','update') then
    raise exception 'PACO no autorizado' using errcode='42501';
  end if;

  update erp_supply.assistant_alerts
  set status='ACKNOWLEDGED',
      acknowledged_by=v_profile,
      acknowledged_at=now(),
      updated_at=now()
  where id=p_alert_id
    and organization_id=v_org
    and status='OPEN'
    and (
      target_profile_id is null
      or target_profile_id=v_profile
      or audience_roles && v_roles
    );

  if not found then
    raise exception 'Alerta no disponible' using errcode='P0002';
  end if;

  perform erp_private.audit_event(
    'assistant','ALERT_ACKNOWLEDGED','assistant_alert',p_alert_id::text,'ACKNOWLEDGED',
    '{}'::jsonb
  );

  return jsonb_build_object('success',true,'alertId',p_alert_id,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_assistant_record_action(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_result text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_action text:=upper(btrim(coalesce(p_action,'')));
begin
  if not erp_private.can_access_module('assistant','read') then
    raise exception 'PACO no autorizado' using errcode='42501';
  end if;
  if v_action='' then
    raise exception 'Acción PACO inválida' using errcode='22023';
  end if;

  perform erp_private.audit_event(
    'assistant',v_action,btrim(p_resource_type),p_resource_id,upper(btrim(p_result)),
    erp_private.audit_safe_metadata(coalesce(p_metadata,'{}'::jsonb))
      || jsonb_build_object('channel','PACO')
  );

  return jsonb_build_object('success',true,'contractVersion','1.0.0');
end;
$$;

revoke all on function public.erp_x_assistant_rate_limit(text) from public,anon;
revoke all on function public.erp_x_assistant_alerts(boolean,integer) from public,anon;
revoke all on function public.erp_x_assistant_ack_alert(uuid) from public,anon;
revoke all on function public.erp_x_assistant_record_action(text,text,text,text,jsonb) from public,anon;

grant execute on function public.erp_x_assistant_rate_limit(text) to authenticated;
grant execute on function public.erp_x_assistant_alerts(boolean,integer) to authenticated;
grant execute on function public.erp_x_assistant_ack_alert(uuid) to authenticated;
grant execute on function public.erp_x_assistant_record_action(text,text,text,text,jsonb) to authenticated;

commit;
