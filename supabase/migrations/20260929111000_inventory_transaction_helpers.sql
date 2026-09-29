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

commit;
