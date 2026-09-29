begin;

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
