begin;

create or replace function public.erp_x_picking_create(
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
  v_job uuid;
  v_line jsonb;
  v_result jsonb;
begin
  perform erp_private.supply_require('picking','create');
  v_op:=erp_private.supply_begin_operation('PICKING_CREATE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  if not exists(
    select 1 from erp_supply.orders o
    where o.id=v_order and o.organization_id=v_org and o.current_step_code='ALISTAMIENTO'
  ) then raise exception 'El pedido no está disponible en Alistamiento' using errcode='22023'; end if;

  insert into erp_supply.picking_jobs(
    organization_id,order_id,order_task_id,assigned_profile_id,created_by,metadata
  ) values(v_org,v_order,v_task,v_actor,v_actor,coalesce(p_payload->'metadata','{}'::jsonb))
  returning id into v_job;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    if not exists(
      select 1 from erp_supply.order_items oi
      where oi.id=(v_line->>'orderItemId')::uuid and oi.order_id=v_order
    ) then raise exception 'Línea de Alistamiento no pertenece al pedido' using errcode='22023'; end if;
    insert into erp_supply.picking_job_lines(
      job_id,order_item_id,material_id,variant_id,requested_quantity,unit,metadata
    ) values(
      v_job,(v_line->>'orderItemId')::uuid,(v_line->>'materialId')::uuid,
      nullif(v_line->>'variantId','')::uuid,(v_line->>'quantity')::numeric,
      upper(btrim(v_line->>'unit')),coalesce(v_line->'metadata','{}'::jsonb)
    );
  end loop;

  update erp_supply.picking_jobs set status='IN_PROGRESS',started_at=now() where id=v_job;
  perform erp_private.supply_event(v_order,'PICKING_STARTED','PICKING_JOB',v_job,p_idempotency_key,'{}'::jsonb);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_job,'status','IN_PROGRESS','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_picking_sync_line(
  p_line_id uuid,p_reservation_id uuid,p_picked_quantity numeric,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_line erp_supply.picking_job_lines%rowtype;
  v_job erp_supply.picking_jobs%rowtype;
  v_res erp_supply.inventory_reservations%rowtype;
  v_status text;
  v_result jsonb;
begin
  perform erp_private.supply_require('picking','update');
  v_op:=erp_private.supply_begin_operation('PICKING_SYNC_LINE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select * into v_line from erp_supply.picking_job_lines where id=p_line_id for update;
  if not found then raise exception 'Línea de Alistamiento no disponible' using errcode='22023'; end if;
  select * into v_job from erp_supply.picking_jobs
  where id=v_line.job_id and organization_id=erp_private.current_org_id() for update;
  if not found then raise exception 'Alistamiento no disponible' using errcode='42501'; end if;

  select * into v_res from erp_supply.inventory_reservations
  where id=p_reservation_id and organization_id=v_job.organization_id and order_id=v_job.order_id
    and material_id=v_line.material_id and variant_id is not distinct from v_line.variant_id;
  if not found then raise exception 'Reserva de inventario incompatible con Alistamiento' using errcode='23514'; end if;
  if p_picked_quantity<=0 or p_picked_quantity>v_line.requested_quantity then
    raise exception 'Cantidad alistada inválida' using errcode='23514';
  end if;

  v_status:=case when p_picked_quantity=v_line.requested_quantity then 'COMPLETED' else 'PARTIAL' end;
  update erp_supply.picking_job_lines
  set reservation_id=p_reservation_id,picked_quantity=p_picked_quantity,status=v_status
  where id=v_line.id;

  if not exists(
    select 1 from erp_supply.picking_job_lines l
    where l.job_id=v_job.id and l.status not in('COMPLETED','CANCELLED')
  ) then
    update erp_supply.picking_jobs set status='COMPLETED',completed_at=now() where id=v_job.id;
    perform erp_private.supply_grant_order_contract(v_job.order_id,'PICKING_COMPLETE',jsonb_build_object('pickingJobId',v_job.id));
  else
    update erp_supply.picking_jobs set status='PARTIAL' where id=v_job.id;
  end if;

  perform erp_private.supply_event(v_job.order_id,'PICKING_LINE_SYNCED','PICKING_JOB',v_job.id,p_idempotency_key,jsonb_build_object('lineId',v_line.id,'status',v_status));
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_line.id,'status',v_status,'contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_cutting_create(
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
  v_job uuid;
  v_line jsonb;
  v_res erp_supply.inventory_reservations%rowtype;
  v_available numeric;
  v_result jsonb;
begin
  perform erp_private.supply_require('cutting','create');
  v_op:=erp_private.supply_begin_operation('CUTTING_CREATE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  if not exists(
    select 1 from erp_supply.orders o
    where o.id=v_order and o.organization_id=v_org and o.current_step_code='CORTE' and o.requires_cut
  ) then raise exception 'El pedido no está disponible en Corte' using errcode='22023'; end if;

  insert into erp_supply.cutting_jobs(
    organization_id,order_id,order_task_id,assigned_profile_id,created_by,metadata
  ) values(v_org,v_order,v_task,v_actor,v_actor,coalesce(p_payload->'metadata','{}'::jsonb))
  returning id into v_job;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    select * into v_res from erp_supply.inventory_reservations
    where id=(v_line->>'reservationId')::uuid and organization_id=v_org and order_id=v_order;
    if not found then raise exception 'Reserva inválida para Corte' using errcode='23514'; end if;

    select coalesce(sum(a.picked_quantity-a.consumed_quantity-a.returned_quantity-a.waste_quantity),0)
    into v_available
    from erp_supply.inventory_reservation_allocations a
    where a.reservation_id=v_res.id;

    if (v_line->>'plannedQuantity')::numeric>v_available then
      raise exception 'La cantidad de Corte excede el material alistado' using errcode='23514';
    end if;

    insert into erp_supply.cutting_job_lines(
      job_id,order_item_id,material_id,variant_id,reservation_id,planned_quantity,
      cut_length_each,unit,metadata
    ) values(
      v_job,(v_line->>'orderItemId')::uuid,(v_line->>'materialId')::uuid,
      nullif(v_line->>'variantId','')::uuid,v_res.id,(v_line->>'plannedQuantity')::numeric,
      nullif(v_line->>'cutLengthEach','')::numeric,upper(btrim(v_line->>'unit')),
      coalesce(v_line->'metadata','{}'::jsonb)
    );
  end loop;

  perform erp_private.supply_event(v_order,'CUTTING_CREATED','CUTTING_JOB',v_job,p_idempotency_key,'{}'::jsonb);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_job,'status','OPEN','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_cutting_start(p_job_id uuid,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_actor uuid:=erp_private.current_profile_id();
  v_job erp_supply.cutting_jobs%rowtype;
  v_result jsonb;
begin
  perform erp_private.supply_require('cutting','update');
  v_op:=erp_private.supply_begin_operation('CUTTING_START',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select * into v_job from erp_supply.cutting_jobs
  where id=p_job_id and organization_id=erp_private.current_org_id() for update;
  if not found then raise exception 'Trabajo de Corte no disponible' using errcode='42501'; end if;
  if v_job.status='IN_PROGRESS' and v_job.assigned_profile_id=v_actor then
    v_result:=jsonb_build_object('success',true,'idempotent',true,'id',v_job.id,'status',v_job.status,'contractVersion','1.0.0');
    perform erp_private.supply_finish_operation(v_op.id,v_result); return v_result;
  end if;
  if v_job.status<>'OPEN' then raise exception 'El trabajo de Corte ya fue tomado' using errcode='40001'; end if;
  if v_job.assigned_profile_id is not null and v_job.assigned_profile_id<>v_actor then
    raise exception 'El trabajo de Corte ya fue asignado a otra persona' using errcode='40001';
  end if;

  update erp_supply.cutting_jobs
  set status='IN_PROGRESS',assigned_profile_id=v_actor,started_by=v_actor,started_at=now()
  where id=v_job.id and status='OPEN'
  returning * into v_job;
  if not found then raise exception 'El trabajo de Corte ya fue tomado' using errcode='40001'; end if;

  update erp_supply.cutting_job_lines set status='IN_PROGRESS' where job_id=v_job.id and status='PENDING';
  perform erp_private.supply_event(v_job.order_id,'CUTTING_STARTED','CUTTING_JOB',v_job.id,p_idempotency_key,'{}'::jsonb);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_job.id,'status','IN_PROGRESS','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_cutting_sync_line(
  p_line_id uuid,p_consumed numeric,p_reusable numeric,p_waste numeric,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_line erp_supply.cutting_job_lines%rowtype;
  v_job erp_supply.cutting_jobs%rowtype;
  v_total numeric:=coalesce(p_consumed,0)+coalesce(p_reusable,0)+coalesce(p_waste,0);
  v_allocated numeric;
  v_status text;
  v_result jsonb;
begin
  perform erp_private.supply_require('cutting','update');
  v_op:=erp_private.supply_begin_operation('CUTTING_SYNC_LINE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select * into v_line from erp_supply.cutting_job_lines where id=p_line_id for update;
  if not found then raise exception 'Línea de Corte no disponible' using errcode='22023'; end if;
  select * into v_job from erp_supply.cutting_jobs
  where id=v_line.job_id and organization_id=erp_private.current_org_id() for update;
  if not found or v_job.status<>'IN_PROGRESS' then raise exception 'Corte no está en ejecución' using errcode='23514'; end if;
  if v_job.assigned_profile_id<>erp_private.current_profile_id() and not erp_private.can_access_module('cutting','approve') then
    raise exception 'Solo el responsable puede registrar el Corte' using errcode='42501';
  end if;
  if v_total<=0 or v_total>v_line.planned_quantity then
    raise exception 'Resultado de Corte inválido' using errcode='23514';
  end if;

  select coalesce(sum(a.consumed_quantity+a.returned_quantity+a.waste_quantity),0)
  into v_allocated from erp_supply.inventory_reservation_allocations a
  where a.reservation_id=v_line.reservation_id;
  if v_allocated<v_total then
    raise exception 'Inventory aún no refleja el resultado de Corte' using errcode='23514';
  end if;

  v_status:=case when v_total=v_line.planned_quantity then 'COMPLETED' else 'IN_PROGRESS' end;
  update erp_supply.cutting_job_lines
  set consumed_quantity=p_consumed,reusable_quantity=p_reusable,waste_quantity=p_waste,status=v_status
  where id=v_line.id;

  perform erp_private.supply_event(v_job.order_id,'CUTTING_LINE_SYNCED','CUTTING_JOB',v_job.id,p_idempotency_key,jsonb_build_object('lineId',v_line.id,'status',v_status));
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_line.id,'status',v_status,'contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_cutting_complete(
  p_job_id uuid,p_evidence_id uuid,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_op erp_supply.supply_operations%rowtype;
  v_actor uuid:=erp_private.current_profile_id();
  v_job erp_supply.cutting_jobs%rowtype;
  v_result jsonb;
begin
  perform erp_private.supply_require('cutting','update');
  v_op:=erp_private.supply_begin_operation('CUTTING_COMPLETE',p_idempotency_key);
  if v_op.result is not null then return v_op.result; end if;

  select * into v_job from erp_supply.cutting_jobs
  where id=p_job_id and organization_id=erp_private.current_org_id() for update;
  if not found then raise exception 'Trabajo de Corte no disponible' using errcode='42501'; end if;
  if v_job.status='COMPLETED' then
    v_result:=jsonb_build_object('success',true,'idempotent',true,'id',v_job.id,'status','COMPLETED','contractVersion','1.0.0');
    perform erp_private.supply_finish_operation(v_op.id,v_result); return v_result;
  end if;
  if v_job.status<>'IN_PROGRESS' then raise exception 'Corte no está listo para cierre' using errcode='23514'; end if;
  if exists(select 1 from erp_supply.cutting_job_lines l where l.job_id=v_job.id and l.status<>'COMPLETED') then
    raise exception 'Faltan líneas de Corte por completar' using errcode='23514';
  end if;
  if p_evidence_id is null or not exists(
    select 1 from erp_supply.order_evidence e
    where e.id=p_evidence_id and e.order_id=v_job.order_id
      and coalesce(e.mime_type,'') like 'image/%'
  ) then raise exception 'Corte requiere evidencia fotográfica válida' using errcode='23514'; end if;

  update erp_supply.cutting_jobs
  set status='COMPLETED',completed_by=v_actor,completed_at=now(),evidence_id=p_evidence_id
  where id=v_job.id;
  perform erp_private.supply_grant_order_contract(v_job.order_id,'CUTTING_COMPLETE',jsonb_build_object('cuttingJobId',v_job.id,'evidenceId',p_evidence_id));
  perform erp_private.supply_event(v_job.order_id,'CUTTING_COMPLETED','CUTTING_JOB',v_job.id,p_idempotency_key,jsonb_build_object('evidenceId',p_evidence_id));
  v_result:=jsonb_build_object('success',true,'idempotent',false,'id',v_job.id,'status','COMPLETED','contractVersion','1.0.0');
  perform erp_private.supply_finish_operation(v_op.id,v_result);
  return v_result;
end;
$$;

revoke all on function public.erp_x_picking_create(jsonb,text) from public,anon;
revoke all on function public.erp_x_picking_sync_line(uuid,uuid,numeric,text) from public,anon;
revoke all on function public.erp_x_cutting_create(jsonb,text) from public,anon;
revoke all on function public.erp_x_cutting_start(uuid,text) from public,anon;
revoke all on function public.erp_x_cutting_sync_line(uuid,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.erp_x_cutting_complete(uuid,uuid,text) from public,anon;

grant execute on function public.erp_x_picking_create(jsonb,text) to authenticated;
grant execute on function public.erp_x_picking_sync_line(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.erp_x_cutting_create(jsonb,text) to authenticated;
grant execute on function public.erp_x_cutting_start(uuid,text) to authenticated;
grant execute on function public.erp_x_cutting_sync_line(uuid,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.erp_x_cutting_complete(uuid,uuid,text) to authenticated;

commit;
