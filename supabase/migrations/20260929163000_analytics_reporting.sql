begin;

create table erp_supply.analytics_export_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  actor_profile_id uuid not null references erp_supply.profiles(id),
  report_code text not null,
  format text not null check (format in ('CSV')),
  filters jsonb not null default '{}'::jsonb,
  row_count integer not null check (row_count>=0),
  created_at timestamptz not null default now()
);

create index idx_analytics_export_audit_time
on erp_supply.analytics_export_audit(organization_id,created_at desc);

alter table erp_supply.analytics_export_audit enable row level security;

create policy analytics_export_audit_read
on erp_supply.analytics_export_audit
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('audit','read')
    or erp_private.can_access_module('reports','admin')
  )
);

grant select on erp_supply.analytics_export_audit to authenticated;
revoke insert,update,delete on erp_supply.analytics_export_audit from authenticated;

create or replace function public.erp_x_analytics_report_catalog()
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_items jsonb:='[]'::jsonb;
begin
  if not erp_private.can_access_module('reports','read') then
    raise exception 'No autorizado para consultar reportes' using errcode='42501';
  end if;

  if erp_private.can_access_module('orders','read') then
    v_items:=v_items||jsonb_build_array(
      jsonb_build_object('code','orders','name','Pedidos'),
      jsonb_build_object('code','stage_times','name','Tiempos por etapa')
    );
  end if;
  if erp_private.can_access_module('workforce','read')
     and erp_private.can_access_module('orders','read') then
    v_items:=v_items||jsonb_build_array(
      jsonb_build_object('code','workforce','name','Workforce')
    );
  end if;
  if erp_private.can_access_module('customer_intelligence','read') then
    v_items:=v_items||jsonb_build_array(
      jsonb_build_object('code','customers','name','Clientes')
    );
  end if;
  if erp_private.can_access_module('inventory','read') then
    v_items:=v_items||jsonb_build_array(
      jsonb_build_object('code','inventory','name','Inventario')
    );
  end if;
  if erp_private.can_access_module('freight','read') then
    v_items:=v_items||jsonb_build_array(
      jsonb_build_object('code','freight','name','Fletes')
    );
  end if;
  if to_regclass('erp_supply.logistics_shipments') is not null
     and (
       erp_private.can_access_module('shipping','read')
       or erp_private.can_access_module('sales','read')
       or erp_private.can_access_module('audit','read')
     ) then
    v_items:=v_items||jsonb_build_array(
      jsonb_build_object('code','logistics','name','Entregas y logística')
    );
  end if;

  return jsonb_build_object('items',v_items,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_analytics_report(
  p_report text,
  p_filters jsonb default '{}'::jsonb,
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
  v_report text:=lower(btrim(coalesce(p_report,'')));
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_offset integer;
  v_tz text;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_search text:=lower(nullif(btrim(coalesce(p_filters->>'search','')),''));
  v_step text:=upper(nullif(btrim(coalesce(p_filters->>'step','')),''));
  v_status text:=upper(nullif(btrim(coalesce(p_filters->>'status','')),''));
  v_route text:=upper(nullif(btrim(coalesce(p_filters->>'route','')),''));
  v_segment text:=upper(nullif(btrim(coalesce(p_filters->>'segment','')),''));
  v_source text:=upper(nullif(btrim(coalesce(p_filters->>'source','')),''));
  v_seller uuid;
  v_responsible uuid;
  v_total integer:=0;
  v_rows jsonb:='[]'::jsonb;
  v_columns jsonb:='[]'::jsonb;
  v_workforce jsonb;
begin
  if v_org is null or not erp_private.can_access_module('reports','read') then
    raise exception 'No autorizado para consultar reportes' using errcode='42501';
  end if;

  begin v_seller:=nullif(p_filters->>'sellerId','')::uuid;
  exception when invalid_text_representation then
    raise exception 'sellerId inválido' using errcode='22023';
  end;
  begin v_responsible:=nullif(p_filters->>'responsibleId','')::uuid;
  exception when invalid_text_representation then
    raise exception 'responsibleId inválido' using errcode='22023';
  end;

  select coalesce(timezone,'America/Bogota') into v_tz
  from erp_supply.organizations where id=v_org;

  v_from:=coalesce(nullif(p_filters->>'from','')::date,(now() at time zone v_tz)::date-29);
  v_to:=coalesce(nullif(p_filters->>'to','')::date,(now() at time zone v_tz)::date);
  if v_to<v_from or v_to-v_from>366 then
    raise exception 'Rango de reporte inválido; máximo 367 días' using errcode='22023';
  end if;
  v_start:=v_from::timestamp at time zone v_tz;
  v_end:=(v_to+1)::timestamp at time zone v_tz;
  v_offset:=(v_page-1)*v_size;

  if v_report='orders' then
    if not erp_private.can_access_module('orders','read') then
      raise exception 'No autorizado para consultar pedidos' using errcode='42501';
    end if;

    select count(*)::integer into v_total
    from erp_supply.orders o
    where o.organization_id=v_org
      and not o.is_test
      and o.created_at>=v_start and o.created_at<v_end
      and (v_search is null or lower(o.order_number||' '||o.client_name) like '%'||v_search||'%')
      and (v_seller is null or o.seller_profile_id=v_seller)
      and (v_responsible is null or o.current_assignee_id=v_responsible)
      and (v_step is null or o.current_step_code=v_step)
      and (v_status is null or o.status=v_status)
      and (v_route is null or o.delivery_route_code=v_route)
      and (
        v_segment is null
        or exists(
          select 1 from erp_supply.customer_intelligence_current ci
          where ci.organization_id=v_org
            and ci.customer_id=o.customer_id
            and ci.segment=v_segment
        )
      );

    select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb)
    into v_rows
    from (
      select
        o.order_number "orderNumber",
        o.client_name "client",
        seller.display_name "seller",
        assignee.display_name "responsible",
        o.current_step_code "step",
        o.status,
        o.delivery_route_code "route",
        ci.segment,
        o.created_at "createdAt",
        o.closed_at "closedAt"
      from erp_supply.orders o
      left join erp_supply.profiles seller on seller.id=o.seller_profile_id
      left join erp_supply.profiles assignee on assignee.id=o.current_assignee_id
      left join erp_supply.customer_intelligence_current ci
        on ci.organization_id=v_org and ci.customer_id=o.customer_id
      where o.organization_id=v_org
        and not o.is_test
        and o.created_at>=v_start and o.created_at<v_end
        and (v_search is null or lower(o.order_number||' '||o.client_name) like '%'||v_search||'%')
        and (v_seller is null or o.seller_profile_id=v_seller)
        and (v_responsible is null or o.current_assignee_id=v_responsible)
        and (v_step is null or o.current_step_code=v_step)
        and (v_status is null or o.status=v_status)
        and (v_route is null or o.delivery_route_code=v_route)
        and (v_segment is null or ci.segment=v_segment)
      order by o.created_at desc
      limit v_size offset v_offset
    ) x;

    v_columns:='[
      {"key":"orderNumber","label":"Pedido"},
      {"key":"client","label":"Cliente"},
      {"key":"seller","label":"Vendedor"},
      {"key":"responsible","label":"Responsable"},
      {"key":"step","label":"Etapa"},
      {"key":"status","label":"Estado"},
      {"key":"route","label":"Modalidad"},
      {"key":"segment","label":"Segmento"},
      {"key":"createdAt","label":"Creado"},
      {"key":"closedAt","label":"Cerrado"}
    ]'::jsonb;

  elsif v_report='stage_times' then
    if not erp_private.can_access_module('vsm','read') then
      raise exception 'No autorizado para consultar tiempos VSM' using errcode='42501';
    end if;

    select count(*)::integer into v_total
    from erp_private.analytics_stage_metrics_all(v_org,v_start,v_end) m
    where (v_search is null or lower(m.order_number||' '||coalesce(m.client_name,'')) like '%'||v_search||'%')
      and (v_seller is null or m.seller_profile_id=v_seller)
      and (v_step is null or m.step_code=v_step)
      and (v_status is null or m.order_status=v_status)
      and (v_route is null or m.route_code=v_route)
      and (v_source is null or m.source_kind=v_source);

    select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb)
    into v_rows
    from (
      select
        m.source_kind source,
        m.order_number "orderNumber",
        m.client_name client,
        m.step_code step,
        m.task_status status,
        round(m.waiting_seconds/60.0,2) "waitingMinutes",
        round(m.processing_seconds/60.0,2) "processingMinutes",
        round(m.blocked_seconds/60.0,2) "blockedMinutes",
        case when m.transit_seconds is null then null else round(m.transit_seconds/60.0,2) end "transitMinutes",
        round(m.total_seconds/60.0,2) "totalMinutes",
        m.task_created_at "createdAt",
        m.completed_at "completedAt"
      from erp_private.analytics_stage_metrics_all(v_org,v_start,v_end) m
      where (v_search is null or lower(m.order_number||' '||coalesce(m.client_name,'')) like '%'||v_search||'%')
        and (v_seller is null or m.seller_profile_id=v_seller)
        and (v_step is null or m.step_code=v_step)
        and (v_status is null or m.order_status=v_status)
        and (v_route is null or m.route_code=v_route)
        and (v_source is null or m.source_kind=v_source)
      order by m.task_created_at desc
      limit v_size offset v_offset
    ) x;

    v_columns:='[
      {"key":"source","label":"Fuente"},
      {"key":"orderNumber","label":"Pedido"},
      {"key":"client","label":"Cliente"},
      {"key":"step","label":"Etapa"},
      {"key":"status","label":"Estado"},
      {"key":"waitingMinutes","label":"Espera (min)"},
      {"key":"processingMinutes","label":"Proceso (min)"},
      {"key":"blockedMinutes","label":"Bloqueo (min)"},
      {"key":"transitMinutes","label":"Tránsito (min)"},
      {"key":"totalMinutes","label":"Total (min)"},
      {"key":"createdAt","label":"Inicio ciclo"},
      {"key":"completedAt","label":"Fin"}
    ]'::jsonb;

  elsif v_report='customers' then
    if not erp_private.can_access_module('customer_intelligence','read') then
      raise exception 'No autorizado para consultar clientes' using errcode='42501';
    end if;

    select count(*)::integer into v_total
    from erp_supply.customer_intelligence_current ci
    join erp_supply.customers c on c.id=ci.customer_id
    where ci.organization_id=v_org
      and (v_search is null or lower(c.display_name||' '||coalesce(c.document,'')) like '%'||v_search||'%')
      and (v_segment is null or ci.segment=v_segment);

    select coalesce(jsonb_agg(to_jsonb(x) order by x."rank"),'[]'::jsonb)
    into v_rows
    from (
      select
        ci.overall_rank "rank",
        c.display_name client,
        c.document,
        ci.segment,
        ci.valid_order_count "orders",
        ci.paid_amount "paidAmount",
        ci.score,
        ci.support_level "supportLevel",
        ci.provisional
      from erp_supply.customer_intelligence_current ci
      join erp_supply.customers c on c.id=ci.customer_id
      where ci.organization_id=v_org
        and (v_search is null or lower(c.display_name||' '||coalesce(c.document,'')) like '%'||v_search||'%')
        and (v_segment is null or ci.segment=v_segment)
      order by ci.overall_rank
      limit v_size offset v_offset
    ) x;

    v_columns:='[
      {"key":"rank","label":"Ranking"},
      {"key":"client","label":"Cliente"},
      {"key":"document","label":"Documento"},
      {"key":"segment","label":"Segmento"},
      {"key":"orders","label":"Pedidos"},
      {"key":"paidAmount","label":"Valor pagado"},
      {"key":"score","label":"Score"},
      {"key":"supportLevel","label":"Soporte"},
      {"key":"provisional","label":"Provisional"}
    ]'::jsonb;

  elsif v_report='inventory' then
    if not erp_private.can_access_module('inventory','read') then
      raise exception 'No autorizado para consultar inventario' using errcode='42501';
    end if;

    select count(*)::integer into v_total
    from erp_supply.inventory_balances b
    join erp_supply.material_master m on m.id=b.material_id
    left join erp_supply.material_variants v on v.id=b.variant_id
    join erp_supply.inventory_locations l on l.id=b.location_id
    where b.organization_id=v_org
      and (
        v_search is null
        or lower(concat_ws(' ',m.reference,m.name,coalesce(v.label,''),l.code,l.name))
          like '%'||v_search||'%'
      );

    select coalesce(jsonb_agg(to_jsonb(x) order by x.reference,x.location),'[]'::jsonb)
    into v_rows
    from (
      select
        m.reference,
        m.name material,
        v.label variant,
        l.code location,
        b.on_hand "onHand",
        b.reserved,
        b.committed,
        b.on_hand-b.reserved-b.committed available,
        m.unit
      from erp_supply.inventory_balances b
      join erp_supply.material_master m on m.id=b.material_id
      left join erp_supply.material_variants v on v.id=b.variant_id
      join erp_supply.inventory_locations l on l.id=b.location_id
      where b.organization_id=v_org
        and (
          v_search is null
          or lower(concat_ws(' ',m.reference,m.name,coalesce(v.label,''),l.code,l.name))
            like '%'||v_search||'%'
        )
      order by m.reference,l.code
      limit v_size offset v_offset
    ) x;

    v_columns:='[
      {"key":"reference","label":"Referencia"},
      {"key":"material","label":"Material"},
      {"key":"variant","label":"Variante"},
      {"key":"location","label":"Ubicación"},
      {"key":"onHand","label":"Físico"},
      {"key":"reserved","label":"Reservado"},
      {"key":"committed","label":"Comprometido"},
      {"key":"available","label":"Disponible"},
      {"key":"unit","label":"Unidad"}
    ]'::jsonb;

  elsif v_report='freight' then
    if not erp_private.can_access_module('freight','read') then
      raise exception 'No autorizado para consultar fletes' using errcode='42501';
    end if;

    select count(*)::integer into v_total
    from erp_supply.freight_observations f
    join erp_supply.freight_carriers c on c.id=f.carrier_id
    join erp_supply.freight_destinations d on d.id=f.destination_id
    where f.organization_id=v_org
      and f.observed_at>=v_start and f.observed_at<v_end
      and (
        v_search is null
        or lower(concat_ws(' ',c.name,d.city_name,d.department_name,coalesce(f.route_code,'')))
          like '%'||v_search||'%'
      );

    select coalesce(jsonb_agg(to_jsonb(x) order by x."observedAt" desc),'[]'::jsonb)
    into v_rows
    from (
      select
        c.name carrier,
        d.city_name city,
        d.department_name department,
        f.route_code route,
        f.actual_cost "actualCost",
        f.weight_kg "weightKg",
        f.package_count "packageCount",
        f.source,
        f.observed_at "observedAt"
      from erp_supply.freight_observations f
      join erp_supply.freight_carriers c on c.id=f.carrier_id
      join erp_supply.freight_destinations d on d.id=f.destination_id
      where f.organization_id=v_org
        and f.observed_at>=v_start and f.observed_at<v_end
        and (
          v_search is null
          or lower(concat_ws(' ',c.name,d.city_name,d.department_name,coalesce(f.route_code,'')))
            like '%'||v_search||'%'
        )
      order by f.observed_at desc
      limit v_size offset v_offset
    ) x;

    v_columns:='[
      {"key":"carrier","label":"Transportadora"},
      {"key":"city","label":"Ciudad"},
      {"key":"department","label":"Departamento"},
      {"key":"route","label":"Modalidad"},
      {"key":"actualCost","label":"Costo real"},
      {"key":"weightKg","label":"Peso kg"},
      {"key":"packageCount","label":"Bultos"},
      {"key":"source","label":"Fuente"},
      {"key":"observedAt","label":"Fecha"}
    ]'::jsonb;

  elsif v_report='workforce' then
    if not (
      erp_private.can_access_module('workforce','read')
      and erp_private.can_access_module('orders','read')
    ) then
      raise exception 'No autorizado para consultar Workforce' using errcode='42501';
    end if;

    v_workforce:=public.erp_x_order_workforce_indicators(v_from,v_to);
    v_total:=jsonb_array_length(coalesce(v_workforce->'people','[]'::jsonb));

    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)
    into v_rows
    from jsonb_array_elements(coalesce(v_workforce->'people','[]'::jsonb))
      with ordinality as p(value,ordinality)
    where ordinality>v_offset and ordinality<=v_offset+v_size;

    v_columns:='[
      {"key":"name","label":"Persona"},
      {"key":"occupancy","label":"Ocupación"},
      {"key":"orderNumber","label":"Pedido"},
      {"key":"activityTitle","label":"Actividad"},
      {"key":"activeBusinessMinutes","label":"Activo (min)"},
      {"key":"blockedBusinessMinutes","label":"Bloqueado (min)"},
      {"key":"completedActivities","label":"Completadas"},
      {"key":"inactivityMinutes","label":"Inactividad (min)"}
    ]'::jsonb;

  elsif v_report='logistics' then
    if to_regclass('erp_supply.logistics_shipments') is null then
      raise exception 'La fuente Logistics todavía no está disponible' using errcode='P0002';
    end if;
    if not (
      erp_private.can_access_module('shipping','read')
      or erp_private.can_access_module('sales','read')
      or erp_private.can_access_module('audit','read')
    ) then
      raise exception 'No autorizado para consultar logística' using errcode='42501';
    end if;

    execute $q$
      select count(*)::integer
      from erp_supply.logistics_shipments s
      join erp_supply.orders o on o.id=s.order_id
      where s.organization_id=$1
        and s.released_at>=$2 and s.released_at<$3
        and ($4 is null or s.status=$4)
        and ($5 is null or s.route_code=$5)
        and (
          $6 is null
          or lower(concat_ws(' ',o.order_number,o.client_name,coalesce(s.tracking_number,'')))
             like '%'||$6||'%'
        )
    $q$ into v_total using v_org,v_start,v_end,v_status,v_route,v_search;

    execute $q$
      select coalesce(jsonb_agg(to_jsonb(x) order by x."releasedAt" desc),'[]'::jsonb)
      from (
        select
          o.order_number "orderNumber",
          o.client_name client,
          s.route_code route,
          s.status,
          s.tracking_number "trackingNumber",
          s.estimated_freight "estimatedFreight",
          s.actual_freight "actualFreight",
          s.released_at "releasedAt",
          s.dispatched_at "dispatchedAt",
          s.delivered_at "deliveredAt"
        from erp_supply.logistics_shipments s
        join erp_supply.orders o on o.id=s.order_id
        where s.organization_id=$1
          and s.released_at>=$2 and s.released_at<$3
          and ($4 is null or s.status=$4)
          and ($5 is null or s.route_code=$5)
          and (
            $6 is null
            or lower(concat_ws(' ',o.order_number,o.client_name,coalesce(s.tracking_number,'')))
               like '%'||$6||'%'
          )
        order by s.released_at desc
        limit $7 offset $8
      ) x
    $q$ into v_rows
    using v_org,v_start,v_end,v_status,v_route,v_search,v_size,v_offset;

    v_columns:='[
      {"key":"orderNumber","label":"Pedido"},
      {"key":"client","label":"Cliente"},
      {"key":"route","label":"Modalidad"},
      {"key":"status","label":"Estado"},
      {"key":"trackingNumber","label":"Guía"},
      {"key":"estimatedFreight","label":"Flete estimado"},
      {"key":"actualFreight","label":"Flete real"},
      {"key":"releasedAt","label":"Liberado"},
      {"key":"dispatchedAt","label":"Despachado"},
      {"key":"deliveredAt","label":"Entregado"}
    ]'::jsonb;

  else
    raise exception 'Reporte no soportado' using errcode='22023';
  end if;

  return jsonb_build_object(
    'report',v_report,
    'columns',v_columns,
    'rows',coalesce(v_rows,'[]'::jsonb),
    'pagination',jsonb_build_object(
      'page',v_page,
      'pageSize',v_size,
      'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'range',jsonb_build_object('from',v_from,'to',v_to,'timezone',v_tz),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_analytics_record_export(
  p_report text,
  p_filters jsonb,
  p_format text,
  p_row_count integer
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_id uuid;
  v_format text:=upper(btrim(coalesce(p_format,'')));
begin
  if v_org is null or v_actor is null
     or not erp_private.can_access_module('reports','read') then
    raise exception 'No autorizado para registrar exportación' using errcode='42501';
  end if;
  if v_format<>'CSV' then
    raise exception 'Formato de exportación no soportado' using errcode='22023';
  end if;
  if p_row_count is null or p_row_count<0 or p_row_count>100 then
    raise exception 'Cantidad exportada fuera del límite de página' using errcode='22023';
  end if;

  insert into erp_supply.analytics_export_audit(
    organization_id,actor_profile_id,report_code,format,filters,row_count
  )
  values(
    v_org,v_actor,lower(btrim(p_report)),v_format,coalesce(p_filters,'{}'::jsonb),p_row_count
  )
  returning id into v_id;

  return jsonb_build_object('success',true,'auditId',v_id,'contractVersion','1.0.0');
end;
$$;

revoke all on function public.erp_x_analytics_report_catalog() from public,anon;
revoke all on function public.erp_x_analytics_report(text,jsonb,integer,integer) from public,anon;
revoke all on function public.erp_x_analytics_record_export(text,jsonb,text,integer)
from public,anon;

grant execute on function public.erp_x_analytics_report_catalog() to authenticated;
grant execute on function public.erp_x_analytics_report(text,jsonb,integer,integer)
to authenticated;
grant execute on function public.erp_x_analytics_record_export(text,jsonb,text,integer)
to authenticated;

commit;
