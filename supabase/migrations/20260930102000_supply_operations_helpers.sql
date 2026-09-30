begin;

create or replace function erp_private.supply_require(p_module text,p_action text)
returns void
language plpgsql
stable
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
begin
  if erp_private.current_profile_id() is null then
    raise exception 'Sesión inválida' using errcode='42501';
  end if;
  if not erp_private.can_access_module(p_module,p_action) then
    raise exception 'No autorizado para esta operación' using errcode='42501';
  end if;
end;
$$;

create or replace function erp_private.supply_begin_operation(p_type text,p_key text)
returns erp_supply.supply_operations
language plpgsql
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_op erp_supply.supply_operations%rowtype;
begin
  if btrim(coalesce(p_key,''))='' then
    raise exception 'Clave de idempotencia requerida' using errcode='22023';
  end if;

  select * into v_op
  from erp_supply.supply_operations
  where organization_id=v_org and operation_key=btrim(p_key)
  for update;

  if found then return v_op; end if;

  insert into erp_supply.supply_operations(
    organization_id,operation_key,operation_type,actor_profile_id
  ) values(v_org,btrim(p_key),upper(btrim(p_type)),v_actor)
  returning * into v_op;

  return v_op;
end;
$$;

create or replace function erp_private.supply_finish_operation(p_id uuid,p_result jsonb)
returns void
language sql
security definer
set search_path=pg_catalog,erp_supply
as $$
  update erp_supply.supply_operations
  set result=p_result,completed_at=now()
  where id=p_id
$$;

create or replace function erp_private.supply_event(
  p_order uuid,p_type text,p_aggregate_type text,p_aggregate uuid,p_key text,p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
begin
  insert into erp_supply.supply_events(
    organization_id,order_id,aggregate_type,aggregate_id,event_type,
    actor_profile_id,idempotency_key,payload
  ) values(
    erp_private.current_org_id(),p_order,upper(p_aggregate_type),p_aggregate,
    upper(p_type),erp_private.current_profile_id(),nullif(btrim(coalesce(p_key,'')),''),
    coalesce(p_payload,'{}'::jsonb)
  )
  on conflict (organization_id,idempotency_key) where idempotency_key is not null do nothing;
end;
$$;

create or replace function erp_private.supply_grant_order_contract(
  p_order uuid,p_contract text,p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
  v_task uuid;
  v_key text;
begin
  select * into v_order
  from erp_supply.orders
  where id=p_order and organization_id=erp_private.current_org_id();

  if not found then raise exception 'Pedido no disponible' using errcode='42501'; end if;

  select t.id into v_task
  from erp_supply.order_tasks t
  where t.order_id=p_order and t.status in('QUEUED','ASSIGNED','IN_PROGRESS','BLOCKED')
  order by t.sequence_no desc limit 1;

  v_key:='supply-contract:'||upper(p_contract)||':'||p_order::text;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    v_order.organization_id,v_order.id,v_task,'APPROVAL_GRANTED','SUPPLY_CONTRACT',
    v_order.current_step_code,v_order.current_step_code,
    erp_private.current_profile_id(),erp_private.current_primary_role(),v_key,
    coalesce(p_payload,'{}'::jsonb)||jsonb_build_object(
      'contractCode',upper(p_contract),'source','SUPPLY_OPERATIONS','contractVersion','1.0.0'
    )
  )
  on conflict (organization_id,idempotency_key) where idempotency_key is not null do nothing;
end;
$$;

revoke all on function erp_private.supply_require(text,text) from public,anon,authenticated;
revoke all on function erp_private.supply_begin_operation(text,text) from public,anon,authenticated;
revoke all on function erp_private.supply_finish_operation(uuid,jsonb) from public,anon,authenticated;
revoke all on function erp_private.supply_event(uuid,text,text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function erp_private.supply_grant_order_contract(uuid,text,jsonb) from public,anon,authenticated;

grant execute on function erp_private.supply_require(text,text) to authenticated;
grant execute on function erp_private.supply_begin_operation(text,text) to authenticated;
grant execute on function erp_private.supply_finish_operation(uuid,jsonb) to authenticated;
grant execute on function erp_private.supply_event(uuid,text,text,uuid,text,jsonb) to authenticated;
grant execute on function erp_private.supply_grant_order_contract(uuid,text,jsonb) to authenticated;

commit;
