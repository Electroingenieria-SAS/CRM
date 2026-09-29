begin;

create or replace function public.erp_x_workforce_create_from_order_event(
  p_event jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_catalog erp_supply.workforce_activity_catalog%rowtype;
  v_assignee uuid;
  v_moment timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_minutes integer;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Usuario sin perfil operativo activo' using errcode='42501';
  end if;

  select * into v_catalog
  from erp_supply.workforce_activity_catalog c
  where c.organization_id=v_org
    and c.code=nullif(trim(p_event->>'workforceCatalogCode'),'')
    and c.active;

  if not found then
    raise exception 'Catálogo Workforce no encontrado para el evento de Orders' using errcode='22023';
  end if;

  v_assignee:=coalesce(nullif(p_event->>'assigneeProfileId','')::uuid,v_actor);
  v_moment:=coalesce(nullif(p_event->>'occurredAt','')::timestamptz,now());
  v_minutes:=coalesce(v_catalog.standard_minutes,30);

  with ctx as(
    select coalesce(o.timezone,'America/Bogota') timezone
    from erp_supply.organizations o
    where o.id=v_org
  ),
  days as(
    select d::date work_date,ctx.timezone
    from ctx,
    lateral generate_series(
      (v_moment at time zone ctx.timezone)::date,
      (v_moment at time zone ctx.timezone)::date+14,
      interval '1 day'
    ) d
  ),
  slots as(
    select
      (d.work_date+s.start_time) at time zone d.timezone slot_start,
      (d.work_date+s.end_time) at time zone d.timezone slot_end
    from days d
    join erp_supply.workforce_schedule_segments s
      on s.organization_id=v_org
     and s.iso_weekday=extract(isodow from d.work_date)::smallint
     and s.active
    where not exists(
      select 1
      from erp_supply.workforce_holidays h
      where h.organization_id=v_org
        and h.holiday_date=d.work_date
    )
  ),
  candidates as(
    select
      greatest(slot_start,v_moment) candidate_start,
      slot_end
    from slots
    where slot_end>v_moment
  )
  select candidate_start,candidate_start+make_interval(mins=>v_minutes)
  into v_start,v_end
  from candidates
  where candidate_start+make_interval(mins=>v_minutes)<=slot_end
  order by candidate_start
  limit 1;

  if v_start is null or v_end is null then
    raise exception 'No existe una ventana laboral disponible para planificar la actividad' using errcode='22023';
  end if;

  v_result:=public.erp_x_workforce_create_activity(
    jsonb_build_object(
      'catalogId',v_catalog.id,
      'assigneeProfileId',v_assignee,
      'title',coalesce(nullif(trim(p_event->>'activityTitle'),''),v_catalog.name),
      'description','Actividad generada automáticamente desde el workflow del pedido.',
      'plannedStart',v_start,
      'plannedEnd',v_end,
      'orderId',nullif(p_event->>'orderId',''),
      'orderTaskId',nullif(p_event->>'orderTaskId',''),
      'metadata',jsonb_build_object(
        'source','ORDER_EVENT',
        'integration','orders-workforce',
        'contractVersion',coalesce(p_event->>'contractVersion','1.0.0'),
        'integrationEvent',p_event->>'integrationEvent',
        'sellerProfileId',p_event->>'sellerProfileId',
        'orderEventId',p_event->>'orderEventId'
      )
    ),
    p_idempotency_key
  );

  update erp_supply.workforce_activities
  set source='ORDER_EVENT',
      metadata=metadata||jsonb_build_object(
        'source','ORDER_EVENT',
        'integration','orders-workforce'
      ),
      updated_at=now()
  where id=(v_result->>'activityId')::uuid
    and organization_id=v_org;

  return v_result||jsonb_build_object(
    'source','ORDER_EVENT',
    'plannedStart',v_start,
    'plannedEnd',v_end
  );
end;
$$;

create or replace function public.erp_x_workforce_reassign_from_order_event(
  p_activity_id uuid,
  p_event jsonb,
  p_event_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_target uuid:=nullif(p_event->>'assigneeProfileId','')::uuid;
  v_previous_status text;
  v_block_reason text;
  v_cancel jsonb;
  v_created jsonb;
  v_started jsonb;
  v_result jsonb;
begin
  if v_target is null then
    raise exception 'La reasignación requiere un responsable' using errcode='22023';
  end if;

  select * into v_activity
  from erp_supply.workforce_activities a
  where a.id=p_activity_id
    and a.organization_id=v_org;

  if not found then
    raise exception 'Actividad Workforce no encontrada para reasignar' using errcode='P0002';
  end if;

  if v_activity.assignee_profile_id=v_target then
    return jsonb_build_object(
      'success',true,'idempotent',true,'activityId',v_activity.id,
      'status',v_activity.status,'version',v_activity.version,
      'assigneeProfileId',v_target,'contractVersion','1.0.0'
    );
  end if;

  if v_activity.status='PLANNED' then
    return public.erp_x_workforce_assign_activity(
      p_activity_id,v_target,v_activity.version,p_event_key
    );
  end if;

  if v_activity.status not in('IN_PROGRESS','BLOCKED') then
    raise exception 'La actividad ya está en un estado final y no puede reasignarse' using errcode='22023';
  end if;

  v_previous_status:=v_activity.status;
  v_block_reason:=v_activity.block_reason;

  v_cancel:=public.erp_x_workforce_cancel_activity(
    p_activity_id,
    'Reasignación operativa de la tarea de pedido',
    v_activity.version,
    p_event_key||':release'
  );

  v_created:=public.erp_x_workforce_create_from_order_event(
    p_event,
    p_event_key||':continuation'
  );

  v_started:=public.erp_x_workforce_start_activity(
    (v_created->>'activityId')::uuid,
    coalesce((v_created->>'version')::integer,1),
    p_event_key||':continuation:start'
  );

  if v_previous_status='BLOCKED' then
    v_result:=public.erp_x_workforce_block_activity(
      (v_created->>'activityId')::uuid,
      coalesce(nullif(trim(v_block_reason),''),'Actividad reasignada mientras estaba bloqueada'),
      (v_started->>'version')::integer,
      p_event_key||':continuation:block'
    );
  else
    v_result:=v_started;
  end if;

  return v_result||jsonb_build_object(
    'reassigned',true,
    'previousActivityId',p_activity_id,
    'previousAssigneeProfileId',v_activity.assignee_profile_id,
    'assigneeProfileId',v_target
  );
end;
$$;

create or replace function public.erp_x_order_workforce_completion_readiness(
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_activity erp_supply.workforce_activities%rowtype;
  v_evidence_complete boolean;
begin
  select a.* into v_activity
  from erp_supply.order_workforce_outbox x
  join erp_supply.workforce_activities a on a.id=x.workforce_activity_id
  where x.organization_id=erp_private.current_org_id()
    and x.order_id=p_order_id
    and x.status='PROCESSED'
    and x.workforce_activity_id is not null
  order by x.processed_at desc nulls last,x.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ready',true,'mapped',false,'contractVersion','1.0.0'
    );
  end if;

  if v_activity.status='COMPLETED' then
    return jsonb_build_object(
      'ready',true,'mapped',true,'activityId',v_activity.id,
      'status',v_activity.status,'evidenceComplete',true,'contractVersion','1.0.0'
    );
  end if;

  v_evidence_complete:=erp_private.workforce_evidence_complete(v_activity.id);

  return jsonb_build_object(
    'ready',v_activity.status='IN_PROGRESS' and v_evidence_complete,
    'mapped',true,
    'activityId',v_activity.id,
    'status',v_activity.status,
    'evidenceComplete',v_evidence_complete,
    'reason',case
      when v_activity.status<>'IN_PROGRESS' then 'WORKFORCE_ACTIVITY_NOT_IN_PROGRESS'
      when not v_evidence_complete then 'WORKFORCE_EVIDENCE_REQUIRED'
      else null
    end,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_workforce_create_from_order_event(jsonb,text) from public,anon;
revoke all on function public.erp_x_workforce_reassign_from_order_event(uuid,jsonb,text) from public,anon;
revoke all on function public.erp_x_order_workforce_completion_readiness(uuid) from public,anon;

grant execute on function public.erp_x_workforce_create_from_order_event(jsonb,text) to authenticated;
grant execute on function public.erp_x_workforce_reassign_from_order_event(uuid,jsonb,text) to authenticated;
grant execute on function public.erp_x_order_workforce_completion_readiness(uuid) to authenticated;

commit;
