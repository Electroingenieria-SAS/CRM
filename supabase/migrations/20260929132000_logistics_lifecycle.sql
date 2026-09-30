begin;

create or replace function public.erp_x_logistics_save_guide(
  p_shipment_id uuid,
  p_carrier_id uuid,
  p_tracking_number text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
  v_tracking text:=nullif(trim(coalesce(p_tracking_number,'')),'');
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado para registrar guía' using errcode='42501';
  end if;
  perform erp_private.logistics_lock('GUIDE',p_idempotency_key);

  select * into v_shipment
  from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org
  for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'trackingNumber',v_shipment.tracking_number,
      'contractVersion','1.0.0'
    );
  end if;

  if v_shipment.status<>'READY' then
    raise exception 'La guía solo puede registrarse antes del despacho' using errcode='23514';
  end if;
  if v_shipment.tracking_number is not null then
    raise exception 'La guía ya fue registrada para este despacho' using errcode='23514';
  end if;
  if v_shipment.carrier_id is not null and v_shipment.carrier_id<>p_carrier_id then
    raise exception 'La transportadora no coincide con la liberación del despacho'
      using errcode='23514';
  end if;
  if v_shipment.route_code not in('LOCAL_DISPATCH','NATIONAL_DISPATCH') then
    raise exception 'Esta modalidad no requiere guía de transportadora' using errcode='22023';
  end if;
  if p_carrier_id is null or not exists(
    select 1 from erp_supply.freight_carriers c
    where c.id=p_carrier_id and c.organization_id=v_org and c.active
  ) then
    raise exception 'Transportadora inválida' using errcode='22023';
  end if;
  if v_tracking is null then
    raise exception 'Número de guía requerido' using errcode='22023';
  end if;

  update erp_supply.logistics_shipments
  set carrier_id=p_carrier_id,tracking_number=v_tracking,version=version+1,updated_at=now()
  where id=v_shipment.id
  returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'GUIDE_RECORDED',v_shipment.status,v_shipment.status,
    jsonb_build_object('carrierId',p_carrier_id,'trackingNumber',v_tracking),
    trim(p_idempotency_key)
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'status',v_shipment.status,'trackingNumber',v_shipment.tracking_number,
    'version',v_shipment.version,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_logistics_dispatch(
  p_shipment_id uuid,
  p_expected_version integer,
  p_actual_freight numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado para despachar' using errcode='42501';
  end if;
  if p_actual_freight is not null and p_actual_freight<0 then
    raise exception 'El costo real no puede ser negativo' using errcode='22023';
  end if;
  perform erp_private.logistics_lock('DISPATCH',p_idempotency_key);

  select * into v_shipment
  from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org
  for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0'
    );
  end if;

  if v_shipment.version<>p_expected_version then
    raise exception 'El despacho cambió durante la operación' using errcode='40001';
  end if;
  if v_shipment.route_code not in('LOCAL_DISPATCH','NATIONAL_DISPATCH') then
    raise exception 'Esta modalidad no utiliza salida de despacho' using errcode='22023';
  end if;
  if v_shipment.status<>'READY' then
    raise exception 'El despacho no está listo para salir' using errcode='23514';
  end if;
  if v_shipment.route_code='NATIONAL_DISPATCH'
     and (v_shipment.carrier_id is null or v_shipment.tracking_number is null) then
    raise exception 'El despacho nacional requiere transportadora y guía' using errcode='23514';
  end if;

  update erp_supply.logistics_shipments
  set status='IN_TRANSIT',dispatched_by=v_actor,dispatched_at=now(),
      actual_freight=coalesce(p_actual_freight,actual_freight),
      freight_sync_status=case when p_actual_freight is null then freight_sync_status else 'PENDING' end,
      version=version+1,updated_at=now()
  where id=v_shipment.id
  returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'DISPATCHED','READY','IN_TRANSIT',
    jsonb_build_object(
      'routeCode',v_shipment.route_code,
      'carrierId',v_shipment.carrier_id,
      'trackingNumber',v_shipment.tracking_number,
      'actualFreight',v_shipment.actual_freight
    ),
    trim(p_idempotency_key)
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'orderId',v_shipment.order_id,'status',v_shipment.status,
    'version',v_shipment.version,'actualFreight',v_shipment.actual_freight,
    'carrierId',v_shipment.carrier_id,'destinationId',v_shipment.destination_id,
    'predictionId',v_shipment.prediction_id,'routeCode',v_shipment.route_code,
    'dispatchedAt',v_shipment.dispatched_at,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_logistics_set_actual_cost(
  p_shipment_id uuid,
  p_actual_freight numeric,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
begin
  if not (
    erp_private.can_access_module('shipping','approve')
    or erp_private.can_access_module('freight','update')
  ) then
    raise exception 'No autorizado para corregir costo real' using errcode='42501';
  end if;
  if p_actual_freight is null or p_actual_freight<0 then
    raise exception 'Costo real inválido' using errcode='22023';
  end if;
  perform erp_private.logistics_lock('ACTUAL_COST',p_idempotency_key);

  select * into v_shipment
  from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org
  for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'actualFreight',v_shipment.actual_freight,'version',v_shipment.version,
      'contractVersion','1.0.0'
    );
  end if;
  if v_shipment.version<>p_expected_version then
    raise exception 'El despacho cambió durante la operación' using errcode='40001';
  end if;

  update erp_supply.logistics_shipments
  set actual_freight=p_actual_freight,freight_sync_status='PENDING',
      version=version+1,updated_at=now()
  where id=v_shipment.id
  returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'ACTUAL_FREIGHT_RECORDED',
    v_shipment.status,v_shipment.status,
    jsonb_build_object(
      'actualFreight',v_shipment.actual_freight,
      'estimatedFreight',v_shipment.estimated_freight
    ),
    trim(p_idempotency_key)
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'orderId',v_shipment.order_id,'actualFreight',v_shipment.actual_freight,
    'carrierId',v_shipment.carrier_id,'destinationId',v_shipment.destination_id,
    'predictionId',v_shipment.prediction_id,'routeCode',v_shipment.route_code,
    'observedAt',coalesce(v_shipment.dispatched_at,now()),
    'version',v_shipment.version,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_logistics_mark_freight_sync(
  p_shipment_id uuid,
  p_success boolean,
  p_payload jsonb
)
returns void
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado' using errcode='42501';
  end if;

  update erp_supply.logistics_shipments
  set freight_sync_status=case when p_success then 'SYNCED' else 'FAILED' end,
      metadata=metadata||jsonb_build_object(
        'freightSync',coalesce(p_payload,'{}'::jsonb),
        'freightSyncAt',now()
      ),
      updated_at=now()
  where id=p_shipment_id and organization_id=erp_private.current_org_id();
