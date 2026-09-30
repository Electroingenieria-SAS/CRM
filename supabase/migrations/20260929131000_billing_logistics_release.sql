begin;

create or replace function erp_private.billing_is_ready(p_order_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
begin
  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();

  if not found then return false; end if;

  if upper(v_order.order_type_code)='PVP' then
    return exists(
      select 1
      from erp_supply.order_evidence e
      where e.organization_id=v_order.organization_id
        and e.order_id=v_order.id
        and upper(e.evidence_type)='PVP_ANNEX'
    );
  end if;

  return exists(
    select 1
    from erp_supply.invoices i
    where i.organization_id=v_order.organization_id
      and i.order_id=v_order.id
      and i.status in('REGISTERED','PARTIALLY_REVERSED')
      and i.amount-i.reversed_amount>0
  );
end;
$$;

create or replace function erp_private.logistics_has_blocking_issue(p_order_id uuid)
returns boolean
language sql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
  select exists(
    select 1
    from erp_supply.order_issues i
    where i.organization_id=erp_private.current_org_id()
      and i.order_id=p_order_id
      and i.status='OPEN'
      and i.blocking
  )
$$;

create or replace function erp_private.logistics_is_delivered(p_order_id uuid)
returns boolean
language sql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
  select exists(
    select 1
    from erp_supply.logistics_shipments s
    where s.organization_id=erp_private.current_org_id()
      and s.order_id=p_order_id
      and s.status='DELIVERED'
      and s.delivered_at is not null
  )
$$;

revoke all on function erp_private.billing_is_ready(uuid) from public,anon;
revoke all on function erp_private.logistics_has_blocking_issue(uuid) from public,anon;
revoke all on function erp_private.logistics_is_delivered(uuid) from public,anon;
grant execute on function erp_private.billing_is_ready(uuid) to authenticated;
grant execute on function erp_private.logistics_has_blocking_issue(uuid) to authenticated;
grant execute on function erp_private.logistics_is_delivered(uuid) to authenticated;

create or replace function public.erp_x_billing_readiness(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
  v_gate jsonb;
  v_billing boolean;
  v_blocked boolean;
begin
  if not (
    erp_private.can_access_module('billing','read')
    or erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('orders','read')
  ) then
    raise exception 'No autorizado para consultar liberación' using errcode='42501';
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=erp_private.current_org_id();
  if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;

  v_gate:=public.erp_x_financial_gate(p_order_id);
  v_billing:=erp_private.billing_is_ready(p_order_id);
  v_blocked:=erp_private.logistics_has_blocking_issue(p_order_id);

  return jsonb_build_object(
    'orderId',v_order.id,
    'orderNumber',v_order.order_number,
    'orderType',v_order.order_type_code,
    'routeCode',v_order.delivery_route_code,
    'currentStep',v_order.current_step_code,
    'billingReady',v_billing,
    'billingRequirement',case when upper(v_order.order_type_code)='PVP'
      then 'PVP_ANNEX' else 'REGISTERED_INVOICE' end,
    'financialDecision',v_gate->>'decision',
    'financialReason',v_gate->>'reason',
    'blockingIssueOpen',v_blocked,
    'readyForLogistics',
      v_billing
      and coalesce(v_gate->>'decision','')='APPROVED'
      and not v_blocked,
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_logistics_release(
  p_order_id uuid,
  p_payload jsonb,
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
  v_order erp_supply.orders%rowtype;
  v_shipment erp_supply.logistics_shipments%rowtype;
  v_ready jsonb;
  v_prediction uuid:=nullif(p_payload->>'predictionId','')::uuid;
  v_carrier uuid:=nullif(p_payload->>'carrierId','')::uuid;
  v_destination uuid:=nullif(p_payload->>'destinationId','')::uuid;
  v_estimated numeric:=nullif(p_payload->>'estimatedFreight','')::numeric;
  v_low numeric:=nullif(p_payload->>'estimatedFreightLow','')::numeric;
  v_high numeric:=nullif(p_payload->>'estimatedFreightHigh','')::numeric;
begin
  if not erp_private.can_access_module('shipping','create') then
    raise exception 'No autorizado para liberar pedidos a logística' using errcode='42501';
  end if;

  perform erp_private.logistics_lock('RELEASE_ORDER',p_order_id::text);
  perform erp_private.logistics_lock('RELEASE',p_idempotency_key);

  select s.* into v_shipment
  from erp_supply.logistics_shipments s
  join erp_supply.logistics_events e on e.shipment_id=s.id
  where s.organization_id=v_org
    and e.idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0'
    );
  end if;

  select * into v_shipment
  from erp_supply.logistics_shipments
  where organization_id=v_org and order_id=p_order_id
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'shipmentId',v_shipment.id,
      'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0'
    );
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org;
  if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;

  if v_order.current_step_code<>v_order.delivery_route_code
     or v_order.delivery_route_code not in(
       'CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH'
     ) then
    raise exception 'El pedido todavía no está en su etapa logística' using errcode='22023';
  end if;

  v_ready:=public.erp_x_billing_readiness(p_order_id);
  if not coalesce((v_ready->>'readyForLogistics')::boolean,false) then
    raise exception 'El pedido no cumple las precondiciones de liberación logística'
      using errcode='23514';
  end if;

  if v_carrier is not null and not exists(
    select 1 from erp_supply.freight_carriers c
    where c.id=v_carrier and c.organization_id=v_org and c.active
  ) then
    raise exception 'Transportadora inválida' using errcode='22023';
  end if;

  if v_destination is not null and not exists(
    select 1 from erp_supply.freight_destinations d
    where d.id=v_destination and d.active
  ) then
    raise exception 'Destino de flete inválido' using errcode='22023';
  end if;

  if v_prediction is not null and not exists(
    select 1 from erp_supply.freight_predictions p
    where p.id=v_prediction and p.organization_id=v_org and p.order_id=p_order_id
  ) then
    raise exception 'Predicción de flete inválida para el pedido' using errcode='22023';
  end if;

  insert into erp_supply.logistics_shipments(
    organization_id,order_id,route_code,status,carrier_id,destination_id,prediction_id,
    estimated_freight,estimated_freight_low,estimated_freight_high,
    freight_sync_status,released_by,metadata
  )
  values(
    v_org,p_order_id,v_order.delivery_route_code,'READY',v_carrier,v_destination,v_prediction,
    v_estimated,v_low,v_high,'NOT_REQUIRED',v_actor,
    jsonb_build_object(
      'clientCity',v_order.client_city,
      'clientAddress',v_order.client_address,
      'releaseContractVersion','1.0.0'
    )
  )
  on conflict(organization_id,order_id) do update set
    carrier_id=coalesce(excluded.carrier_id,erp_supply.logistics_shipments.carrier_id),
    destination_id=coalesce(excluded.destination_id,erp_supply.logistics_shipments.destination_id),
    prediction_id=coalesce(excluded.prediction_id,erp_supply.logistics_shipments.prediction_id),
    estimated_freight=coalesce(excluded.estimated_freight,erp_supply.logistics_shipments.estimated_freight),
    estimated_freight_low=coalesce(excluded.estimated_freight_low,erp_supply.logistics_shipments.estimated_freight_low),
    estimated_freight_high=coalesce(excluded.estimated_freight_high,erp_supply.logistics_shipments.estimated_freight_high),
    updated_at=now()
  returning * into v_shipment;

  perform erp_private.logistics_append_event(
    v_shipment.id,p_order_id,'LOGISTICS_RELEASED',null,v_shipment.status,
    jsonb_build_object(
      'routeCode',v_shipment.route_code,
      'predictionId',v_shipment.prediction_id,
      'estimatedFreight',v_shipment.estimated_freight
    ),
    trim(p_idempotency_key)
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'shipmentId',v_shipment.id,
    'status',v_shipment.status,'version',v_shipment.version,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function erp_private.billing_logistics_completion_guard()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
begin
  if new.status<>'COMPLETED' or old.status='COMPLETED' then return new; end if;

  select * into v_order from erp_supply.orders where id=new.order_id;
  if not found or v_order.is_test then return new; end if;

  if new.step_code in('FACTURACION','CAJA_FACTURACION') then
    if not erp_private.billing_is_ready(v_order.id) then
      raise exception 'La facturación requerida no está lista' using errcode='23514';
    end if;
  elsif new.step_code in(
    'CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH','CLOSURE'
  ) then
    if not erp_private.logistics_is_delivered(v_order.id) then
      raise exception 'La entrega logística todavía no está confirmada' using errcode='23514';
    end if;
    if erp_private.logistics_has_blocking_issue(v_order.id) then
      raise exception 'Existen incidencias bloqueantes pendientes' using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_billing_logistics_completion_guard on erp_supply.order_tasks;
create trigger trg_billing_logistics_completion_guard
before update of status on erp_supply.order_tasks
for each row execute function erp_private.billing_logistics_completion_guard();

revoke all on function public.erp_x_billing_readiness(uuid) from public,anon;
revoke all on function public.erp_x_logistics_release(uuid,jsonb,text) from public,anon;
revoke all on function erp_private.billing_logistics_completion_guard() from public,anon,authenticated;
grant execute on function public.erp_x_billing_readiness(uuid) to authenticated;
grant execute on function public.erp_x_logistics_release(uuid,jsonb,text) to authenticated;

commit;
