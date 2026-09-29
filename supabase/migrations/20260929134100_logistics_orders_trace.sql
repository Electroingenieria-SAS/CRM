begin;

create or replace function erp_private.logistics_append_event(
  p_shipment_id uuid,
  p_order_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_payload jsonb,
  p_idempotency_key text
)
returns bigint
language plpgsql
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_id bigint;
  v_actor uuid:=erp_private.current_profile_id();
  v_order erp_supply.orders%rowtype;
  v_task erp_supply.order_tasks%rowtype;
begin
  insert into erp_supply.logistics_events(
    organization_id,shipment_id,order_id,event_type,from_status,to_status,
    actor_profile_id,idempotency_key,payload
  ) values(
    erp_private.current_org_id(),p_shipment_id,p_order_id,upper(trim(p_event_type)),
    p_from_status,p_to_status,v_actor,trim(p_idempotency_key),coalesce(p_payload,'{}'::jsonb)
  )
  on conflict(organization_id,idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from erp_supply.logistics_events
    where organization_id=erp_private.current_org_id()
      and idempotency_key=trim(p_idempotency_key);
    return v_id;
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();

  select * into v_task
  from erp_supply.order_tasks
  where order_id=p_order_id
  order by sequence_no desc
  limit 1;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    from_step_code,to_step_code,from_status,to_status,
    actor_profile_id,actor_role_code,idempotency_key,payload
  ) values(
    erp_private.current_org_id(),p_order_id,v_task.id,
    'ORDER_LOGISTICS_EVENT',upper(trim(p_event_type)),
    v_order.current_step_code,v_order.current_step_code,
    p_from_status,p_to_status,v_actor,erp_private.current_primary_role(),
    trim(p_idempotency_key)||':orders',
    coalesce(p_payload,'{}'::jsonb)||jsonb_build_object(
      'shipmentId',p_shipment_id,
      'integrationEvent',upper(trim(p_event_type)),
      'contractVersion','1.0.0'
    )
  )
  on conflict(organization_id,idempotency_key)
  where idempotency_key is not null
  do nothing;

  return v_id;
end;
$$;

revoke all on function erp_private.logistics_append_event(uuid,uuid,text,text,text,jsonb,text)
from public,anon;
grant execute on function erp_private.logistics_append_event(uuid,uuid,text,text,text,jsonb,text)
to authenticated;

commit;
