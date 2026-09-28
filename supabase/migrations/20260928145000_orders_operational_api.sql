begin;

create or replace function public.erp_x_assign_order_task(
  p_order_id uuid,
  p_profile_id uuid,
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
  v_target erp_supply.profiles%rowtype;
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
  where order_id=v_order.id and status in('QUEUED','ASSIGNED')
  order by sequence_no desc limit 1 for update;
  if not found then raise exception 'La tarea ya no puede asignarse'; end if;
  if not erp_private.workflow_actor_can(v_task.step_code,'ASSIGN',v_task.assigned_profile_id) then
    raise exception 'No estás autorizado para asignar esta tarea' using errcode='42501';
  end if;

  select * into v_target from erp_supply.profiles
  where id=p_profile_id and organization_id=v_order.organization_id and active;
  if not found then raise exception 'Responsable no válido'; end if;

  if not exists(
    select 1
    from erp_supply.profile_roles pr
    join erp_supply.step_roles sr on sr.role_code=pr.role_code
    where pr.profile_id=v_target.id
      and sr.step_code=v_task.step_code
      and (sr.can_start or sr.can_claim or sr.can_override)
  ) then
    raise exception 'El responsable no tiene permisos para esta etapa' using errcode='42501';
  end if;

  update erp_supply.order_tasks
  set assigned_profile_id=v_target.id,assigned_at=now(),status='ASSIGNED'
  where id=v_task.id returning * into v_task;

  update erp_supply.orders
  set current_assignee_id=v_target.id,status='ASSIGNED',version=version+1,updated_at=now()
  where id=v_order.id returning * into v_order;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task.id,'ORDER_TASK_ASSIGNED','ASSIGN',
    v_task.step_code,v_task.step_code,'QUEUED','ASSIGNED',
    v_actor,erp_private.current_primary_role(),p_idempotency_key,
    jsonb_build_object('assignedProfileId',v_target.id,'assignedName',v_target.display_name,'integrationEvent','OrderTaskAssigned','contractVersion','1.0.0')
  );

  return jsonb_build_object('success',true,'idempotent',false,'orderId',v_order.id,'taskId',v_task.id,'assignedProfileId',v_target.id,'status','ASSIGNED','version',v_order.version);
end;
$$;

create or replace function public.erp_x_order_assignment_candidates(p_order_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
  with current_task as (
    select t.*
    from erp_supply.order_tasks t
    join erp_supply.orders o on o.id=t.order_id
    where t.order_id=p_order_id
      and o.organization_id=erp_private.current_org_id()
      and t.status in('QUEUED','ASSIGNED')
    order by t.sequence_no desc
    limit 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'name',p.display_name,
    'employeeCode',p.employee_code,
    'roles',roles.role_codes
  ) order by p.display_name),'[]'::jsonb)
  from current_task t
  join erp_supply.profiles p
    on p.organization_id=erp_private.current_org_id() and p.active
  join lateral (
    select array_agg(pr.role_code order by pr.role_code) role_codes
    from erp_supply.profile_roles pr
    join erp_supply.step_roles sr on sr.role_code=pr.role_code and sr.step_code=t.step_code
    where pr.profile_id=p.id and (sr.can_start or sr.can_claim or sr.can_override)
  ) roles on cardinality(roles.role_codes)>0
$$;

