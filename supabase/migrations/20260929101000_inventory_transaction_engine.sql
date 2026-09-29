begin;

create or replace function erp_private.inventory_require(p_action text)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
begin
  if erp_private.current_profile_id() is null
     or not erp_private.can_access_module('inventory', p_action) then
    raise exception 'No autorizado para esta operación de inventario' using errcode='42501';
  end if;
end;
$$;

create or replace function erp_private.inventory_validate_material(
  p_org uuid,
  p_material uuid,
  p_variant uuid,
  p_unit text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
declare
  v_unit text;
begin
  select upper(btrim(m.unit))
  into v_unit
  from erp_supply.material_master m
  where m.id=p_material and m.organization_id=p_org and m.active;

  if v_unit is null then
    raise exception 'Material no disponible en esta organización' using errcode='22023';
  end if;

  if upper(btrim(coalesce(p_unit,''))) <> v_unit then
    raise exception 'La unidad no corresponde al maestro del material' using errcode='22023';
  end if;

  if p_variant is not null then
    if not exists (
      select 1 from erp_supply.material_variants v
      where v.id=p_variant
        and v.organization_id=p_org
        and v.material_id=p_material
        and v.active
    ) then
      raise exception 'La variante no corresponde al material' using errcode='22023';
    end if;
  elsif exists (
    select 1 from erp_supply.material_variants v
    where v.organization_id=p_org and v.material_id=p_material and v.active
  ) then
    raise exception 'Debes seleccionar la variante del material' using errcode='22023';
  end if;

  return v_unit;
end;
$$;

create or replace function erp_private.inventory_validate_location(p_org uuid, p_location uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
begin
  if not exists (
    select 1 from erp_supply.inventory_locations l
    where l.id=p_location and l.organization_id=p_org and l.active
  ) then
    raise exception 'Ubicación de inventario inválida' using errcode='22023';
  end if;
end;
$$;

create or replace function erp_private.inventory_begin_operation(
  p_type text,
  p_key text
)
returns erp_supply.inventory_operations
language plpgsql
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_operation erp_supply.inventory_operations%rowtype;
begin
  if v_org is null or v_actor is null then
    raise exception 'Sesión de inventario inválida' using errcode='42501';
  end if;
  if btrim(coalesce(p_key,''))='' then
    raise exception 'La clave de idempotencia es obligatoria' using errcode='22023';
  end if;

  insert into erp_supply.inventory_operations(
    organization_id,operation_key,operation_type,actor_profile_id
  ) values(v_org,btrim(p_key),upper(btrim(p_type)),v_actor)
  on conflict (organization_id,operation_key) do nothing;

  select *
  into v_operation
  from erp_supply.inventory_operations o
  where o.organization_id=v_org and o.operation_key=btrim(p_key)
  for update;

  if v_operation.operation_type <> upper(btrim(p_type)) then
    raise exception 'La clave de idempotencia pertenece a otra operación' using errcode='22023';
  end if;

  return v_operation;
end;
$$;

create or replace function erp_private.inventory_finish_operation(
  p_operation uuid,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
begin
  update erp_supply.inventory_operations
  set result=coalesce(p_result,'{}'::jsonb),completed_at=now()
  where id=p_operation
    and organization_id=erp_private.current_org_id();
end;
$$;

create or replace function erp_private.inventory_balance_json(p_balance uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select jsonb_build_object(
    'balanceId',b.id,
    'onHand',b.on_hand,
    'reserved',b.reserved,
    'committed',b.committed,
    'available',b.on_hand-b.reserved-b.committed,
    'version',b.version
  )
  from erp_supply.inventory_balances b
  where b.id=p_balance
$$;

create or replace function erp_private.inventory_apply_delta(
  p_operation uuid,
  p_material uuid,
  p_variant uuid,
  p_location uuid,
  p_order uuid,
  p_reservation uuid,
  p_count uuid,
  p_type text,
  p_quantity numeric,
  p_unit text,
  p_on_hand_delta numeric,
  p_reserved_delta numeric,
  p_committed_delta numeric,
  p_reference text,
  p_reason text,
  p_metadata jsonb,
  p_reversal_of uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_balance erp_supply.inventory_balances%rowtype;
  v_movement uuid;
  v_type text:=upper(btrim(p_type));
  v_unit text;
  v_new_on_hand numeric;
  v_new_reserved numeric;
  v_new_committed numeric;
begin
  if p_quantity is null or p_quantity<=0 then
    raise exception 'La cantidad debe ser mayor que cero' using errcode='22023';
  end if;

  v_unit:=erp_private.inventory_validate_material(v_org,p_material,p_variant,p_unit);
  perform erp_private.inventory_validate_location(v_org,p_location);

  if v_type='RECEIPT' and not (
    p_on_hand_delta=p_quantity and p_reserved_delta=0 and p_committed_delta=0
  ) then raise exception 'Efecto inválido para RECEIPT' using errcode='22023';
  elsif v_type='RESERVE' and not (
    p_on_hand_delta=0 and p_reserved_delta=p_quantity and p_committed_delta=0
  ) then raise exception 'Efecto inválido para RESERVE' using errcode='22023';
  elsif v_type='RELEASE' and not (
    p_on_hand_delta=0 and p_reserved_delta=-p_quantity and p_committed_delta=0
  ) then raise exception 'Efecto inválido para RELEASE' using errcode='22023';
  elsif v_type='PICK' and not (
    p_on_hand_delta=0 and p_reserved_delta=-p_quantity and p_committed_delta=p_quantity
  ) then raise exception 'Efecto inválido para PICK' using errcode='22023';
  elsif v_type in('CONSUME','WASTE') and not (
    p_on_hand_delta=-p_quantity and p_reserved_delta=0 and p_committed_delta=-p_quantity
  ) then raise exception 'Efecto inválido para consumo físico' using errcode='22023';
  elsif v_type='RETURN' and not (
    p_on_hand_delta=0 and p_reserved_delta=0 and p_committed_delta=-p_quantity
  ) then raise exception 'Efecto inválido para RETURN' using errcode='22023';
  elsif v_type='ADJUSTMENT_IN' and not (
    p_on_hand_delta=p_quantity and p_reserved_delta=0 and p_committed_delta=0
  ) then raise exception 'Efecto inválido para ADJUSTMENT_IN' using errcode='22023';
  elsif v_type='ADJUSTMENT_OUT' and not (
    p_on_hand_delta=-p_quantity and p_reserved_delta=0 and p_committed_delta=0
  ) then raise exception 'Efecto inválido para ADJUSTMENT_OUT' using errcode='22023';
  elsif v_type not in(
    'RECEIPT','RESERVE','RELEASE','PICK','CONSUME','RETURN',
    'ADJUSTMENT_IN','ADJUSTMENT_OUT','WASTE','REVERSAL'
  ) then
    raise exception 'Tipo de movimiento inválido' using errcode='22023';
  end if;

  select *
  into v_balance
  from erp_supply.inventory_balances b
  where b.organization_id=v_org
    and b.material_id=p_material
    and b.variant_id is not distinct from p_variant
    and b.location_id=p_location
  for update;

  if not found then
    if p_on_hand_delta<=0 or p_reserved_delta<>0 or p_committed_delta<>0 then
      raise exception 'No existe saldo disponible para esta operación' using errcode='23514';
    end if;

    insert into erp_supply.inventory_balances(
      organization_id,material_id,variant_id,location_id
    ) values(v_org,p_material,p_variant,p_location)
    on conflict on constraint inventory_balances_identity do nothing;

    select *
    into v_balance
    from erp_supply.inventory_balances b
    where b.organization_id=v_org
      and b.material_id=p_material
      and b.variant_id is not distinct from p_variant
      and b.location_id=p_location
    for update;
  end if;

  v_new_on_hand:=v_balance.on_hand+p_on_hand_delta;
  v_new_reserved:=v_balance.reserved+p_reserved_delta;
  v_new_committed:=v_balance.committed+p_committed_delta;

  if v_new_on_hand<0 or v_new_reserved<0 or v_new_committed<0
     or v_new_on_hand<v_new_reserved+v_new_committed then
    raise exception 'La operación produciría stock negativo o disponibilidad inconsistente'
      using errcode='23514';
  end if;

  update erp_supply.inventory_balances
  set on_hand=v_new_on_hand,
      reserved=v_new_reserved,
      committed=v_new_committed,
      version=version+1,
      updated_at=now()
  where id=v_balance.id;

  insert into erp_supply.inventory_movements(
    organization_id,operation_id,material_id,variant_id,location_id,
    order_id,reservation_id,count_id,reversal_of_movement_id,
    movement_type,quantity,unit,on_hand_delta,reserved_delta,committed_delta,
    actor_profile_id,reference,reason,metadata
  ) values(
    v_org,p_operation,p_material,p_variant,p_location,
    p_order,p_reservation,p_count,p_reversal_of,
    v_type,p_quantity,v_unit,p_on_hand_delta,p_reserved_delta,p_committed_delta,
    v_actor,nullif(btrim(coalesce(p_reference,'')),''),nullif(btrim(coalesce(p_reason,'')),''),
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_movement;

  return v_movement;
end;
$$;

create or replace function erp_private.inventory_refresh_reservation_status(p_reservation uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_quantity numeric;
  v_picked numeric;
  v_released numeric;
  v_resolved numeric;
  v_reserved_remaining numeric;
  v_committed_remaining numeric;
  v_status text;
begin
  select r.quantity,
         coalesce(sum(a.picked_quantity),0),
         coalesce(sum(a.released_quantity),0),
         coalesce(sum(a.consumed_quantity+a.returned_quantity+a.waste_quantity),0)
  into v_quantity,v_picked,v_released,v_resolved
  from erp_supply.inventory_reservations r
  left join erp_supply.inventory_reservation_allocations a on a.reservation_id=r.id
  where r.id=p_reservation
  group by r.id;

  v_reserved_remaining:=greatest(v_quantity-v_picked-v_released,0);
  v_committed_remaining:=greatest(v_picked-v_resolved,0);

  v_status:=case
    when v_reserved_remaining=0 and v_committed_remaining=0 and v_picked>0 then 'CLOSED'
    when v_reserved_remaining=0 and v_picked=0 then 'RELEASED'
    when v_reserved_remaining=0 and v_committed_remaining>0 then 'PICKED'
    when v_picked>0 then 'PARTIALLY_PICKED'
    else 'ACTIVE'
  end;

  update erp_supply.inventory_reservations
  set status=v_status,
      updated_at=now(),
      closed_at=case when v_status in('CLOSED','RELEASED') then coalesce(closed_at,now()) else null end
  where id=p_reservation;

  return v_status;
end;
$$;

revoke all on function erp_private.inventory_require(text) from public,anon,authenticated;
revoke all on function erp_private.inventory_validate_material(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function erp_private.inventory_validate_location(uuid,uuid) from public,anon,authenticated;
revoke all on function erp_private.inventory_begin_operation(text,text) from public,anon,authenticated;
revoke all on function erp_private.inventory_finish_operation(uuid,jsonb) from public,anon,authenticated;
revoke all on function erp_private.inventory_balance_json(uuid) from public,anon,authenticated;
revoke all on function erp_private.inventory_apply_delta(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,numeric,text,numeric,numeric,numeric,text,text,jsonb,uuid
) from public,anon,authenticated;
revoke all on function erp_private.inventory_refresh_reservation_status(uuid) from public,anon,authenticated;

create or replace function public.erp_x_inventory_receive(
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
  v_operation erp_supply.inventory_operations%rowtype;
  v_material uuid:=(p_payload->>'materialId')::uuid;
  v_variant uuid:=nullif(p_payload->>'variantId','')::uuid;
  v_location uuid:=(p_payload->>'locationId')::uuid;
  v_order uuid:=nullif(p_payload->>'orderId','')::uuid;
  v_quantity numeric:=(p_payload->>'quantity')::numeric;
  v_unit text:=p_payload->>'unit';
  v_movement uuid;
  v_balance uuid;
  v_result jsonb;
begin
  perform erp_private.inventory_require('create');
  v_operation:=erp_private.inventory_begin_operation('RECEIPT',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;

  if v_order is not null and not exists(
    select 1 from erp_supply.orders o where o.id=v_order and o.organization_id=v_org
  ) then raise exception 'Pedido de referencia inválido' using errcode='22023'; end if;

  v_movement:=erp_private.inventory_apply_delta(
    v_operation.id,v_material,v_variant,v_location,v_order,null,null,
    'RECEIPT',v_quantity,v_unit,v_quantity,0,0,
    p_payload->>'reference',p_payload->>'reason',p_payload->'metadata',null
  );

  select b.id into v_balance
  from erp_supply.inventory_balances b
  where b.organization_id=v_org
    and b.material_id=v_material
    and b.variant_id is not distinct from v_variant
    and b.location_id=v_location;

  v_result:=jsonb_build_object(
    'movementId',v_movement,
    'balance',erp_private.inventory_balance_json(v_balance),
    'contractVersion','1.0.0'
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

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
  v_order uuid:=(p_payload->>'orderId')::uuid;
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
  if not exists(
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

create or replace function erp_private.inventory_reservation_action(
  p_reservation uuid,
  p_quantity numeric,
  p_action text,
  p_reason text,
  p_operation uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_reservation erp_supply.inventory_reservations%rowtype;
  v_allocation erp_supply.inventory_reservation_allocations%rowtype;
  v_available numeric;
  v_total numeric:=0;
  v_requested numeric;
  v_remaining numeric;
  v_take numeric;
  v_status text;
  v_action text:=upper(btrim(p_action));
begin
  select * into v_reservation
  from erp_supply.inventory_reservations r
  where r.id=p_reservation and r.organization_id=v_org
  for update;
  if not found then raise exception 'Reserva no disponible' using errcode='22023'; end if;

  select coalesce(sum(
    case
      when v_action in('RELEASE','PICK')
        then greatest(a.quantity-a.picked_quantity-a.released_quantity,0)
      else greatest(a.picked_quantity-a.consumed_quantity-a.returned_quantity-a.waste_quantity,0)
    end
  ),0)
  into v_total
  from erp_supply.inventory_reservation_allocations a
  where a.reservation_id=p_reservation;

  v_requested:=coalesce(p_quantity,v_total);
  if v_requested<=0 then raise exception 'No hay cantidad disponible para la operación' using errcode='22023'; end if;
  if v_requested>v_total then raise exception 'La cantidad excede el saldo de la reserva' using errcode='23514'; end if;
  v_remaining:=v_requested;

  for v_allocation in
    select a.*
    from erp_supply.inventory_reservation_allocations a
    where a.reservation_id=p_reservation
    order by a.id
    for update
  loop
    v_available:=case
      when v_action in('RELEASE','PICK')
        then greatest(v_allocation.quantity-v_allocation.picked_quantity-v_allocation.released_quantity,0)
      else greatest(
        v_allocation.picked_quantity-v_allocation.consumed_quantity
        -v_allocation.returned_quantity-v_allocation.waste_quantity,0
      )
    end;
    if v_available<=0 then continue; end if;
    v_take:=least(v_remaining,v_available);

    if v_action='RELEASE' then
      update erp_supply.inventory_reservation_allocations
      set released_quantity=released_quantity+v_take,updated_at=now()
      where id=v_allocation.id;
      perform erp_private.inventory_apply_delta(
        p_operation,v_reservation.material_id,v_reservation.variant_id,v_allocation.location_id,
        v_reservation.order_id,v_reservation.id,null,'RELEASE',v_take,v_reservation.unit,
        0,-v_take,0,v_reservation.reference,p_reason,'{}'::jsonb,null
      );
    elsif v_action='PICK' then
      update erp_supply.inventory_reservation_allocations
      set picked_quantity=picked_quantity+v_take,updated_at=now()
      where id=v_allocation.id;
      perform erp_private.inventory_apply_delta(
        p_operation,v_reservation.material_id,v_reservation.variant_id,v_allocation.location_id,
        v_reservation.order_id,v_reservation.id,null,'PICK',v_take,v_reservation.unit,
        0,-v_take,v_take,v_reservation.reference,p_reason,'{}'::jsonb,null
      );
    elsif v_action='CONSUME' then
      update erp_supply.inventory_reservation_allocations
      set consumed_quantity=consumed_quantity+v_take,updated_at=now()
      where id=v_allocation.id;
      perform erp_private.inventory_apply_delta(
        p_operation,v_reservation.material_id,v_reservation.variant_id,v_allocation.location_id,
        v_reservation.order_id,v_reservation.id,null,'CONSUME',v_take,v_reservation.unit,
        -v_take,0,-v_take,v_reservation.reference,p_reason,'{}'::jsonb,null
      );
    elsif v_action='RETURN' then
      update erp_supply.inventory_reservation_allocations
      set returned_quantity=returned_quantity+v_take,updated_at=now()
      where id=v_allocation.id;
      perform erp_private.inventory_apply_delta(
        p_operation,v_reservation.material_id,v_reservation.variant_id,v_allocation.location_id,
        v_reservation.order_id,v_reservation.id,null,'RETURN',v_take,v_reservation.unit,
        0,0,-v_take,v_reservation.reference,p_reason,'{}'::jsonb,null
      );
    elsif v_action='WASTE' then
      update erp_supply.inventory_reservation_allocations
      set waste_quantity=waste_quantity+v_take,updated_at=now()
      where id=v_allocation.id;
      perform erp_private.inventory_apply_delta(
        p_operation,v_reservation.material_id,v_reservation.variant_id,v_allocation.location_id,
        v_reservation.order_id,v_reservation.id,null,'WASTE',v_take,v_reservation.unit,
        -v_take,0,-v_take,v_reservation.reference,p_reason,'{}'::jsonb,null
      );
    else
      raise exception 'Acción de reserva inválida' using errcode='22023';
    end if;

    v_remaining:=v_remaining-v_take;
    exit when v_remaining<=0;
  end loop;

  v_status:=erp_private.inventory_refresh_reservation_status(v_reservation.id);
  return jsonb_build_object(
    'reservationId',v_reservation.id,
    'quantity',v_requested,
    'status',v_status,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function erp_private.inventory_reservation_action(
  uuid,numeric,text,text,uuid
) from public,anon,authenticated;

create or replace function public.erp_x_inventory_release(
  p_reservation_id uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare v_operation erp_supply.inventory_operations%rowtype;v_result jsonb;
begin
  perform erp_private.inventory_require('update');
  v_operation:=erp_private.inventory_begin_operation('RELEASE',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;
  v_result:=erp_private.inventory_reservation_action(
    p_reservation_id,p_quantity,'RELEASE',nullif(btrim(coalesce(p_reason,'')),''),v_operation.id
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_pick(
  p_reservation_id uuid,
  p_quantity numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare v_operation erp_supply.inventory_operations%rowtype;v_result jsonb;
begin
  perform erp_private.inventory_require('update');
  v_operation:=erp_private.inventory_begin_operation('PICK',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;
  v_result:=erp_private.inventory_reservation_action(
    p_reservation_id,p_quantity,'PICK','Picking de reserva',v_operation.id
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_consume(
  p_reservation_id uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare v_operation erp_supply.inventory_operations%rowtype;v_result jsonb;
begin
  perform erp_private.inventory_require('update');
  v_operation:=erp_private.inventory_begin_operation('CONSUME',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;
  v_result:=erp_private.inventory_reservation_action(
    p_reservation_id,p_quantity,'CONSUME',nullif(btrim(coalesce(p_reason,'')),''),v_operation.id
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_return(
  p_reservation_id uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare v_operation erp_supply.inventory_operations%rowtype;v_result jsonb;
begin
  perform erp_private.inventory_require('update');
  if btrim(coalesce(p_reason,''))='' then
    raise exception 'La devolución requiere un motivo' using errcode='22023';
  end if;
  v_operation:=erp_private.inventory_begin_operation('RETURN',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;
  v_result:=erp_private.inventory_reservation_action(
    p_reservation_id,p_quantity,'RETURN',btrim(p_reason),v_operation.id
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_waste(
  p_reservation_id uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare v_operation erp_supply.inventory_operations%rowtype;v_result jsonb;
begin
  perform erp_private.inventory_require('update');
  if btrim(coalesce(p_reason,''))='' then
    raise exception 'El desperdicio requiere un motivo' using errcode='22023';
  end if;
  v_operation:=erp_private.inventory_begin_operation('WASTE',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;
  v_result:=erp_private.inventory_reservation_action(
    p_reservation_id,p_quantity,'WASTE',btrim(p_reason),v_operation.id
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_adjust(
  p_balance_id uuid,
  p_delta numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_balance erp_supply.inventory_balances%rowtype;
  v_material erp_supply.material_master%rowtype;
  v_operation erp_supply.inventory_operations%rowtype;
  v_movement uuid;
  v_result jsonb;
begin
  perform erp_private.inventory_require('approve');
  if p_delta is null or p_delta=0 then
    raise exception 'El ajuste debe modificar la existencia' using errcode='22023';
  end if;
  if btrim(coalesce(p_reason,''))='' then
    raise exception 'El ajuste requiere un motivo' using errcode='22023';
  end if;

  v_operation:=erp_private.inventory_begin_operation('ADJUSTMENT',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;

  select * into v_balance
  from erp_supply.inventory_balances b
  where b.id=p_balance_id and b.organization_id=v_org
  for update;
  if not found then raise exception 'Saldo de inventario no disponible' using errcode='22023'; end if;
  select * into v_material from erp_supply.material_master where id=v_balance.material_id;

  v_movement:=erp_private.inventory_apply_delta(
    v_operation.id,v_balance.material_id,v_balance.variant_id,v_balance.location_id,
    null,null,null,
    case when p_delta>0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end,
    abs(p_delta),v_material.unit,p_delta,0,0,
    'MANUAL_ADJUSTMENT',btrim(p_reason),'{}'::jsonb,null
  );

  v_result:=jsonb_build_object(
    'movementId',v_movement,
    'balance',erp_private.inventory_balance_json(v_balance.id),
    'contractVersion','1.0.0'
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_reverse_movement(
  p_movement_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_source erp_supply.inventory_movements%rowtype;
  v_operation erp_supply.inventory_operations%rowtype;
  v_movement uuid;
  v_result jsonb;
begin
  perform erp_private.inventory_require('approve');
  if btrim(coalesce(p_reason,''))='' then
    raise exception 'El reverso requiere un motivo' using errcode='22023';
  end if;

  v_operation:=erp_private.inventory_begin_operation('REVERSAL',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;

  select * into v_source
  from erp_supply.inventory_movements m
  where m.id=p_movement_id and m.organization_id=v_org
  for share;
  if not found then raise exception 'Movimiento no encontrado' using errcode='22023'; end if;
  if v_source.reservation_id is not null or v_source.movement_type not in(
    'RECEIPT','ADJUSTMENT_IN','ADJUSTMENT_OUT'
  ) then
    raise exception 'Este movimiento debe corregirse mediante el flujo operativo correspondiente'
      using errcode='22023';
  end if;
  if exists(
    select 1 from erp_supply.inventory_movements m
    where m.reversal_of_movement_id=v_source.id
  ) then raise exception 'El movimiento ya fue reversado' using errcode='23505'; end if;

  v_movement:=erp_private.inventory_apply_delta(
    v_operation.id,v_source.material_id,v_source.variant_id,v_source.location_id,
    v_source.order_id,null,null,'REVERSAL',v_source.quantity,v_source.unit,
    -v_source.on_hand_delta,-v_source.reserved_delta,-v_source.committed_delta,
    coalesce(v_source.reference,'REVERSAL'),btrim(p_reason),
    jsonb_build_object('reversalOf',v_source.id),v_source.id
  );

  v_result:=jsonb_build_object(
    'movementId',v_movement,
    'reversalOf',v_source.id,
    'contractVersion','1.0.0'
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

revoke all on function public.erp_x_inventory_receive(jsonb,text) from public,anon;
revoke all on function public.erp_x_inventory_reserve(jsonb,text) from public,anon;
revoke all on function public.erp_x_inventory_release(uuid,numeric,text,text) from public,anon;
revoke all on function public.erp_x_inventory_pick(uuid,numeric,text) from public,anon;
revoke all on function public.erp_x_inventory_consume(uuid,numeric,text,text) from public,anon;
revoke all on function public.erp_x_inventory_return(uuid,numeric,text,text) from public,anon;
revoke all on function public.erp_x_inventory_waste(uuid,numeric,text,text) from public,anon;
revoke all on function public.erp_x_inventory_adjust(uuid,numeric,text,text) from public,anon;
revoke all on function public.erp_x_inventory_reverse_movement(uuid,text,text) from public,anon;

grant execute on function public.erp_x_inventory_receive(jsonb,text) to authenticated;
grant execute on function public.erp_x_inventory_reserve(jsonb,text) to authenticated;
grant execute on function public.erp_x_inventory_release(uuid,numeric,text,text) to authenticated;
grant execute on function public.erp_x_inventory_pick(uuid,numeric,text) to authenticated;
grant execute on function public.erp_x_inventory_consume(uuid,numeric,text,text) to authenticated;
grant execute on function public.erp_x_inventory_return(uuid,numeric,text,text) to authenticated;
grant execute on function public.erp_x_inventory_waste(uuid,numeric,text,text) to authenticated;
grant execute on function public.erp_x_inventory_adjust(uuid,numeric,text,text) to authenticated;
grant execute on function public.erp_x_inventory_reverse_movement(uuid,text,text) to authenticated;

commit;
