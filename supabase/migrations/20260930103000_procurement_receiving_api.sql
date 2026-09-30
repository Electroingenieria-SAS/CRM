begin;

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

  select * into v_op from erp_supply.supply_operations
  where organization_id=v_org and operation_key=btrim(p_key)
  for update;
  if found then return v_op; end if;

  begin
    insert into erp_supply.supply_operations(
      organization_id,operation_key,operation_type,actor_profile_id
    ) values(v_org,btrim(p_key),upper(btrim(p_type)),v_actor)
    returning * into v_op;
  exception when unique_violation then
    select * into v_op from erp_supply.supply_operations
    where organization_id=v_org and operation_key=btrim(p_key)
    for update;
  end;
  return v_op;
end;
$$;

create or replace function public.erp_x_order_reception_create(
  p_payload jsonb,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_order uuid:=(p_payload->>'orderId')::uuid;
  v_task uuid:=nullif(p_payload->>'orderTaskId','')::uuid;
  v_pick uuid:=nullif(p_payload->>'pickingProfileId','')::uuid;
  v_cut uuid:=nullif(p_payload->>'cuttingProfileId','')::uuid;
  v_id uuid;
  v_line jsonb;
  v_result jsonb;
begin
  perform erp_private.supply_require('receiving','create');
  v_op:=erp_private.supply_begin_operation('ORDER_RECEPTION_CREATE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  if not exists(
    select 1 from erp_supply.orders o
    where o.id=v_order and o.organization_id=v_org and o.current_step_code='RECEPCION_PEDIDO'
  ) then raise exception 'El pedido no está disponible en Recepción de pedido' using errcode='22023'; end if;

  if v_task is not null and not exists(
    select 1 from erp_supply.order_tasks t
    where t.id=v_task and t.order_id=v_order and t.step_code='RECEPCION_PEDIDO'
  ) then raise exception 'La tarea de Recepción no corresponde al pedido' using errcode='22023'; end if;

  if v_pick is not null and not exists(
    select 1 from erp_supply.profiles p join erp_supply.profile_roles pr on pr.profile_id=p.id
    where p.id=v_pick and p.organization_id=v_org and p.active and pr.role_code='aux_logistica'
  ) then raise exception 'Responsable de Alistamiento inválido' using errcode='22023'; end if;

  if v_cut is not null and not exists(
    select 1 from erp_supply.profiles p join erp_supply.profile_roles pr on pr.profile_id=p.id
    where p.id=v_cut and p.organization_id=v_org and p.active and pr.role_code='auxiliar_corte'
  ) then raise exception 'Responsable de Corte inválido' using errcode='22023'; end if;

  insert into erp_supply.order_receptions(
    organization_id,order_id,order_task_id,picking_profile_id,cutting_profile_id,created_by,metadata
  ) values(v_org,v_order,v_task,v_pick,v_cut,v_actor,coalesce(p_payload->'metadata','{}'::jsonb))
  returning id into v_id;

  if jsonb_typeof(coalesce(p_payload->'lines','[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_payload->'lines','[]'::jsonb))=0 then
    raise exception 'Recepción de pedido requiere materiales' using errcode='22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    if not exists(
      select 1 from erp_supply.order_items i
      where i.id=(v_line->>'orderItemId')::uuid and i.order_id=v_order
    ) then raise exception 'Una línea no pertenece al pedido' using errcode='22023'; end if;
    if not exists(
      select 1 from erp_supply.material_master m
      where m.id=(v_line->>'materialId')::uuid and m.organization_id=v_org and m.active
    ) then raise exception 'Material de Recepción inválido' using errcode='22023'; end if;

    insert into erp_supply.order_reception_lines(
      reception_id,order_item_id,material_id,variant_id,preferred_location_id,
      quantity,unit,requires_cut,cut_length_each,metadata
    ) values(
      v_id,(v_line->>'orderItemId')::uuid,(v_line->>'materialId')::uuid,
      nullif(v_line->>'variantId','')::uuid,nullif(v_line->>'locationId','')::uuid,
      (v_line->>'quantity')::numeric,upper(btrim(v_line->>'unit')),
      coalesce((v_line->>'requiresCut')::boolean,false),
      nullif(v_line->>'cutLengthEach','')::numeric,
      coalesce(v_line->'metadata','{}'::jsonb)
    );
  end loop;

  perform erp_private.supply_event(v_order,'ORDER_RECEPTION_CREATED','ORDER_RECEPTION',v_id,p_idempotency_key,'{}'::jsonb);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_id,'status','DRAFT','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_order_reception_confirm(
  p_reception_id uuid,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_actor uuid:=erp_private.current_profile_id();
  v_rec erp_supply.order_receptions%rowtype;
  v_result jsonb;
begin
  perform erp_private.supply_require('receiving','update');
  v_op:=erp_private.supply_begin_operation('ORDER_RECEPTION_CONFIRM',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select * into v_rec from erp_supply.order_receptions
  where id=p_reception_id and organization_id=erp_private.current_org_id()
  for update;
  if not found then raise exception 'Recepción de pedido no disponible' using errcode='22023'; end if;
  if v_rec.status='CONFIRMED' then
    v_result:=jsonb_build_object('success',true,'idempotent',true,'id',v_rec.id,'status',v_rec.status,'contractVersion','1.0.0');
    perform erp_private.supply_finish_operation(v_op.id,v_result); return v_result;
  end if;
  if v_rec.status<>'DRAFT' then raise exception 'La Recepción no puede confirmarse' using errcode='23514'; end if;

  if exists(
    select 1 from erp_supply.order_items oi
    where oi.order_id=v_rec.order_id
      and not exists(
        select 1 from erp_supply.order_reception_lines l
        where l.reception_id=v_rec.id and l.order_item_id=oi.id
      )
  ) then raise exception 'Todos los materiales del pedido deben estar relacionados' using errcode='23514'; end if;

  if exists(
    select 1
    from erp_supply.order_reception_lines l
    join erp_supply.order_items oi on oi.id=l.order_item_id
    where l.reception_id=v_rec.id
      and oi.requires_cut is distinct from l.requires_cut
  ) then raise exception 'La necesidad de corte no coincide con el pedido' using errcode='23514'; end if;

  update erp_supply.order_receptions
  set status='CONFIRMED',validated_by=v_actor,confirmed_at=now()
  where id=v_rec.id;

  perform erp_private.supply_grant_order_contract(
    v_rec.order_id,'ORDER_RECEPTION_READY',
    jsonb_build_object('receptionId',v_rec.id,'pickingProfileId',v_rec.picking_profile_id,'cuttingProfileId',v_rec.cutting_profile_id)
  );
  perform erp_private.supply_event(v_rec.order_id,'ORDER_RECEPTION_CONFIRMED','ORDER_RECEPTION',v_rec.id,p_idempotency_key,'{}'::jsonb);

  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_rec.id,'status','CONFIRMED','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_procurement_request(
  p_payload jsonb,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_order uuid:=(p_payload->>'orderId')::uuid;
  v_id uuid;
  v_line jsonb;
  v_result jsonb;
begin
  perform erp_private.supply_require('purchasing','create');
  v_op:=erp_private.supply_begin_operation('PROCUREMENT_REQUEST',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  if not exists(
    select 1 from erp_supply.orders o
    where o.id=v_order and o.organization_id=v_org and (o.requires_purchase or o.order_type_code='PVE')
  ) then raise exception 'El pedido no requiere Compras' using errcode='22023'; end if;

  insert into erp_supply.purchase_requests(organization_id,order_id,requested_by,metadata)
  values(v_org,v_order,v_actor,coalesce(p_payload->'metadata','{}'::jsonb))
  returning id into v_id;

  if jsonb_typeof(coalesce(p_payload->'lines','[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_payload->'lines','[]'::jsonb))=0 then
    raise exception 'La solicitud requiere al menos un material' using errcode='22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    if not exists(
      select 1 from erp_supply.order_items i
      where i.id=(v_line->>'orderItemId')::uuid and i.order_id=v_order
    ) then raise exception 'Material no pertenece al pedido' using errcode='22023'; end if;

    insert into erp_supply.purchase_request_lines(
      request_id,order_item_id,material_id,variant_id,quantity,unit,note,metadata
    ) values(
      v_id,(v_line->>'orderItemId')::uuid,(v_line->>'materialId')::uuid,
      nullif(v_line->>'variantId','')::uuid,(v_line->>'quantity')::numeric,
      upper(btrim(v_line->>'unit')),nullif(btrim(coalesce(v_line->>'note','')),''),
      coalesce(v_line->'metadata','{}'::jsonb)
    );
  end loop;

  perform erp_private.supply_event(v_order,'PROCUREMENT_REQUESTED','PURCHASE_REQUEST',v_id,p_idempotency_key,'{}'::jsonb);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_id,'status','REQUESTED','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
exception when unique_violation then
  raise exception 'El pedido ya tiene una solicitud de compra' using errcode='23505';
end;
$$;

create or replace function public.erp_x_procurement_issue_order(
  p_payload jsonb,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_request uuid:=(p_payload->>'requestId')::uuid;
  v_supplier uuid:=(p_payload->>'supplierId')::uuid;
  v_po uuid;
  v_line jsonb;
  v_request_line erp_supply.purchase_request_lines%rowtype;
  v_already numeric;
  v_qty numeric;
  v_order uuid;
  v_result jsonb;
begin
  perform erp_private.supply_require('purchasing','update');
  v_op:=erp_private.supply_begin_operation('PROCUREMENT_ISSUE_PO',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select r.order_id into v_order from erp_supply.purchase_requests r
  where r.id=v_request and r.organization_id=v_org and r.status in('REQUESTED','ORDERED','PARTIALLY_RECEIVED');
  if v_order is null then raise exception 'Solicitud de compra no disponible' using errcode='22023'; end if;
  if not exists(select 1 from erp_supply.suppliers s where s.id=v_supplier and s.organization_id=v_org and s.active)
    then raise exception 'Proveedor inválido' using errcode='22023'; end if;

  insert into erp_supply.purchase_orders(
    organization_id,request_id,supplier_id,external_reference,issued_by,metadata
  ) values(
    v_org,v_request,v_supplier,nullif(btrim(coalesce(p_payload->>'externalReference','')),''),
    v_actor,coalesce(p_payload->'metadata','{}'::jsonb)
  ) returning id into v_po;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    select * into v_request_line from erp_supply.purchase_request_lines
    where id=(v_line->>'requestLineId')::uuid and request_id=v_request;
    if not found then raise exception 'Línea de solicitud inválida' using errcode='22023'; end if;
    v_qty:=(v_line->>'quantity')::numeric;
    select coalesce(sum(pol.ordered_quantity),0) into v_already
    from erp_supply.purchase_order_lines pol
    join erp_supply.purchase_orders po on po.id=pol.purchase_order_id
    where pol.request_line_id=v_request_line.id and po.status<>'CANCELLED';
    if v_qty<=0 or v_already+v_qty>v_request_line.quantity then
      raise exception 'La cantidad ordenada excede la solicitud' using errcode='23514';
    end if;
    insert into erp_supply.purchase_order_lines(
      purchase_order_id,request_line_id,ordered_quantity,unit,unit_price,metadata
    ) values(
      v_po,v_request_line.id,v_qty,v_request_line.unit,
      nullif(v_line->>'unitPrice','')::numeric,coalesce(v_line->'metadata','{}'::jsonb)
    );
  end loop;

  update erp_supply.purchase_requests set status='ORDERED' where id=v_request;
  perform erp_private.supply_event(v_order,'PURCHASE_ORDER_ISSUED','PURCHASE_ORDER',v_po,p_idempotency_key,jsonb_build_object('supplierId',v_supplier));
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_po,'status','ORDERED','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_receiving_create(
  p_payload jsonb,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_po uuid:=nullif(p_payload->>'purchaseOrderId','')::uuid;
  v_order uuid:=nullif(p_payload->>'orderId','')::uuid;
  v_receipt uuid;
  v_line jsonb;
  v_po_line erp_supply.purchase_order_lines%rowtype;
  v_outstanding numeric;
  v_total numeric;
  v_result jsonb;
begin
  perform erp_private.supply_require('receiving','create');
  v_op:=erp_private.supply_begin_operation('GOODS_RECEIPT_CREATE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  if v_po is not null then
    select pr.order_id into v_order
    from erp_supply.purchase_orders po
    join erp_supply.purchase_requests pr on pr.id=po.request_id
    where po.id=v_po and po.organization_id=v_org and po.status in('ORDERED','PARTIALLY_RECEIVED');
    if v_order is null then raise exception 'Orden de compra no disponible' using errcode='22023'; end if;
  end if;

  insert into erp_supply.goods_receipts(
    organization_id,purchase_order_id,order_id,receipt_type,document_reference,received_by,metadata
  ) values(
    v_org,v_po,v_order,upper(coalesce(nullif(p_payload->>'receiptType',''),'PURCHASE')),
    nullif(btrim(coalesce(p_payload->>'documentReference','')),''),v_actor,
    coalesce(p_payload->'metadata','{}'::jsonb)
  ) returning id into v_receipt;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    if nullif(v_line->>'purchaseOrderLineId','') is not null then
      select * into v_po_line from erp_supply.purchase_order_lines
      where id=(v_line->>'purchaseOrderLineId')::uuid and purchase_order_id=v_po;
      if not found then raise exception 'Línea de orden de compra inválida' using errcode='22023'; end if;
      v_outstanding:=v_po_line.ordered_quantity-v_po_line.received_quantity;
      v_total:=coalesce((v_line->>'acceptedQuantity')::numeric,0)+coalesce((v_line->>'rejectedQuantity')::numeric,0);
      if v_total>v_outstanding then
        raise exception 'La recepción excede la cantidad pendiente de la orden' using errcode='23514';
      end if;
    end if;

    insert into erp_supply.goods_receipt_lines(
      receipt_id,purchase_order_line_id,material_id,variant_id,location_id,expected_quantity,
      accepted_quantity,rejected_quantity,unit,incident_code,note,metadata
    ) values(
      v_receipt,nullif(v_line->>'purchaseOrderLineId','')::uuid,(v_line->>'materialId')::uuid,
      nullif(v_line->>'variantId','')::uuid,(v_line->>'locationId')::uuid,
      nullif(v_line->>'expectedQuantity','')::numeric,
      coalesce((v_line->>'acceptedQuantity')::numeric,0),coalesce((v_line->>'rejectedQuantity')::numeric,0),
      upper(btrim(v_line->>'unit')),nullif(v_line->>'incidentCode',''),
      nullif(btrim(coalesce(v_line->>'note','')),''),coalesce(v_line->'metadata','{}'::jsonb)
    );
  end loop;

  perform erp_private.supply_event(v_order,'GOODS_RECEIPT_CREATED','GOODS_RECEIPT',v_receipt,p_idempotency_key,'{}'::jsonb);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_receipt,'status','DRAFT','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_receiving_confirm_line(
  p_line_id uuid,p_inventory_movement_id uuid,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_line erp_supply.goods_receipt_lines%rowtype;
  v_receipt erp_supply.goods_receipts%rowtype;
  v_movement erp_supply.inventory_movements%rowtype;
  v_status text;
  v_result jsonb;
begin
  perform erp_private.supply_require('receiving','update');
  v_op:=erp_private.supply_begin_operation('GOODS_RECEIPT_CONFIRM_LINE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select * into v_line from erp_supply.goods_receipt_lines where id=p_line_id for update;
  if not found then raise exception 'Línea de recepción no disponible' using errcode='22023'; end if;
  select * into v_receipt from erp_supply.goods_receipts
  where id=v_line.receipt_id and organization_id=erp_private.current_org_id() for update;
  if not found then raise exception 'Recepción no disponible' using errcode='42501'; end if;

  if v_line.status<>'PENDING' then
    v_result:=jsonb_build_object('success',true,'idempotent',true,'id',v_line.id,'status',v_line.status,'contractVersion','1.0.0');
    perform erp_private.supply_finish_operation(v_op.id,v_result); return v_result;
  end if;

  if v_line.accepted_quantity>0 then
    if p_inventory_movement_id is null then raise exception 'Falta movimiento de inventario' using errcode='23514'; end if;
    select * into v_movement from erp_supply.inventory_movements
    where id=p_inventory_movement_id and organization_id=v_receipt.organization_id;
    if not found or v_movement.movement_type<>'RECEIPT'
       or v_movement.material_id<>v_line.material_id
       or v_movement.variant_id is distinct from v_line.variant_id
       or v_movement.location_id<>v_line.location_id
       or v_movement.quantity<>v_line.accepted_quantity then
      raise exception 'El movimiento de inventario no corresponde a la recepción' using errcode='23514';
    end if;
  end if;

  v_status:=case
    when v_line.accepted_quantity>0 and v_line.rejected_quantity>0 then 'PARTIAL'
    when v_line.accepted_quantity>0 then 'ACCEPTED'
    else 'REJECTED'
  end;

  update erp_supply.goods_receipt_lines
  set status=v_status,inventory_movement_id=p_inventory_movement_id
  where id=v_line.id;

  if v_line.purchase_order_line_id is not null and v_line.accepted_quantity>0 then
    update erp_supply.purchase_order_lines
    set received_quantity=received_quantity+v_line.accepted_quantity
    where id=v_line.purchase_order_line_id;
  end if;

  if not exists(
    select 1 from erp_supply.goods_receipt_lines l
    where l.receipt_id=v_receipt.id and l.status='PENDING'
  ) then
    update erp_supply.goods_receipts
    set status='COMPLETED',completed_at=now()
    where id=v_receipt.id;
  else
    update erp_supply.goods_receipts set status='PARTIALLY_RECEIVED' where id=v_receipt.id;
  end if;

  if v_receipt.purchase_order_id is not null then
    if not exists(
      select 1 from erp_supply.purchase_order_lines pol
      where pol.purchase_order_id=v_receipt.purchase_order_id
        and pol.received_quantity<pol.ordered_quantity
    ) then
      update erp_supply.purchase_orders set status='RECEIVED',completed_at=now()
      where id=v_receipt.purchase_order_id;
    else
      update erp_supply.purchase_orders set status='PARTIALLY_RECEIVED'
      where id=v_receipt.purchase_order_id;
    end if;

    update erp_supply.purchase_requests pr
    set status=case
      when exists(
        select 1 from erp_supply.purchase_orders po
        join erp_supply.purchase_order_lines pol on pol.purchase_order_id=po.id
        where po.request_id=pr.id and po.status<>'CANCELLED'
          and pol.received_quantity<pol.ordered_quantity
      ) then 'PARTIALLY_RECEIVED' else 'RECEIVED' end,
      completed_at=case
        when not exists(
          select 1 from erp_supply.purchase_orders po
          join erp_supply.purchase_order_lines pol on pol.purchase_order_id=po.id
          where po.request_id=pr.id and po.status<>'CANCELLED'
            and pol.received_quantity<pol.ordered_quantity
        ) then now() else null end
    where pr.id=(select po.request_id from erp_supply.purchase_orders po where po.id=v_receipt.purchase_order_id);

    if exists(
      select 1 from erp_supply.purchase_requests pr
      join erp_supply.purchase_orders po on po.request_id=pr.id
      where po.id=v_receipt.purchase_order_id and pr.status='RECEIVED'
    ) and v_receipt.order_id is not null then
      perform erp_private.supply_grant_order_contract(
        v_receipt.order_id,'PROCUREMENT_READY',
        jsonb_build_object('receiptId',v_receipt.id,'purchaseOrderId',v_receipt.purchase_order_id)
      );
    end if;
  end if;

  perform erp_private.supply_event(v_receipt.order_id,'GOODS_RECEIPT_LINE_CONFIRMED','GOODS_RECEIPT',v_receipt.id,p_idempotency_key,jsonb_build_object('lineId',v_line.id,'status',v_status));
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_line.id,'status',v_status,'contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

revoke all on function public.erp_x_order_reception_create(jsonb,text) from public,anon;
revoke all on function public.erp_x_order_reception_confirm(uuid,text) from public,anon;
revoke all on function public.erp_x_procurement_request(jsonb,text) from public,anon;
revoke all on function public.erp_x_procurement_issue_order(jsonb,text) from public,anon;
revoke all on function public.erp_x_receiving_create(jsonb,text) from public,anon;
revoke all on function public.erp_x_receiving_confirm_line(uuid,uuid,text) from public,anon;

grant execute on function public.erp_x_order_reception_create(jsonb,text) to authenticated;
grant execute on function public.erp_x_order_reception_confirm(uuid,text) to authenticated;
grant execute on function public.erp_x_procurement_request(jsonb,text) to authenticated;
grant execute on function public.erp_x_procurement_issue_order(jsonb,text) to authenticated;
grant execute on function public.erp_x_receiving_create(jsonb,text) to authenticated;
grant execute on function public.erp_x_receiving_confirm_line(uuid,uuid,text) to authenticated;

commit;