create or replace function public.erp_x_order_actions(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_actions jsonb:='[]'::jsonb;
  v_missing jsonb:='[]'::jsonb;
  v_has_blocking_issue boolean:=false;
begin
  select * into v_order from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();
  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;

  select * into v_task from erp_supply.order_tasks
  where order_id=v_order.id and status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED')
  order by sequence_no desc limit 1;

  if v_task.id is not null then
    v_missing:=erp_private.requirements_missing(v_task.id);
    select exists(
      select 1 from erp_supply.order_issues
      where order_id=v_order.id and blocking and status='OPEN'
    ) into v_has_blocking_issue;

    if v_task.status='QUEUED' and erp_private.workflow_actor_can(v_task.step_code,'CLAIM',v_task.assigned_profile_id) then
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','CLAIM','label','Tomar tarea','enabled',true));
    end if;
    if v_task.status in('QUEUED','ASSIGNED') and erp_private.workflow_actor_can(v_task.step_code,'ASSIGN',v_task.assigned_profile_id) then
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','ASSIGN','label','Asignar responsable','enabled',true));
    end if;
    if v_task.status='ASSIGNED' and erp_private.workflow_actor_can(v_task.step_code,'START',v_task.assigned_profile_id) then
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','START','label','Iniciar trabajo','enabled',true));
    end if;
    if v_task.status='IN_PROGRESS' and erp_private.workflow_actor_can(v_task.step_code,'BLOCK',v_task.assigned_profile_id) then
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','BLOCK','label','Bloquear','enabled',true,'requires',jsonb_build_array('reasonCode','detail')));
    end if;
    if v_task.status='BLOCKED' and erp_private.workflow_actor_can(v_task.step_code,'RESUME',v_task.assigned_profile_id) then
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','RESUME','label','Resolver y reanudar','enabled',true,'requires',jsonb_build_array('resolution')));
    end if;
    if v_task.status='IN_PROGRESS' and erp_private.workflow_actor_can(v_task.step_code,'COMPLETE',v_task.assigned_profile_id) then
      v_actions:=v_actions||jsonb_build_array(jsonb_build_object(
        'code','COMPLETE','label','Completar etapa',
        'enabled',jsonb_array_length(v_missing)=0 and not v_has_blocking_issue,
        'reason',case
          when v_has_blocking_issue then 'Existe una incidencia bloqueante abierta.'
          when jsonb_array_length(v_missing)>0 then 'Faltan requisitos obligatorios.'
          else null
        end
      ));
    end if;

    v_actions:=v_actions||jsonb_build_array(
      jsonb_build_object('code','ISSUE_CREATE','label','Registrar incidencia','enabled',true),
      jsonb_build_object('code','EVIDENCE_ADD','label','Agregar evidencia','enabled',true)
    );
  end if;

  if v_order.status not in('CLOSED','CANCELLED') and erp_private.can_manage_order_action('CANCEL') then
    v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','CANCEL','label','Cancelar pedido','enabled',true));
  end if;
  if v_order.status in('CLOSED','CANCELLED') and erp_private.can_manage_order_action('REOPEN') then
    v_actions:=v_actions||jsonb_build_array(jsonb_build_object('code','REOPEN','label','Reabrir pedido','enabled',true));
  end if;

  return jsonb_build_object(
    'actions',v_actions,
    'missingRequirements',v_missing,
    'blockingIssueOpen',v_has_blocking_issue,
    'reopenCandidates',(
      select coalesce(jsonb_agg(jsonb_build_object('code',s.code,'name',s.name) order by s.sort_order),'[]'::jsonb)
      from erp_supply.workflow_steps s
      where s.active and not s.terminal
    )
  );
end;
$$;

create or replace function public.erp_x_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
begin
  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();

  if not found then raise exception 'Pedido no encontrado' using errcode='P0002'; end if;

  return jsonb_build_object(
    'order',to_jsonb(v_order),
    'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.line_number),'[]'::jsonb) from erp_supply.order_items i where i.order_id=p_order_id),
    'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.sequence_no),'[]'::jsonb) from erp_supply.order_tasks t where t.order_id=p_order_id),
    'blocks',(select coalesce(jsonb_agg(to_jsonb(b) order by b.blocked_at),'[]'::jsonb) from erp_supply.order_blocks b where b.order_id=p_order_id),
    'issues',(select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at),'[]'::jsonb) from erp_supply.order_issues i where i.order_id=p_order_id),
    'evidence',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb) from erp_supply.order_evidence e where e.order_id=p_order_id),
    'events',(
      select coalesce(jsonb_agg(
        to_jsonb(e)||jsonb_build_object('actorName',p.display_name)
        order by e.created_at,e.id
      ),'[]'::jsonb)
      from erp_supply.order_events e
      left join erp_supply.profiles p on p.id=e.actor_profile_id
      where e.order_id=p_order_id
    ),
    'workflow',public.erp_x_order_actions(p_order_id),
    'assignmentCandidates',public.erp_x_order_assignment_candidates(p_order_id),
    'contractVersion','1.1.0'
  );
end;
$$;

revoke all on function public.erp_x_assign_order_task(uuid,uuid,integer,text) from public,anon;
revoke all on function public.erp_x_order_assignment_candidates(uuid) from public,anon;
revoke all on function public.erp_x_order_actions(uuid) from public,anon;
grant execute on function public.erp_x_assign_order_task(uuid,uuid,integer,text) to authenticated;
grant execute on function public.erp_x_order_assignment_candidates(uuid) to authenticated;
grant execute on function public.erp_x_order_actions(uuid) to authenticated;

commit;
