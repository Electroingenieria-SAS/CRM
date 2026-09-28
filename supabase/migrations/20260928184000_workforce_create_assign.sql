begin;

create or replace function public.erp_x_workforce_create_activity(
  p_payload jsonb,
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
  v_catalog erp_supply.workforce_activity_catalog%rowtype;
  v_assignee uuid;
  v_activity uuid;
  v_existing uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_order uuid;
  v_task uuid;
  v_source text;
begin
  if not erp_private.can_access_module('workforce','create') then
    raise exception 'No autorizado para crear actividades' using errcode='42501';
  end if;

  if nullif(trim(p_idempotency_key),'') is null then
    raise exception 'La clave de idempotencia es obligatoria' using errcode='22023';
  end if;

  perform erp_private.workforce_lock_idempotency(v_org,p_idempotency_key);

  select (ev.payload->>'activityId')::uuid into v_existing
  from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org
    and ev.idempotency_key=trim(p_idempotency_key)
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'success',true,'idempotent',true,'activityId',v_existing,'contractVersion','1.0.0'
    );
  end if;

  select * into v_catalog
  from erp_supply.workforce_activity_catalog c
  where c.id=(p_payload->>'catalogId')::uuid
    and c.organization_id=v_org
    and c.active;

  if not found then
    raise exception 'Actividad de catálogo inválida' using errcode='22023';
  end if;

  v_start:=(p_payload->>'plannedStart')::timestamptz;
  v_end:=(p_payload->>'plannedEnd')::timestamptz;

  if v_end<=v_start then
    raise exception 'La hora final debe ser posterior a la inicial' using errcode='22023';
  end if;

  if erp_private.workforce_business_seconds(v_org,v_start,v_end)
     <> extract(epoch from(v_end-v_start))::bigint then
    raise exception 'La actividad debe quedar completamente dentro de la jornada laboral' using errcode='22023';
  end if;

  if coalesce((p_payload->>'autoAssign')::boolean,false) then
    if not erp_private.workforce_can_manage() then
      raise exception 'Solo un planificador autorizado puede autoasignar' using errcode='42501';
    end if;
    v_assignee:=erp_private.workforce_pick_assignee(v_catalog.id,v_start,v_end);
    if v_assignee is null then
      raise exception 'No existe una persona disponible para ese horario' using errcode='P0001';
    end if;
  elsif nullif(p_payload->>'assigneeProfileId','') is not null then
    v_assignee:=(p_payload->>'assigneeProfileId')::uuid;
  else
    v_assignee:=v_actor;
  end if;

  if not erp_private.workforce_can_manage_profile(v_assignee) then
    raise exception 'No autorizado para asignar a esa persona' using errcode='42501';
  end if;

  if cardinality(v_catalog.allowed_roles)>0 and not exists(
    select 1 from erp_supply.profile_roles pr
    where pr.profile_id=v_assignee
      and pr.role_code=any(v_catalog.allowed_roles)
  ) then
    raise exception 'La actividad no está habilitada para el rol de esa persona' using errcode='42501';
  end if;

  v_order:=nullif(p_payload->>'orderId','')::uuid;
  v_task:=nullif(p_payload->>'orderTaskId','')::uuid;

  if v_task is not null and not exists(
    select 1 from erp_supply.order_tasks t
    where t.id=v_task and t.order_id=v_order
  ) then
    raise exception 'La tarea de pedido no pertenece al pedido indicado' using errcode='23503';
  end if;

  v_source:=case
    when v_assignee<>v_actor then 'PLANNED'
    else 'MANUAL'
  end;

  insert into erp_supply.workforce_activities(
    organization_id,catalog_id,assignee_profile_id,created_by,assigned_by,
    title,description,status,source,planned_start,planned_end,order_id,order_task_id,metadata
  )
  values(
    v_org,v_catalog.id,v_assignee,v_actor,v_actor,
    coalesce(nullif(trim(p_payload->>'title'),''),v_catalog.name),
    nullif(trim(p_payload->>'description'),''),
    'PLANNED',v_source,v_start,v_end,v_order,v_task,
    case when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
      then coalesce(p_payload->'metadata','{}'::jsonb) else '{}'::jsonb end
  )
  returning id into v_activity;

  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,to_status,idempotency_key,payload
  )
  values(
    v_org,v_activity,v_actor,'ACTIVITY_CREATED','PLANNED',trim(p_idempotency_key),
    jsonb_build_object(
      'activityId',v_activity,
      'assigneeProfileId',v_assignee,
      'source',v_source
    )
  );

  return jsonb_build_object(
    'success',true,
    'idempotent',false,
    'activityId',v_activity,
    'status','PLANNED',
    'version',1,
    'assigneeProfileId',v_assignee,
    'contractVersion','1.0.0'
  );
