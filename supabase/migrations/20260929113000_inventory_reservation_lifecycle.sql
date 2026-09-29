begin;

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

commit;
