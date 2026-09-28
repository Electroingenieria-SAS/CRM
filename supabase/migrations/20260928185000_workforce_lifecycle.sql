begin;

create or replace function public.erp_x_workforce_start_activity(
  p_activity_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_event jsonb;
begin
  select ev.payload into v_event
  from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key)
  limit 1;

  if v_event is not null then
    return v_event || jsonb_build_object('success',true,'idempotent',true,'contractVersion','1.0.0');
  end if;

  select * into v_activity
  from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org
  for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if not erp_private.workforce_can_manage_profile(v_activity.assignee_profile_id) then
    raise exception 'No autorizado para iniciar esta actividad' using errcode='42501';
  end if;
  if v_activity.status<>'PLANNED' then
    raise exception 'Solo una actividad planificada puede iniciarse' using errcode='22023';
  end if;
  if v_activity.version<>p_expected_version then
    raise exception 'La actividad cambió; actualiza la vista antes de continuar' using errcode='40001';
  end if;
  if not erp_private.workforce_is_working_instant(v_org,now()) then
    raise exception 'No puedes iniciar una actividad fuera de la jornada laboral' using errcode='22023';
  end if;
  if exists(
    select 1 from erp_supply.workforce_activities other
    where other.organization_id=v_org
      and other.assignee_profile_id=v_activity.assignee_profile_id
      and other.id<>p_activity_id
      and other.status in('IN_PROGRESS','BLOCKED')
  ) then
    raise exception 'La persona ya tiene otra actividad activa' using errcode='23P01';
  end if;

  update erp_supply.workforce_activities
  set status='IN_PROGRESS',actual_start=now(),version=version+1,updated_at=now()
  where id=p_activity_id
  returning * into v_activity;

  v_event:=jsonb_build_object(
    'activityId',p_activity_id,'status','IN_PROGRESS','version',v_activity.version
  );

  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  ) values(
    v_org,p_activity_id,v_actor,'ACTIVITY_STARTED','PLANNED','IN_PROGRESS',
    trim(p_idempotency_key),v_event
  );

  return v_event || jsonb_build_object('success',true,'idempotent',false,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_workforce_block_activity(
  p_activity_id uuid,
  p_reason text,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_event jsonb;
  v_from_status text;
begin
  select ev.payload into v_event from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key) limit 1;
  if v_event is not null then
    return v_event || jsonb_build_object('success',true,'idempotent',true,'contractVersion','1.0.0');
  end if;

  if nullif(trim(p_reason),'') is null then
    raise exception 'Debes indicar el motivo del bloqueo' using errcode='22023';
  end if;

  select * into v_activity from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if not erp_private.workforce_can_manage_profile(v_activity.assignee_profile_id) then
    raise exception 'No autorizado para bloquear esta actividad' using errcode='42501';
  end if;
  if v_activity.status<>'IN_PROGRESS' then
    raise exception 'Solo una actividad en curso puede bloquearse' using errcode='22023';
  end if;
  if v_activity.version<>p_expected_version then
    raise exception 'La actividad cambió; actualiza la vista antes de continuar' using errcode='40001';
  end if;

  update erp_supply.workforce_activities
  set status='BLOCKED',block_reason=trim(p_reason),version=version+1,updated_at=now()
  where id=p_activity_id returning * into v_activity;

  v_event:=jsonb_build_object(
    'activityId',p_activity_id,'status','BLOCKED','version',v_activity.version,'reason',trim(p_reason)
  );
  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  ) values(
    v_org,p_activity_id,v_actor,'ACTIVITY_BLOCKED','IN_PROGRESS','BLOCKED',
    trim(p_idempotency_key),v_event
  );

  return v_event || jsonb_build_object('success',true,'idempotent',false,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_workforce_resume_activity(
  p_activity_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_event jsonb;
begin
  select ev.payload into v_event from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key) limit 1;
  if v_event is not null then
    return v_event || jsonb_build_object('success',true,'idempotent',true,'contractVersion','1.0.0');
  end if;

  select * into v_activity from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if not erp_private.workforce_can_manage_profile(v_activity.assignee_profile_id) then
    raise exception 'No autorizado para reanudar esta actividad' using errcode='42501';
  end if;
  if v_activity.status<>'BLOCKED' then
    raise exception 'Solo una actividad bloqueada puede reanudarse' using errcode='22023';
  end if;
  if v_activity.version<>p_expected_version then
    raise exception 'La actividad cambió; actualiza la vista antes de continuar' using errcode='40001';
  end if;
  if not erp_private.workforce_is_working_instant(v_org,now()) then
    raise exception 'No puedes reanudar una actividad fuera de la jornada laboral' using errcode='22023';
  end if;

  update erp_supply.workforce_activities
  set status='IN_PROGRESS',block_reason=null,version=version+1,updated_at=now()
  where id=p_activity_id returning * into v_activity;

  v_event:=jsonb_build_object(
    'activityId',p_activity_id,'status','IN_PROGRESS','version',v_activity.version
  );
  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  ) values(
    v_org,p_activity_id,v_actor,'ACTIVITY_RESUMED','BLOCKED','IN_PROGRESS',
    trim(p_idempotency_key),v_event
  );

  return v_event || jsonb_build_object('success',true,'idempotent',false,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_workforce_complete_activity(
  p_activity_id uuid,
  p_result_note text,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_event jsonb;
  v_business_seconds bigint;
begin
  select ev.payload into v_event from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key) limit 1;
  if v_event is not null then
    return v_event || jsonb_build_object('success',true,'idempotent',true,'contractVersion','1.0.0');
  end if;

  select * into v_activity from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if not erp_private.workforce_can_manage_profile(v_activity.assignee_profile_id) then
    raise exception 'No autorizado para finalizar esta actividad' using errcode='42501';
  end if;
  if v_activity.status<>'IN_PROGRESS' then
    raise exception 'Solo una actividad en curso puede finalizarse' using errcode='22023';
  end if;
  if v_activity.version<>p_expected_version then
    raise exception 'La actividad cambió; actualiza la vista antes de continuar' using errcode='40001';
  end if;
  if not erp_private.workforce_evidence_complete(p_activity_id) then
    raise exception 'Falta la evidencia requerida para finalizar la actividad' using errcode='23514';
  end if;

  v_business_seconds:=erp_private.workforce_business_seconds(
    v_org,v_activity.actual_start,now()
  );

  update erp_supply.workforce_activities
  set status='COMPLETED',
      actual_end=now(),
      result_note=nullif(trim(p_result_note),''),
      version=version+1,
      updated_at=now()
  where id=p_activity_id
  returning * into v_activity;

  v_event:=jsonb_build_object(
    'activityId',p_activity_id,
    'status','COMPLETED',
    'version',v_activity.version,
    'businessSeconds',v_business_seconds,
    'timeSignal',case when v_business_seconds>3600 then 'OVER_60_MINUTES' else 'NORMAL' end
  );

  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  ) values(
    v_org,p_activity_id,v_actor,'ACTIVITY_COMPLETED','IN_PROGRESS','COMPLETED',
    trim(p_idempotency_key),v_event
  );

  return v_event || jsonb_build_object('success',true,'idempotent',false,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_workforce_cancel_activity(
  p_activity_id uuid,
  p_reason text,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_event jsonb;
begin
  select ev.payload into v_event from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key) limit 1;
  if v_event is not null then
    return v_event || jsonb_build_object('success',true,'idempotent',true,'contractVersion','1.0.0');
  end if;

  if nullif(trim(p_reason),'') is null then
    raise exception 'Debes indicar el motivo de cancelación' using errcode='22023';
  end if;

  select * into v_activity from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if not erp_private.workforce_can_manage_profile(v_activity.assignee_profile_id) then
    raise exception 'No autorizado para cancelar esta actividad' using errcode='42501';
  end if;
  if v_activity.status in('COMPLETED','CANCELLED') then
    raise exception 'La actividad ya se encuentra en un estado final' using errcode='22023';
  end if;
  if v_activity.version<>p_expected_version then
    raise exception 'La actividad cambió; actualiza la vista antes de continuar' using errcode='40001';
  end if;

  v_from_status:=v_activity.status;

  update erp_supply.workforce_activities
  set status='CANCELLED',
      actual_end=case when actual_start is not null then now() else null end,
      cancelled_at=now(),
      result_note=trim(p_reason),
      block_reason=null,
      version=version+1,
      updated_at=now()
  where id=p_activity_id
  returning * into v_activity;

  v_event:=jsonb_build_object(
    'activityId',p_activity_id,'status','CANCELLED','version',v_activity.version,'reason',trim(p_reason)
  );
  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  ) values(
    v_org,p_activity_id,v_actor,'ACTIVITY_CANCELLED',v_from_status,'CANCELLED',
    trim(p_idempotency_key),v_event
  );

  return v_event || jsonb_build_object('success',true,'idempotent',false,'contractVersion','1.0.0');
end;
$$;

revoke all on function public.erp_x_workforce_start_activity(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_workforce_block_activity(uuid,text,integer,text) from public,anon;
revoke all on function public.erp_x_workforce_resume_activity(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_workforce_complete_activity(uuid,text,integer,text) from public,anon;
revoke all on function public.erp_x_workforce_cancel_activity(uuid,text,integer,text) from public,anon;

grant execute on function public.erp_x_workforce_start_activity(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_workforce_block_activity(uuid,text,integer,text) to authenticated;
grant execute on function public.erp_x_workforce_resume_activity(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_workforce_complete_activity(uuid,text,integer,text) to authenticated;
grant execute on function public.erp_x_workforce_cancel_activity(uuid,text,integer,text) to authenticated;

commit;