exception
  when exclusion_violation then
    raise exception 'La persona ya tiene una actividad incompatible en ese horario' using errcode='23P01';
  when invalid_text_representation then
    raise exception 'Uno de los identificadores o campos de fecha tiene formato inválido' using errcode='22023';
end;
$$;

create or replace function public.erp_x_workforce_assign_activity(
  p_activity_id uuid,
  p_assignee_profile_id uuid,
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
  v_catalog erp_supply.workforce_activity_catalog%rowtype;
  v_target uuid;
  v_event jsonb;
begin
  if not erp_private.workforce_can_manage() then
    raise exception 'No autorizado para asignar actividades' using errcode='42501';
  end if;

  if nullif(trim(p_idempotency_key),'') is null then
    raise exception 'La clave de idempotencia es obligatoria' using errcode='22023';
  end if;

  perform erp_private.workforce_lock_idempotency(v_org,p_idempotency_key);

  select ev.payload into v_event
  from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key)
  limit 1;

  if v_event is not null then
    return jsonb_build_object(
      'success',true,'idempotent',true,
      'activityId',p_activity_id,
      'assigneeProfileId',v_event->>'assigneeProfileId',
      'version',(v_event->>'version')::integer,
      'contractVersion','1.0.0'
    );
  end if;

  select * into v_activity
  from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org
  for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if v_activity.status<>'PLANNED' then
    raise exception 'Solo una actividad planificada puede reasignarse' using errcode='22023';
  end if;
  if v_activity.version<>p_expected_version then
    raise exception 'La actividad cambió; actualiza la vista antes de continuar' using errcode='40001';
  end if;

  select * into v_catalog
  from erp_supply.workforce_activity_catalog c where c.id=v_activity.catalog_id;

  v_target:=coalesce(
    p_assignee_profile_id,
    erp_private.workforce_pick_assignee(v_activity.catalog_id,v_activity.planned_start,v_activity.planned_end)
  );

  if v_target is null then
    raise exception 'No existe una persona disponible para ese horario' using errcode='P0001';
  end if;

  if not exists(
    select 1 from erp_supply.profiles p
    where p.id=v_target and p.organization_id=v_org and p.active and not p.is_system
  ) then
    raise exception 'Responsable inválido' using errcode='22023';
  end if;

  if cardinality(v_catalog.allowed_roles)>0 and not exists(
    select 1 from erp_supply.profile_roles pr
    where pr.profile_id=v_target and pr.role_code=any(v_catalog.allowed_roles)
  ) then
    raise exception 'La actividad no está habilitada para el rol de esa persona' using errcode='42501';
  end if;

  update erp_supply.workforce_activities
  set assignee_profile_id=v_target,
      assigned_by=v_actor,
      version=version+1,
      updated_at=now()
  where id=p_activity_id
  returning * into v_activity;

  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  )
  values(
    v_org,p_activity_id,v_actor,'ACTIVITY_ASSIGNED','PLANNED','PLANNED',
    trim(p_idempotency_key),
    jsonb_build_object(
      'activityId',p_activity_id,
      'assigneeProfileId',v_target,
      'version',v_activity.version
    )
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'activityId',p_activity_id,
    'assigneeProfileId',v_target,'version',v_activity.version,'contractVersion','1.0.0'
  );
exception
  when exclusion_violation then
    raise exception 'La persona ya tiene una actividad incompatible en ese horario' using errcode='23P01';
end;
$$;

revoke all on function public.erp_x_workforce_create_activity(jsonb,text) from public,anon;
revoke all on function public.erp_x_workforce_assign_activity(uuid,uuid,integer,text) from public,anon;

grant execute on function public.erp_x_workforce_create_activity(jsonb,text) to authenticated;
grant execute on function public.erp_x_workforce_assign_activity(uuid,uuid,integer,text) to authenticated;

commit;
