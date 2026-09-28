begin;

create or replace function public.erp_x_claim_order_task(
  p_order_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
begin
  if v_actor is null then raise exception 'Usuario sin perfil operativo activo' using errcode='42501'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'Clave de idempotencia requerida'; end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;

  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'version',v_order.version);
  end if;
  if v_order.version<>p_expected_version then
    raise exception 'El pedido cambió mientras estaba abierto. Actualiza la pantalla.' using errcode='40001';
  end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status in('QUEUED','ASSIGNED')
  order by sequence_no desc limit 1 for update;
  if not found then raise exception 'No existe una tarea disponible para tomar'; end if;

  if v_task.assigned_profile_id is not null and v_task.assigned_profile_id<>v_actor then
    raise exception 'Esta tarea ya fue tomada por otro usuario.' using errcode='40001';
  end if;
  if not erp_private.workflow_actor_can(v_task.step_code,'CLAIM',v_task.assigned_profile_id) then
    raise exception 'No estás autorizado para tomar esta tarea' using errcode='42501';
  end if;

  if v_task.assigned_profile_id=v_actor and v_task.status='ASSIGNED' then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'taskId',v_task.id,'version',v_order.version);
  end if;

  update erp_supply.order_tasks
  set assigned_profile_id=v_actor,assigned_at=now(),status='ASSIGNED'
  where id=v_task.id and status='QUEUED' and assigned_profile_id is null
  returning * into v_task;

  if not found then
    raise exception 'Esta tarea ya fue tomada por otro usuario.' using errcode='40001';
  end if;

  update erp_supply.orders
  set current_assignee_id=v_actor,status='ASSIGNED',version=version+1,updated_at=now()
  where id=v_order.id
  returning * into v_order;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_TASK_CLAIMED','CLAIM',
    v_task.step_code,v_task.step_code,'QUEUED','ASSIGNED',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('integrationEvent','OrderTaskClaimed','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'taskId',v_task.id,'status','ASSIGNED','version',v_order.version);
end;
$$;

create or replace function public.erp_x_start_order_task(
  p_order_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
begin
  if v_actor is null then raise exception 'Usuario sin perfil operativo activo' using errcode='42501'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'Clave de idempotencia requerida'; end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;

  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'version',v_order.version);
  end if;
  if v_order.version<>p_expected_version then
    raise exception 'El pedido cambió mientras estaba abierto. Actualiza la pantalla.' using errcode='40001';
  end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status='ASSIGNED'
  order by sequence_no desc limit 1 for update;
  if not found then raise exception 'Primero debes tomar la tarea'; end if;

  if not erp_private.workflow_actor_can(v_task.step_code,'START',v_task.assigned_profile_id) then
    raise exception 'Solo el responsable autorizado puede iniciar esta tarea' using errcode='42501';
  end if;

  insert into erp_supply.task_sessions(organization_id,order_id,task_id,profile_id)
  values(v_order.organization_id,v_order.id,v_task.id,v_actor);

  update erp_supply.order_tasks
  set status='IN_PROGRESS',started_at=coalesce(started_at,now())
  where id=v_task.id returning * into v_task;

  update erp_supply.orders
  set status='IN_PROGRESS',version=version+1,updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_TASK_STARTED','START',
    v_task.step_code,v_task.step_code,'ASSIGNED','IN_PROGRESS',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('integrationEvent','OrderTaskStarted','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'taskId',v_task.id,'status','IN_PROGRESS','version',v_order.version);
end;
$$;

create or replace function public.erp_x_block_order_task(
  p_order_id uuid,
  p_reason_code text,
  p_detail text,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_block uuid;
begin
  if nullif(trim(p_detail),'') is null then raise exception 'Describe el motivo del bloqueo'; end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;
  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'version',v_order.version);
  end if;
  if v_order.version<>p_expected_version then raise exception 'El pedido cambió mientras estaba abierto. Actualiza la pantalla.' using errcode='40001'; end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status='IN_PROGRESS'
  order by sequence_no desc limit 1 for update;
  if not found then raise exception 'Solo una tarea en ejecución puede bloquearse'; end if;
  if not erp_private.workflow_actor_can(v_task.step_code,'BLOCK',v_task.assigned_profile_id) then
    raise exception 'No estás autorizado para bloquear esta tarea' using errcode='42501';
  end if;
  if not exists(select 1 from erp_supply.order_block_reasons where code=upper(trim(p_reason_code)) and active) then
    raise exception 'Motivo de bloqueo inválido';
  end if;

  update erp_supply.task_sessions
  set ended_at=now(),raw_seconds=greatest(0,extract(epoch from(now()-started_at))::bigint)
  where task_id=v_task.id and ended_at is null;

  insert into erp_supply.order_blocks(
    organization_id,order_id,task_id,reason_code,detail,blocked_by
  ) values(
    v_order.organization_id,v_order.id,v_task.id,upper(trim(p_reason_code)),trim(p_detail),v_actor
  ) returning id into v_block;

  update erp_supply.order_tasks
  set status='BLOCKED',blocked_at=now(),result_detail=trim(p_detail)
  where id=v_task.id;

  update erp_supply.orders
  set status='BLOCKED',version=version+1,updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_BLOCKED','BLOCK',
    v_task.step_code,v_task.step_code,'IN_PROGRESS','BLOCKED',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('blockId',v_block,'reasonCode',upper(trim(p_reason_code)),'integrationEvent','OrderBlocked','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'taskId',v_task.id,'blockId',v_block,'status','BLOCKED','version',v_order.version);
end;
$$;

create or replace function public.erp_x_resume_order_task(
  p_order_id uuid,
  p_resolution text,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_block erp_supply.order_blocks%rowtype;
begin
  if nullif(trim(p_resolution),'') is null then raise exception 'Describe cómo se resolvió el bloqueo'; end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;
  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'version',v_order.version);
  end if;
  if v_order.version<>p_expected_version then raise exception 'El pedido cambió mientras estaba abierto. Actualiza la pantalla.' using errcode='40001'; end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status='BLOCKED'
  order by sequence_no desc limit 1 for update;
  if not found then raise exception 'La tarea no está bloqueada'; end if;
  if not erp_private.workflow_actor_can(v_task.step_code,'RESUME',v_task.assigned_profile_id) then
    raise exception 'No estás autorizado para reanudar esta tarea' using errcode='42501';
  end if;

  select * into v_block from erp_supply.order_blocks
  where task_id=v_task.id and status='OPEN'
  order by blocked_at desc limit 1 for update;
  if not found then raise exception 'No existe un bloqueo abierto para esta tarea'; end if;

  update erp_supply.order_blocks
  set status='RESOLVED',resolved_by=v_actor,resolved_at=now(),resolution=trim(p_resolution)
  where id=v_block.id;

  insert into erp_supply.task_sessions(organization_id,order_id,task_id,profile_id,note)
  values(v_order.organization_id,v_order.id,v_task.id,v_actor,'Reanudación posterior a bloqueo');

  update erp_supply.order_tasks
  set status='IN_PROGRESS',blocked_at=null
  where id=v_task.id;

  update erp_supply.orders
  set status='IN_PROGRESS',version=version+1,updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_BLOCK_RESOLVED','RESUME',
    v_task.step_code,v_task.step_code,'BLOCKED','IN_PROGRESS',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('blockId',v_block.id,'blockedSeconds',extract(epoch from(now()-v_block.blocked_at))::bigint,'integrationEvent','OrderTaskResumed','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'taskId',v_task.id,'status','IN_PROGRESS','version',v_order.version);
end;
$$;

revoke all on function public.erp_x_claim_order_task(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_start_order_task(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_block_order_task(uuid,text,text,integer,text) from public,anon;
revoke all on function public.erp_x_resume_order_task(uuid,text,integer,text) from public,anon;

grant execute on function public.erp_x_claim_order_task(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_start_order_task(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_block_order_task(uuid,text,text,integer,text) to authenticated;
grant execute on function public.erp_x_resume_order_task(uuid,text,integer,text) to authenticated;

commit;
