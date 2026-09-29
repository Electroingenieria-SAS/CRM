begin;

create or replace function public.erp_x_billing_queue(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_search text:=lower(nullif(trim(coalesce(p_search,'')),''));
  v_total integer;
  v_items jsonb;
begin
  if not erp_private.can_access_module('billing','read') then
    raise exception 'No autorizado para consultar facturación' using errcode='42501';
  end if;

  select count(*)::integer into v_total
  from erp_supply.orders o
  where o.organization_id=v_org
    and o.current_step_code in('FACTURACION','CAJA_FACTURACION')
    and (
      v_search is null
      or lower(o.order_number) like '%'||v_search||'%'
      or lower(o.client_name) like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(row_data order by order_number),'[]'::jsonb)
  into v_items
  from (
    select
      o.order_number,
      jsonb_build_object(
        'orderId',o.id,
        'orderNumber',o.order_number,
        'customerName',o.client_name,
        'orderType',o.order_type_code,
        'currentStep',o.current_step_code,
        'routeCode',o.delivery_route_code,
        'orderVersion',o.version,
        'billingReady',erp_private.billing_is_ready(o.id),
        'financial',public.erp_x_financial_gate(o.id),
        'invoices',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',i.id,
            'invoiceNumber',i.invoice_number,
            'invoiceDate',i.invoice_date,
            'amount',i.amount,
            'reversedAmount',i.reversed_amount,
            'status',i.status
          ) order by i.invoice_date desc,i.created_at desc)
          from erp_supply.invoices i
          where i.organization_id=v_org and i.order_id=o.id
        ),'[]'::jsonb),
        'pvpAnnexCount',(
          select count(*)::integer
          from erp_supply.order_evidence e
          where e.organization_id=v_org and e.order_id=o.id
            and upper(e.evidence_type)='PVP_ANNEX'
        )
      ) row_data
    from erp_supply.orders o
    where o.organization_id=v_org
      and o.current_step_code in('FACTURACION','CAJA_FACTURACION')
      and (
        v_search is null
        or lower(o.order_number) like '%'||v_search||'%'
        or lower(o.client_name) like '%'||v_search||'%'
      )
    order by o.updated_at desc,o.order_number
    limit v_size offset (v_page-1)*v_size
  ) rows;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_logistics_queue(
  p_status text default null,
  p_route_code text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_status text:=upper(nullif(trim(coalesce(p_status,'')),''));
  v_route text:=upper(nullif(trim(coalesce(p_route_code,'')),''));
  v_search text:=lower(nullif(trim(coalesce(p_search,'')),''));
  v_total integer;
  v_items jsonb;
begin
  if not (
    erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  ) then
    raise exception 'No autorizado para consultar logística' using errcode='42501';
  end if;

  select count(*)::integer into v_total
  from erp_supply.logistics_shipments s
  join erp_supply.orders o on o.id=s.order_id
  where s.organization_id=v_org
    and (v_status is null or s.status=v_status)
    and (v_route is null or s.route_code=v_route)
    and (
      v_search is null
      or lower(o.order_number) like '%'||v_search||'%'
      or lower(o.client_name) like '%'||v_search||'%'
      or lower(coalesce(s.tracking_number,'')) like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(row_data order by released_at desc),'[]'::jsonb)
  into v_items
  from (
    select
      s.released_at,
      jsonb_build_object(
        'shipmentId',s.id,
        'orderId',o.id,
        'orderNumber',o.order_number,
        'customerName',o.client_name,
        'destination',jsonb_build_object(
          'city',o.client_city,
          'address',o.client_address
        ),
        'routeCode',s.route_code,
        'status',s.status,
        'carrier',case when c.id is null then null else jsonb_build_object(
          'id',c.id,'code',c.code,'name',c.name
        ) end,
        'trackingNumber',s.tracking_number,
        'estimatedFreight',s.estimated_freight,
        'actualFreight',s.actual_freight,
        'freightError',case
          when s.estimated_freight is null or s.actual_freight is null then null
          else s.actual_freight-s.estimated_freight
        end,
        'freightSyncStatus',s.freight_sync_status,
        'releasedAt',s.released_at,
        'dispatchedAt',s.dispatched_at,
        'deliveredAt',s.delivered_at,
        'receivedBy',s.received_by,
        'version',s.version
      ) row_data
    from erp_supply.logistics_shipments s
    join erp_supply.orders o on o.id=s.order_id
    left join erp_supply.freight_carriers c on c.id=s.carrier_id
    where s.organization_id=v_org
      and (v_status is null or s.status=v_status)
      and (v_route is null or s.route_code=v_route)
      and (
        v_search is null
        or lower(o.order_number) like '%'||v_search||'%'
        or lower(o.client_name) like '%'||v_search||'%'
        or lower(coalesce(s.tracking_number,'')) like '%'||v_search||'%'
      )
    order by s.updated_at desc
    limit v_size offset (v_page-1)*v_size
  ) rows;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_logistics_detail(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_shipment erp_supply.logistics_shipments%rowtype;
begin
  if not (
    erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  ) then
    raise exception 'No autorizado para consultar logística' using errcode='42501';
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org;
  if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;

  select * into v_shipment
  from erp_supply.logistics_shipments
  where organization_id=v_org and order_id=p_order_id;

  return jsonb_build_object(
    'order',jsonb_build_object(
      'id',v_order.id,
      'orderNumber',v_order.order_number,
      'customerName',v_order.client_name,
      'customerDocument',v_order.client_document,
      'city',v_order.client_city,
      'address',v_order.client_address,
      'phone',v_order.client_phone,
      'routeCode',v_order.delivery_route_code,
      'currentStep',v_order.current_step_code,
      'status',v_order.status,
      'version',v_order.version
    ),
    'billing',public.erp_x_billing_readiness(v_order.id),
    'shipment',case when v_shipment.id is null then null else jsonb_build_object(
      'id',v_shipment.id,
      'routeCode',v_shipment.route_code,
      'status',v_shipment.status,
      'carrierId',v_shipment.carrier_id,
      'carrierName',(select c.name from erp_supply.freight_carriers c where c.id=v_shipment.carrier_id),
      'destinationId',v_shipment.destination_id,
      'predictionId',v_shipment.prediction_id,
      'trackingNumber',v_shipment.tracking_number,
      'estimatedFreight',v_shipment.estimated_freight,
      'estimatedFreightLow',v_shipment.estimated_freight_low,
      'estimatedFreightHigh',v_shipment.estimated_freight_high,
      'actualFreight',v_shipment.actual_freight,
      'freightError',case
        when v_shipment.estimated_freight is null or v_shipment.actual_freight is null then null
        else v_shipment.actual_freight-v_shipment.estimated_freight
      end,
      'freightSyncStatus',v_shipment.freight_sync_status,
      'releasedAt',v_shipment.released_at,
      'dispatchedAt',v_shipment.dispatched_at,
      'deliveredAt',v_shipment.delivered_at,
      'receivedBy',v_shipment.received_by,
      'returnReason',v_shipment.return_reason,
      'version',v_shipment.version
    ) end,
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,
        'eventType',e.event_type,
        'fromStatus',e.from_status,
        'toStatus',e.to_status,
        'actorProfileId',e.actor_profile_id,
        'payload',e.payload,
        'createdAt',e.created_at
      ) order by e.created_at desc,e.id desc)
      from erp_supply.logistics_events e
      where e.organization_id=v_org and e.order_id=v_order.id
    ),'[]'::jsonb),
    'attempts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,
        'attemptNo',a.attempt_no,
        'outcome',a.outcome,
        'occurredAt',a.occurred_at,
        'evidenceId',a.evidence_id,
        'receivedBy',a.received_by,
        'reason',a.reason,
        'observation',a.observation,
        'nextState',a.next_state
      ) order by a.attempt_no desc)
      from erp_supply.delivery_attempts a
      where a.organization_id=v_org and a.order_id=v_order.id
    ),'[]'::jsonb),
    'satisfaction',(
      select jsonb_build_object(
        'id',s.id,'rating',s.rating,'comment',s.comment,
        'recordedBy',s.recorded_by,'recordedAt',s.recorded_at
      )
      from erp_supply.delivery_satisfaction s
      where s.organization_id=v_org and s.order_id=v_order.id
      limit 1
    ),
    'invoices',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'invoiceNumber',i.invoice_number,'invoiceDate',i.invoice_date,
        'amount',i.amount,'reversedAmount',i.reversed_amount,'status',i.status
      ) order by i.invoice_date desc,i.created_at desc)
      from erp_supply.invoices i
      where i.organization_id=v_org and i.order_id=v_order.id
    ),'[]'::jsonb),
    'evidence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'type',e.evidence_type,'storageProvider',e.storage_provider,
        'storageReference',e.storage_reference,'fileName',e.file_name,
        'mimeType',e.mime_type,'createdAt',e.created_at
      ) order by e.created_at desc)
      from erp_supply.order_evidence e
      where e.organization_id=v_org and e.order_id=v_order.id
        and upper(e.evidence_type) in(
          'PVP_ANNEX','DELIVERY','DELIVERY_PHOTO','PICKUP','SIGNATURE',
          'DELIVERY_DOCUMENT','RETURN'
        )
    ),'[]'::jsonb),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_billing_queue(text,integer,integer) from public,anon;
revoke all on function public.erp_x_logistics_queue(text,text,text,integer,integer) from public,anon;
revoke all on function public.erp_x_logistics_detail(uuid) from public,anon;

grant execute on function public.erp_x_billing_queue(text,integer,integer) to authenticated;
grant execute on function public.erp_x_logistics_queue(text,text,text,integer,integer) to authenticated;
grant execute on function public.erp_x_logistics_detail(uuid) to authenticated;

commit;
