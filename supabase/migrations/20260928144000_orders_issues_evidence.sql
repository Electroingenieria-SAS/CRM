begin;

create or replace function public.erp_x_create_order_issue(
  p_order_id uuid,
  p_payload jsonb,
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
  v_type erp_supply.order_issue_types%rowtype;
  v_issue erp_supply.order_issues%rowtype;
  v_code text:=upper(trim(coalesce(p_payload->>'type','OTHER')));
begin
  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;
  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id);
  end if;

  select * into v_type from erp_supply.order_issue_types where code=v_code and active;
  if not found then raise exception 'Tipo de incidencia inválido'; end if;
  if nullif(trim(p_payload->>'title'),'') is null then raise exception 'Título de incidencia requerido'; end if;
  if nullif(trim(p_payload->>'description'),'') is null then raise exception 'Descripción de incidencia requerida'; end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  order by sequence_no desc limit 1;

  insert into erp_supply.order_issues(
    organization_id,order_id,task_id,issue_type_code,severity,blocking,
    title,description,responsible_profile_id,created_by,metadata
  ) values(
    v_order.organization_id,v_order.id,v_task.id,v_type.code,
    coalesce(nullif(upper(trim(p_payload->>'severity')),''),v_type.default_severity),
    coalesce((p_payload->>'blocking')::boolean,v_type.default_blocking),
    trim(p_payload->>'title'),trim(p_payload->>'description'),
    nullif(p_payload->>'responsibleProfileId','')::uuid,v_actor,
    case when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
      then coalesce(p_payload->'metadata','{}'::jsonb) else '{}'::jsonb end
  ) returning * into v_issue;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_ISSUE_CREATED','ISSUE_CREATE',
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('issueId',v_issue.id,'type',v_issue.issue_type_code,'severity',v_issue.severity,'blocking',v_issue.blocking,'integrationEvent','OrderIssueCreated','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'issueId',v_issue.id);
exception when invalid_text_representation then
  raise exception 'El responsable o la severidad de la incidencia no es válido' using errcode='22023';
end;
$$;

create or replace function public.erp_x_resolve_order_issue(
  p_issue_id uuid,
  p_resolution text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_actor uuid:=erp_private.current_profile_id();
  v_issue erp_supply.order_issues%rowtype;
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
begin
  if nullif(trim(p_resolution),'') is null then raise exception 'La resolución es obligatoria'; end if;

  select * into v_issue from erp_supply.order_issues
  where id=p_issue_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Incidencia no disponible' using errcode='42501'; end if;

  select * into v_order from erp_supply.orders where id=v_issue.order_id;
  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'issueId',v_issue.id);
  end if;
  if v_issue.status<>'OPEN' then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id,'issueId',v_issue.id);
  end if;

  select * into v_task from erp_supply.order_tasks
  where id=v_issue.task_id;

  if v_issue.responsible_profile_id is not null
     and v_issue.responsible_profile_id<>v_actor
     and not erp_private.workflow_actor_can(coalesce(v_task.step_code,v_order.current_step_code),'BLOCK',v_task.assigned_profile_id) then
    raise exception 'No estás autorizado para resolver esta incidencia' using errcode='42501';
  end if;

  update erp_supply.order_issues
  set status='RESOLVED',resolved_by=v_actor,resolved_at=now(),resolution=trim(p_resolution)
  where id=v_issue.id returning * into v_issue;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_issue.task_id,'ORDER_ISSUE_RESOLVED','ISSUE_RESOLVE',
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('issueId',v_issue.id,'blocking',v_issue.blocking,'integrationEvent','OrderIssueResolved','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'issueId',v_issue.id);
end;
$$;

create or replace function public.erp_x_add_order_evidence(
  p_order_id uuid,
  p_payload jsonb,
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
  v_evidence erp_supply.order_evidence%rowtype;
begin
  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;
  if exists(select 1 from erp_supply.order_events where organization_id=v_order.organization_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('success',true,'idempotent',true,'orderId',v_order.id);
  end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  order by sequence_no desc limit 1;

  if v_task.id is null then raise exception 'El pedido no tiene una tarea activa'; end if;
  if not erp_private.workflow_actor_can(v_task.step_code,'START',v_task.assigned_profile_id) then
    raise exception 'No estás autorizado para adjuntar evidencia a esta tarea' using errcode='42501';
  end if;
  if nullif(trim(p_payload->>'evidenceType'),'') is null then raise exception 'Tipo de evidencia requerido'; end if;
  if nullif(trim(p_payload->>'storageReference'),'') is null then raise exception 'Referencia de almacenamiento requerida'; end if;

  insert into erp_supply.order_evidence(
    organization_id,order_id,task_id,evidence_type,storage_provider,storage_reference,
    file_name,mime_type,size_bytes,created_by,metadata
  ) values(
    v_order.organization_id,v_order.id,v_task.id,upper(trim(p_payload->>'evidenceType')),
    coalesce(nullif(upper(trim(p_payload->>'storageProvider')),''),'EXTERNAL'),
    trim(p_payload->>'storageReference'),nullif(trim(p_payload->>'fileName'),''),
    nullif(lower(trim(p_payload->>'mimeType')),''),
    nullif(p_payload->>'sizeBytes','')::bigint,v_actor,
    case when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
      then coalesce(p_payload->'metadata','{}'::jsonb) else '{}'::jsonb end
  ) returning * into v_evidence;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_EVIDENCE_ADDED','EVIDENCE_ADD',
    v_order.current_step_code,v_order.current_step_code,v_order.status,v_order.status,
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('evidenceId',v_evidence.id,'evidenceType',v_evidence.evidence_type,'storageProvider',v_evidence.storage_provider,'contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'evidenceId',v_evidence.id);
exception when invalid_text_representation then
  raise exception 'El tamaño de la evidencia no es válido' using errcode='22023';
end;
$$;

revoke all on function public.erp_x_create_order_issue(uuid,jsonb,text) from public,anon;
revoke all on function public.erp_x_resolve_order_issue(uuid,text,text) from public,anon;
revoke all on function public.erp_x_add_order_evidence(uuid,jsonb,text) from public,anon;
grant execute on function public.erp_x_create_order_issue(uuid,jsonb,text) to authenticated;
grant execute on function public.erp_x_resolve_order_issue(uuid,text,text) to authenticated;
grant execute on function public.erp_x_add_order_evidence(uuid,jsonb,text) to authenticated;

commit;
