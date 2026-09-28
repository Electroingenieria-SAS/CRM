begin;

create or replace function erp_private.current_primary_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select pr.role_code
  from erp_supply.profile_roles pr
  where pr.profile_id=erp_private.current_profile_id()
  order by pr.is_primary desc,pr.granted_at,pr.role_code
  limit 1
$$;

create or replace function erp_private.workflow_actor_can(
  p_step text,
  p_action text,
  p_assignee uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
  select coalesce(bool_or(
    sr.can_override or case upper(trim(p_action))
      when 'CLAIM' then sr.can_claim
        and (p_assignee is null or p_assignee=erp_private.current_profile_id() or sr.can_override)
      when 'ASSIGN' then sr.can_assign
      when 'START' then sr.can_start
        and (p_assignee is null or p_assignee=erp_private.current_profile_id() or sr.can_override)
      when 'COMPLETE' then sr.can_complete
        and (p_assignee=erp_private.current_profile_id() or sr.can_override)
      when 'BLOCK' then sr.can_block
        and (p_assignee=erp_private.current_profile_id() or sr.can_override)
      when 'RESUME' then sr.can_start
        and (p_assignee=erp_private.current_profile_id() or sr.can_override)
      else sr.can_view
    end
  ),false)
  from erp_supply.step_roles sr
  where sr.step_code=p_step
    and sr.role_code=any(erp_private.current_roles())
$$;

create or replace function erp_private.can_manage_order_action(p_action text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
  select exists(
    select 1
    from erp_supply.order_action_authorities a
    where a.action_code=upper(trim(p_action))
      and a.active
      and a.role_code=any(erp_private.current_roles())
  )
$$;

create or replace function erp_private.resolve_next_step(p_order erp_supply.orders)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
declare
  v_next text;
begin
  select t.to_step_code
  into v_next
  from erp_supply.workflow_transitions t
  where t.active
    and t.from_step_code=p_order.current_step_code
    and t.action_code='COMPLETE'
    and (t.order_type_code is null or t.order_type_code=p_order.order_type_code)
    and (t.payment_condition_code is null or t.payment_condition_code=p_order.payment_condition_code)
    and (t.delivery_route_code is null or t.delivery_route_code=p_order.delivery_route_code)
    and (t.requires_cut is null or t.requires_cut=p_order.requires_cut)
    and (t.requires_purchase is null or t.requires_purchase=p_order.requires_purchase)
  order by
    ((t.order_type_code is not null)::int+
     (t.payment_condition_code is not null)::int+
     (t.delivery_route_code is not null)::int+
     (t.requires_cut is not null)::int+
     (t.requires_purchase is not null)::int) desc,
    t.priority asc,
    t.created_at asc
  limit 1;

  if v_next is null then
    raise exception 'No existe una transición válida desde %',p_order.current_step_code
      using errcode='P0001';
  end if;

  return v_next;
end;
$$;

create or replace function erp_private.requirements_missing(
  p_task_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  with task as (
    select t.id,t.order_id,t.step_code
    from erp_supply.order_tasks t
    where t.id=p_task_id
  ), missing as (
    select r.requirement_code,r.requirement_type,r.evidence_type,r.approval_contract_code
    from task t
    join erp_supply.workflow_step_requirements r
      on r.step_code=t.step_code and r.active
    where (
      r.requirement_type='EVIDENCE'
      and (
        select count(*)
        from erp_supply.order_evidence e
        where e.task_id=t.id and e.evidence_type=r.evidence_type
      ) < r.required_count
    ) or (
      r.requirement_type='APPROVAL_CONTRACT'
      and not exists(
        select 1
        from erp_supply.order_events e
        where e.task_id=t.id
          and e.event_type='APPROVAL_GRANTED'
          and e.payload->>'contractCode'=r.approval_contract_code
      )
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code',requirement_code,
    'type',requirement_type,
    'evidenceType',evidence_type,
    'approvalContractCode',approval_contract_code
  )),'[]'::jsonb)
  from missing
$$;

create or replace function erp_private.create_operational_task(
  p_order_id uuid,
  p_step text,
  p_sequence integer
)
returns erp_supply.order_tasks
language plpgsql
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
  v_role text;
begin
  select * into v_order
  from erp_supply.orders
  where id=p_order_id
    and organization_id=erp_private.current_org_id()
  for update;

  if not found then
    raise exception 'Pedido no disponible' using errcode='42501';
  end if;

  select sr.role_code into v_role
  from erp_supply.step_roles sr
  where sr.step_code=p_step
    and sr.can_claim
    and sr.role_code<>'super_admin'
  order by
    case sr.role_code
      when 'coordinador_logistico' then 10
      when 'aux_logistica' then 20
      when 'auxiliar_corte' then 30
      when 'despacho_nacional' then 40
      else 50
    end,
    sr.role_code
  limit 1;

  insert into erp_supply.order_tasks(
    order_id,step_code,sequence_no,queue_code,status,assigned_role_code
  )
  select v_order.id,s.code,p_sequence,s.queue_code,'QUEUED',v_role
  from erp_supply.workflow_steps s
  where s.code=p_step and s.active
  returning * into v_task;

  if v_task.id is null then
    raise exception 'Etapa operativa inválida: %',p_step;
  end if;

  update erp_supply.orders
  set current_step_code=p_step,
      status='QUEUED',
      current_assignee_id=null,
      current_role_code=v_role,
      version=version+1,
      updated_at=now()
  where id=v_order.id;

  return v_task;
end;
$$;

revoke all on function erp_private.current_primary_role() from public,anon;
revoke all on function erp_private.workflow_actor_can(text,text,uuid) from public,anon;
revoke all on function erp_private.can_manage_order_action(text) from public,anon;
revoke all on function erp_private.resolve_next_step(erp_supply.orders) from public,anon;
revoke all on function erp_private.requirements_missing(uuid) from public,anon;
revoke all on function erp_private.create_operational_task(uuid,text,integer) from public,anon;

grant execute on function erp_private.current_primary_role() to authenticated;
grant execute on function erp_private.workflow_actor_can(text,text,uuid) to authenticated;
grant execute on function erp_private.can_manage_order_action(text) to authenticated;
grant execute on function erp_private.resolve_next_step(erp_supply.orders) to authenticated;
grant execute on function erp_private.requirements_missing(uuid) to authenticated;
grant execute on function erp_private.create_operational_task(uuid,text,integer) to authenticated;

commit;
