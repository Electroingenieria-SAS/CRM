begin;

create or replace function public.erp_x_complete_order_task(
  p_order_id uuid,
  p_result_code text,
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
  v_next text;
  v_new_task erp_supply.order_tasks%rowtype;
  v_missing jsonb;
  v_raw bigint:=0;
begin
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
  if not found then raise exception 'Debe iniciar la tarea antes de finalizarla'; end if;
  if not erp_private.workflow_actor_can(v_task.step_code,'COMPLETE',v_task.assigned_profile_id) then
    raise exception 'Solo el responsable autorizado puede completar esta tarea' using errcode='42501';
  end if;
  if exists(select 1 from erp_supply.order_blocks where task_id=v_task.id and status='OPEN') then
    raise exception 'La tarea mantiene un bloqueo abierto';
  end if;
  if exists(select 1 from erp_supply.order_issues where order_id=v_order.id and blocking and status='OPEN') then
    raise exception 'El pedido mantiene una incidencia bloqueante abierta';
  end if;

  v_missing:=erp_private.requirements_missing(v_task.id);
  if jsonb_array_length(v_missing)>0 then
    raise exception 'Faltan requisitos obligatorios para completar la etapa: %',v_missing::text;
  end if;

  update erp_supply.task_sessions
  set ended_at=now(),raw_seconds=greatest(0,extract(epoch from(now()-started_at))::bigint)
  where task_id=v_task.id and ended_at is null;

  select coalesce(sum(raw_seconds),0) into v_raw
  from erp_supply.task_sessions
  where task_id=v_task.id;

  update erp_supply.order_tasks
  set status='COMPLETED',completed_at=now(),raw_seconds=v_raw,
      result_code=coalesce(nullif(trim(p_result_code),''),'COMPLETED'),
      result_detail=nullif(trim(p_detail),'')
  where id=v_task.id
  returning * into v_task;

  v_next:=erp_private.resolve_next_step(v_order);

  if v_next='CLOSED' then
    update erp_supply.orders
    set current_step_code='CLOSED',status='CLOSED',closed_at=now(),
        current_assignee_id=null,current_role_code=null,version=version+1,updated_at=now()
    where id=v_order.id
    returning * into v_order;
  else
    select * into v_new_task
    from erp_private.create_operational_task(v_order.id,v_next,v_task.sequence_no+1);
    select * into v_order from erp_supply.orders where id=v_order.id;
  end if;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,
    case when v_next='CLOSED' then 'ORDER_CLOSED' else 'ORDER_TASK_COMPLETED' end,
    'COMPLETE',v_task.step_code,v_next,'IN_PROGRESS',v_order.status,
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object(
      'resultCode',v_task.result_code,
      'nextTaskId',case when v_new_task.id is null then null else v_new_task.id end,
      'integrationEvent',case when v_next='CLOSED' then 'OrderClosed' else 'OrderTaskCompleted' end,
      'contractVersion','1.0.0'
    )
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'orderId',v_order.id,
    'completedTaskId',v_task.id,'nextStep',v_next,'status',v_order.status,'version',v_order.version
  );
end;
$$;

create or replace function public.erp_x_cancel_order(
  p_order_id uuid,
  p_reason text,
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
  if nullif(trim(p_reason),'') is null then raise exception 'La razón de cancelación es obligatoria'; end if;
  if not erp_private.can_manage_order_action('CANCEL') then
    raise exception 'No estás autorizado para cancelar pedidos' using errcode='42501';
  end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;

  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'version',v_order.version);
  end if;
  if v_order.version<>p_expected_version then raise exception 'El pedido cambió mientras estaba abierto. Actualiza la pantalla.' using errcode='40001'; end if;
  if v_order.status in('CLOSED','CANCELLED') then raise exception 'El pedido ya está cerrado o cancelado'; end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  order by sequence_no desc limit 1 for update;

  if v_task.id is not null then
    update erp_supply.task_sessions
    set ended_at=now(),raw_seconds=greatest(0,extract(epoch from(now()-started_at))::bigint),
        note='Cerrada por cancelación del pedido'
    where task_id=v_task.id and ended_at is null;

    update erp_supply.order_tasks
    set status='CANCELLED',completed_at=now(),result_code='ORDER_CANCELLED',result_detail=trim(p_reason)
    where id=v_task.id;
  end if;

  update erp_supply.order_blocks
  set status='RESOLVED',resolved_by=v_actor,resolved_at=now(),
      resolution='Cerrado automáticamente por cancelación del pedido'
  where order_id=v_order.id and status='OPEN';

  update erp_supply.orders
  set status='CANCELLED',cancelled_at=now(),current_assignee_id=null,current_role_code=null,
      version=version+1,updated_at=now()
  where id=v_order.id
  returning * into v_order;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_CANCELLED','CANCEL',
    v_order.current_step_code,v_order.current_step_code,null,'CANCELLED',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('reason',trim(p_reason),'integrationEvent','OrderCancelled','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'status','CANCELLED','version',v_order.version);
end;
$$;

create or replace function public.erp_x_reopen_order(
  p_order_id uuid,
  p_target_step text,
  p_reason text,
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
  v_target text:=upper(trim(coalesce(p_target_step,'')));
  v_sequence integer;
  v_previous_status text;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'La razón de reapertura es obligatoria'; end if;
  if not erp_private.can_manage_order_action('REOPEN') then
    raise exception 'No estás autorizado para reabrir pedidos' using errcode='42501';
  end if;
  if not exists(select 1 from erp_supply.workflow_steps where code=v_target and active and not terminal) then
    raise exception 'Etapa de reapertura inválida';
  end if;

  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;

  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'version',v_order.version);
  end if;
  if v_order.version<>p_expected_version then raise exception 'El pedido cambió mientras estaba abierto. Actualiza la pantalla.' using errcode='40001'; end if;
  if v_order.status not in('CLOSED','CANCELLED') then raise exception 'Solo pueden reabrirse pedidos cerrados o cancelados'; end if;

  v_previous_status:=v_order.status;
  select coalesce(max(sequence_no),0)+1 into v_sequence
  from erp_supply.order_tasks where order_id=v_order.id;

  update erp_supply.orders
  set closed_at=null,cancelled_at=null,updated_at=now()
  where id=v_order.id;

  select * into v_task from erp_private.create_operational_task(v_order.id,v_target,v_sequence);
  select * into v_order from erp_supply.orders where id=v_order.id;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_REOPENED','REOPEN',
    'CLOSED',v_target,v_previous_status,'QUEUED',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('reason',trim(p_reason),'integrationEvent','OrderReopened','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'taskId',v_task.id,'status','QUEUED','currentStep',v_target,'version',v_order.version);
end;
$$;

revoke all on function public.erp_x_complete_order_task(uuid,text,text,integer,text) from public,anon;
revoke all on function public.erp_x_cancel_order(uuid,text,integer,text) from public,anon;
revoke all on function public.erp_x_reopen_order(uuid,text,text,integer,text) from public,anon;

grant execute on function public.erp_x_complete_order_task(uuid,text,text,integer,text) to authenticated;
grant execute on function public.erp_x_cancel_order(uuid,text,integer,text) to authenticated;
grant execute on function public.erp_x_reopen_order(uuid,text,text,integer,text) to authenticated;

commit;
