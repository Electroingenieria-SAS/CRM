begin;

create or replace function public.erp_x_inventory_reserve(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_operation erp_supply.inventory_operations%rowtype;
  v_order uuid:=nullif(p_payload->>'orderId','')::uuid;
  v_order_number text:=nullif(btrim(coalesce(p_payload->>'orderNumber','')),'');
  v_material uuid:=(p_payload->>'materialId')::uuid;
  v_variant uuid:=nullif(p_payload->>'variantId','')::uuid;
  v_location uuid:=nullif(p_payload->>'locationId','')::uuid;
  v_quantity numeric:=(p_payload->>'quantity')::numeric;
  v_unit text:=p_payload->>'unit';
  v_remaining numeric;
  v_take numeric;
  v_balance erp_supply.inventory_balances%rowtype;
  v_reservation uuid;
  v_result jsonb;
begin
  perform erp_private.inventory_require('create');
  v_operation:=erp_private.inventory_begin_operation('RESERVE',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;

  if v_quantity is null or v_quantity<=0 then
    raise exception 'La cantidad a reservar debe ser mayor que cero' using errcode='22023';
  end if;
  perform erp_private.inventory_validate_material(v_org,v_material,v_variant,v_unit);
  if v_location is not null then perform erp_private.inventory_validate_location(v_org,v_location); end if;

  if v_order is null and v_order_number is not null then
    select o.id into v_order
    from erp_supply.orders o
    where o.organization_id=v_org and upper(o.order_number)=upper(v_order_number)
    limit 1;
  end if;

  if v_order is null or not exists(
    select 1 from erp_supply.orders o where o.id=v_order and o.organization_id=v_org
  ) then raise exception 'Pedido inválido para la reserva' using errcode='22023'; end if;

  insert into erp_supply.inventory_reservations(
    organization_id,order_id,material_id,variant_id,quantity,unit,reference,created_by,metadata
  ) values(
    v_org,v_order,v_material,v_variant,v_quantity,upper(btrim(v_unit)),
    nullif(btrim(coalesce(p_payload->>'reference','')),''),v_actor,
    coalesce(p_payload->'metadata','{}'::jsonb)
  ) returning id into v_reservation;

  v_remaining:=v_quantity;

  for v_balance in
    select b.*
    from erp_supply.inventory_balances b
    where b.organization_id=v_org
      and b.material_id=v_material
      and b.variant_id is not distinct from v_variant
      and (v_location is null or b.location_id=v_location)
      and b.on_hand-b.reserved-b.committed>0
    order by (b.on_hand-b.reserved-b.committed) desc,b.id
    for update
  loop
    v_take:=least(v_remaining,v_balance.on_hand-v_balance.reserved-v_balance.committed);
    if v_take<=0 then continue; end if;

    perform erp_private.inventory_apply_delta(
      v_operation.id,v_material,v_variant,v_balance.location_id,v_order,v_reservation,null,
      'RESERVE',v_take,v_unit,0,v_take,0,
      p_payload->>'reference','Reserva para pedido',p_payload->'metadata',null
    );

    insert into erp_supply.inventory_reservation_allocations(
      organization_id,reservation_id,balance_id,location_id,quantity
    ) values(v_org,v_reservation,v_balance.id,v_balance.location_id,v_take);

    v_remaining:=v_remaining-v_take;
    exit when v_remaining<=0;
  end loop;

  if v_remaining>0 then
    raise exception 'Stock disponible insuficiente para completar la reserva' using errcode='23514';
  end if;

  v_result:=jsonb_build_object(
    'reservationId',v_reservation,
    'reserved',v_quantity,
    'status','ACTIVE',
    'contractVersion','1.0.0'
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

revoke all on function public.erp_x_inventory_reserve(jsonb,text) from public,anon;
grant execute on function public.erp_x_inventory_reserve(jsonb,text) to authenticated;

commit;