end;
$$;

create or replace function public.erp_x_logistics_delivery_failed(
  p_shipment_id uuid,
  p_reason text,
  p_observation text,
  p_evidence_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
  v_attempt integer;
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado para registrar intento' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Motivo de no entrega requerido' using errcode='22023';
  end if;
  perform erp_private.logistics_lock('FAILED_DELIVERY',p_idempotency_key);

  select * into v_shipment from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)) then
    return jsonb_build_object('success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0');
  end if;

  if v_shipment.version<>p_expected_version then
    raise exception 'El despacho cambió durante la operación' using errcode='40001';
  end if;
  if not (
    (v_shipment.route_code in('CLIENT_POINT','CLIENT_PICKUP') and v_shipment.status='READY')
    or
    (v_shipment.route_code in('LOCAL_DISPATCH','NATIONAL_DISPATCH') and v_shipment.status='IN_TRANSIT')
  ) then
    raise exception 'El estado actual no admite registrar no entrega' using errcode='23514';
  end if;
  if p_evidence_id is not null and not exists(
    select 1 from erp_supply.order_evidence e
    where e.id=p_evidence_id and e.organization_id=v_org and e.order_id=v_shipment.order_id
  ) then
    raise exception 'Evidencia inválida para el pedido' using errcode='22023';
  end if;

  select coalesce(max(attempt_no),0)+1 into v_attempt
  from erp_supply.delivery_attempts where shipment_id=v_shipment.id;

  insert into erp_supply.delivery_attempts(
    organization_id,shipment_id,order_id,attempt_no,outcome,evidence_id,
    reason,observation,next_state,actor_profile_id
  ) values(
    v_org,v_shipment.id,v_shipment.order_id,v_attempt,'FAILED',p_evidence_id,
    trim(p_reason),nullif(trim(coalesce(p_observation,'')),''),
    'READY',v_actor
  );

  update erp_supply.logistics_shipments
  set status='DELIVERY_FAILED',version=version+1,updated_at=now()
  where id=v_shipment.id returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'DELIVERY_FAILED',null,'DELIVERY_FAILED',
    jsonb_build_object('attemptNo',v_attempt,'reason',trim(p_reason),'evidenceId',p_evidence_id),
    trim(p_idempotency_key)
  );

  return jsonb_build_object('success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'status',v_shipment.status,'attemptNo',v_attempt,'version',v_shipment.version,
    'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_logistics_reprogram(
  p_shipment_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado para reprogramar' using errcode='42501';
  end if;
  perform erp_private.logistics_lock('REPROGRAM',p_idempotency_key);

  select * into v_shipment from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)) then
    return jsonb_build_object('success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0');
  end if;
  if v_shipment.version<>p_expected_version then
    raise exception 'El despacho cambió durante la operación' using errcode='40001';
  end if;
  if v_shipment.status<>'DELIVERY_FAILED' then
    raise exception 'Solo una entrega fallida puede reprogramarse' using errcode='23514';
  end if;

  update erp_supply.logistics_shipments
  set status='READY',version=version+1,updated_at=now()
  where id=v_shipment.id returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'DELIVERY_REPROGRAMMED',
    'DELIVERY_FAILED','READY','{}'::jsonb,trim(p_idempotency_key)
  );

  return jsonb_build_object('success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_logistics_deliver(
  p_shipment_id uuid,
  p_received_by text,
  p_observation text,
  p_evidence_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
  v_attempt integer;
  v_receiver text:=nullif(trim(coalesce(p_received_by,'')),'');
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado para confirmar entrega' using errcode='42501';
  end if;
  if p_evidence_id is null then
    raise exception 'La evidencia de entrega es obligatoria' using errcode='23514';
  end if;
  perform erp_private.logistics_lock('DELIVER',p_idempotency_key);

  select * into v_shipment from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)) then
    return jsonb_build_object('success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0');
  end if;

  if v_shipment.version<>p_expected_version then
    raise exception 'El despacho cambió durante la operación' using errcode='40001';
  end if;
  if not (
    (v_shipment.route_code in('CLIENT_POINT','CLIENT_PICKUP') and v_shipment.status='READY')
    or
    (v_shipment.route_code in('LOCAL_DISPATCH','NATIONAL_DISPATCH') and v_shipment.status='IN_TRANSIT')
  ) then
    raise exception 'La transición a entregado no es válida para esta modalidad' using errcode='23514';
  end if;
  if v_shipment.route_code='CLIENT_PICKUP' and v_receiver is null then
    raise exception 'El retiro por cliente requiere receptor' using errcode='23514';
  end if;
  if not exists(
    select 1 from erp_supply.order_evidence e
    where e.id=p_evidence_id and e.organization_id=v_org
      and e.order_id=v_shipment.order_id
      and upper(e.evidence_type) in('DELIVERY','DELIVERY_PHOTO','PICKUP','SIGNATURE','DELIVERY_DOCUMENT')
  ) then
    raise exception 'Evidencia de entrega inválida para el pedido' using errcode='22023';
  end if;

  select coalesce(max(attempt_no),0)+1 into v_attempt
  from erp_supply.delivery_attempts where shipment_id=v_shipment.id;

  insert into erp_supply.delivery_attempts(
    organization_id,shipment_id,order_id,attempt_no,outcome,evidence_id,
    received_by,observation,actor_profile_id
  ) values(
    v_org,v_shipment.id,v_shipment.order_id,v_attempt,'DELIVERED',p_evidence_id,
    v_receiver,nullif(trim(coalesce(p_observation,'')),''),v_actor
  );

  update erp_supply.logistics_shipments
  set status='DELIVERED',delivered_by=v_actor,delivered_at=now(),received_by=v_receiver,
      version=version+1,updated_at=now()
  where id=v_shipment.id returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'DELIVERED',null,'DELIVERED',
    jsonb_build_object(
      'attemptNo',v_attempt,'receivedBy',v_receiver,'evidenceId',p_evidence_id
    ),
    trim(p_idempotency_key)
  );

  return jsonb_build_object('success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'orderId',v_shipment.order_id,'status',v_shipment.status,'attemptNo',v_attempt,
    'deliveredAt',v_shipment.delivered_at,'version',v_shipment.version,
    'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_logistics_return(
  p_shipment_id uuid,
  p_reason text,
  p_evidence_id uuid,
  p_expected_version integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
  v_attempt integer;
begin
  if not erp_private.can_access_module('shipping','update') then
    raise exception 'No autorizado para registrar devolución' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null or p_evidence_id is null then
    raise exception 'La devolución requiere motivo y evidencia' using errcode='23514';
  end if;
  perform erp_private.logistics_lock('RETURN',p_idempotency_key);

  select * into v_shipment from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org for update;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;

  if exists(select 1 from erp_supply.logistics_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)) then
    return jsonb_build_object('success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0');
  end if;
  if v_shipment.version<>p_expected_version then
    raise exception 'El despacho cambió durante la operación' using errcode='40001';
  end if;
  if v_shipment.status not in('IN_TRANSIT','DELIVERY_FAILED') then
    raise exception 'El estado actual no admite devolución' using errcode='23514';
  end if;
  if not exists(
    select 1 from erp_supply.order_evidence e
    where e.id=p_evidence_id and e.organization_id=v_org and e.order_id=v_shipment.order_id
  ) then
    raise exception 'Evidencia inválida' using errcode='22023';
  end if;

  select coalesce(max(attempt_no),0)+1 into v_attempt
  from erp_supply.delivery_attempts where shipment_id=v_shipment.id;

  insert into erp_supply.delivery_attempts(
    organization_id,shipment_id,order_id,attempt_no,outcome,evidence_id,
    reason,next_state,actor_profile_id
  ) values(
    v_org,v_shipment.id,v_shipment.order_id,v_attempt,'RETURNED',p_evidence_id,
    trim(p_reason),'RETURNED',v_actor
  );

  update erp_supply.logistics_shipments
  set status='RETURNED',return_reason=trim(p_reason),version=version+1,updated_at=now()
  where id=v_shipment.id returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'RETURNED',null,'RETURNED',
    jsonb_build_object('attemptNo',v_attempt,'reason',trim(p_reason),'evidenceId',p_evidence_id),
    trim(p_idempotency_key)
  );

  return jsonb_build_object('success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'orderId',v_shipment.order_id,'status',v_shipment.status,'attemptNo',v_attempt,
    'version',v_shipment.version,'inventoryReturnPending',true,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_logistics_satisfaction(
  p_shipment_id uuid,
  p_rating smallint,
  p_comment text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_shipment erp_supply.logistics_shipments%rowtype;
  v_satisfaction erp_supply.delivery_satisfaction%rowtype;
begin
  if not (
    erp_private.can_access_module('shipping','update')
    or erp_private.can_access_module('sales','create')
  ) then
    raise exception 'No autorizado para registrar satisfacción' using errcode='42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'La calificación debe estar entre 1 y 5' using errcode='22023';
  end if;

  select * into v_shipment from erp_supply.logistics_shipments
  where id=p_shipment_id and organization_id=v_org;
  if not found then raise exception 'Despacho no encontrado' using errcode='22023'; end if;
  if v_shipment.status<>'DELIVERED' then
    raise exception 'La satisfacción solo se registra después de la entrega' using errcode='23514';
  end if;

  insert into erp_supply.delivery_satisfaction(
    organization_id,shipment_id,order_id,rating,comment,recorded_by,idempotency_key
  ) values(
    v_org,v_shipment.id,v_shipment.order_id,p_rating,
    nullif(trim(coalesce(p_comment,'')),''),v_actor,trim(p_idempotency_key)
  )
  on conflict(organization_id,order_id) do update set
    rating=excluded.rating,comment=excluded.comment,
    recorded_by=excluded.recorded_by,recorded_at=now()
  returning * into v_satisfaction;

  perform erp_private.logistics_append_event(
    v_shipment.id,v_shipment.order_id,'SATISFACTION_RECORDED',
    v_shipment.status,v_shipment.status,
    jsonb_build_object('rating',p_rating),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'satisfactionId',v_satisfaction.id,'rating',v_satisfaction.rating,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_logistics_save_guide(uuid,uuid,text,text) from public,anon;
revoke all on function public.erp_x_logistics_dispatch(uuid,integer,numeric,text) from public,anon;
revoke all on function public.erp_x_logistics_set_actual_cost(uuid,numeric,integer,text) from public,anon;
revoke all on function public.erp_x_logistics_mark_freight_sync(uuid,boolean,jsonb) from public,anon;
revoke all on function public.erp_x_logistics_delivery_failed(uuid,text,text,uuid,integer,text) from public,anon;
revoke all on function public.erp_x_logistics_reprogram(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_logistics_deliver(uuid,text,text,uuid,integer,text) from public,anon;
revoke all on function public.erp_x_logistics_return(uuid,text,uuid,integer,text) from public,anon;
revoke all on function public.erp_x_logistics_satisfaction(uuid,smallint,text,text) from public,anon;

grant execute on function public.erp_x_logistics_save_guide(uuid,uuid,text,text) to authenticated;
grant execute on function public.erp_x_logistics_dispatch(uuid,integer,numeric,text) to authenticated;
grant execute on function public.erp_x_logistics_set_actual_cost(uuid,numeric,integer,text) to authenticated;
grant execute on function public.erp_x_logistics_mark_freight_sync(uuid,boolean,jsonb) to authenticated;
grant execute on function public.erp_x_logistics_delivery_failed(uuid,text,text,uuid,integer,text) to authenticated;
grant execute on function public.erp_x_logistics_reprogram(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_logistics_deliver(uuid,text,text,uuid,integer,text) to authenticated;
grant execute on function public.erp_x_logistics_return(uuid,text,uuid,integer,text) to authenticated;
grant execute on function public.erp_x_logistics_satisfaction(uuid,smallint,text,text) to authenticated;

commit;
