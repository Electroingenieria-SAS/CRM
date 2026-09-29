begin;

insert into erp_supply.analytics_kpi_catalog(
  code,name,definition,formula,source,temporal_scope,supported_filters,limitations,sort_order
) values
(
  'ORDERS_CLOSED','Pedidos cerrados',
  'Pedidos cuyo cierre ocurrió dentro del rango solicitado.',
  'count(orders where closed_at is within range)',
  'erp_supply.orders.closed_at',
  'closed_at dentro del rango local de la organización',
  array['date','client','seller','step','status','route','segment'],
  null,25
),
(
  'DELIVERIES_PENDING','Entregas pendientes',
  'Pedidos activos ubicados en una etapa de entrega.',
  'count(active orders where current_step_code is a delivery route)',
  'erp_supply.orders.current_step_code',
  'snapshot intersectando el rango solicitado',
  array['date','client','seller','responsible','route','segment'],
  'Hasta que Logistics esté fusionado, expresa cola por etapa y no estado físico del envío.',45
)
on conflict (code) do update set
  name=excluded.name,
  definition=excluded.definition,
  formula=excluded.formula,
  source=excluded.source,
  temporal_scope=excluded.temporal_scope,
  supported_filters=excluded.supported_filters,
  limitations=excluded.limitations,
  active=true,
  sort_order=excluded.sort_order,
  updated_at=now();

create or replace function public.erp_x_analytics_kpis()
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if not (
    erp_private.can_access_module('dashboard','read')
    or erp_private.can_access_module('vsm','read')
    or erp_private.can_access_module('reports','read')
  ) then
    raise exception 'No autorizado para consultar catálogo de indicadores' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code',k.code,
      'name',k.name,
      'definition',k.definition,
      'formula',k.formula,
      'source',k.source,
      'temporalScope',k.temporal_scope,
      'filters',k.supported_filters,
      'limitations',k.limitations
    ) order by k.sort_order,k.code)
    from erp_supply.analytics_kpi_catalog k
    where k.active
  ),'[]'::jsonb);
end;
$$;

create or replace function public.erp_x_analytics_dashboard(
  p_from date default null,
  p_to date default null,
  p_client text default null,
  p_seller_id uuid default null,
  p_responsible_id uuid default null,
  p_step text default null,
  p_status text default null,
  p_route text default null,
  p_segment text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_tz text;
  v_today date;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_client text:=lower(nullif(btrim(coalesce(p_client,'')),''));
  v_step text:=upper(nullif(btrim(coalesce(p_step,'')),''));
  v_status text:=upper(nullif(btrim(coalesce(p_status,'')),''));
  v_route text:=upper(nullif(btrim(coalesce(p_route,'')),''));
  v_segment text:=upper(nullif(btrim(coalesce(p_segment,'')),''));
  v_core jsonb;
  v_workforce jsonb;
  v_customer jsonb;
  v_freight jsonb;
  v_inventory jsonb;
  v_logistics jsonb;
  v_has_workforce boolean;
  v_has_customer boolean;
  v_has_freight boolean;
  v_has_inventory boolean;
  v_has_logistics boolean:=false;
begin
  if v_org is null
     or not erp_private.can_access_module('dashboard','read')
     or not erp_private.can_access_module('orders','read') then
    raise exception 'No autorizado para consultar dashboard' using errcode='42501';
  end if;

  select coalesce(o.timezone,'America/Bogota')
  into v_tz
  from erp_supply.organizations o
  where o.id=v_org;

  v_today:=(now() at time zone v_tz)::date;
  v_from:=coalesce(p_from,v_today);
  v_to:=coalesce(p_to,v_from);

  if v_to<v_from or v_to-v_from>31 then
    raise exception 'Rango de dashboard inválido; máximo 32 días' using errcode='22023';
  end if;

  if v_segment is not null
     and not erp_private.can_access_module('customer_intelligence','read') then
    raise exception 'El filtro de segmento requiere acceso a inteligencia de clientes'
      using errcode='42501';
  end if;

  v_start:=v_from::timestamp at time zone v_tz;
  v_end:=(v_to+1)::timestamp at time zone v_tz;

  with scope as (
    select o.*
    from erp_supply.orders o
    where o.organization_id=v_org
      and not o.is_test
      and (v_client is null or lower(o.client_name) like '%'||v_client||'%')
      and (p_seller_id is null or o.seller_profile_id=p_seller_id)
      and (p_responsible_id is null or o.current_assignee_id=p_responsible_id)
      and (v_step is null or o.current_step_code=v_step)
      and (v_status is null or o.status=v_status)
      and (v_route is null or o.delivery_route_code=v_route)
      and (
        v_segment is null
        or exists(
          select 1
          from erp_supply.customer_intelligence_current ci
          where ci.organization_id=v_org
            and ci.customer_id=o.customer_id
            and ci.segment=v_segment
        )
      )
  ),
  created_scope as (
    select * from scope
    where created_at>=v_start and created_at<v_end
  ),
  active_scope as (
    select * from scope
    where created_at<v_end
      and coalesce(closed_at,cancelled_at,now())>=v_start
      and status not in('CLOSED','CANCELLED')
  ),
  closed_scope as (
    select * from scope
    where closed_at>=v_start and closed_at<v_end
  ),
  by_step as (
    select
      o.current_step_code code,
      ws.name,
      ws.sla_hours,
      count(*)::integer total,
      count(*) filter(
        where o.status='BLOCKED'
           or exists(
             select 1 from erp_supply.order_blocks b
             where b.organization_id=v_org and b.order_id=o.id and b.status='OPEN'
           )
      )::integer blocked,
      count(*) filter(
        where ws.sla_hours is not null
          and o.updated_at < now()-(ws.sla_hours::double precision*interval '1 hour')
      )::integer overdue
    from active_scope o
    join erp_supply.workflow_steps ws on ws.code=o.current_step_code
    group by o.current_step_code,ws.name,ws.sla_hours,ws.sort_order
    order by ws.sort_order
  ),
  alert_rows as (
    select
      o.id,
      o.order_number,
      o.client_name,
      o.current_step_code,
      ws.name step_name,
      o.status,
      o.updated_at,
      extract(epoch from (now()-o.updated_at))/60 age_minutes,
      case
        when o.status='BLOCKED'
          or exists(
            select 1 from erp_supply.order_blocks b
            where b.organization_id=v_org and b.order_id=o.id and b.status='OPEN'
          )
        then 'BLOCKED'
        else 'OVERDUE'
      end alert_type,
      case
        when o.status='BLOCKED' then 'critical'
        when ws.sla_hours is not null
          and o.updated_at < now()-(2*ws.sla_hours::double precision*interval '1 hour')
        then 'critical'
        else 'warning'
      end severity
    from active_scope o
    join erp_supply.workflow_steps ws on ws.code=o.current_step_code
    where o.status='BLOCKED'
       or exists(
         select 1 from erp_supply.order_blocks b
         where b.organization_id=v_org and b.order_id=o.id and b.status='OPEN'
       )
       or (
         ws.sla_hours is not null
         and o.updated_at < now()-(ws.sla_hours::double precision*interval '1 hour')
       )
    order by
      case when o.status='BLOCKED' then 0 else 1 end,
      o.updated_at
    limit 20
  )
  select jsonb_build_object(
    'range',jsonb_build_object(
      'from',v_from,'to',v_to,'timezone',v_tz
    ),
    'summary',jsonb_build_object(
      'ordersTotal',(select count(*)::integer from created_scope),
      'ordersActive',(select count(*)::integer from active_scope),
      'ordersClosed',(select count(*)::integer from closed_scope),
      'ordersBlocked',(
        select count(*)::integer
        from active_scope o
        where o.status='BLOCKED'
           or exists(
             select 1 from erp_supply.order_blocks b
             where b.organization_id=v_org and b.order_id=o.id and b.status='OPEN'
           )
      ),
      'financialPending',(
        select count(*)::integer
        from active_scope
        where current_step_code in('CARTERA','CAJA','CAJA_FACTURACION')
      ),
      'deliveriesPending',(
        select count(*)::integer
        from active_scope
        where current_step_code in(
          'CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH','CLOSURE'
        )
      )
    ),
    'ordersByStep',coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',s.code,
        'name',s.name,
        'count',s.total,
        'blocked',s.blocked,
        'overdue',s.overdue,
        'slaHours',s.sla_hours
      ) order by s.code)
      from by_step s
    ),'[]'::jsonb),
    'alerts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'orderId',a.id,
        'orderNumber',a.order_number,
        'clientName',a.client_name,
        'stepCode',a.current_step_code,
        'stepName',a.step_name,
        'status',a.status,
        'alertType',a.alert_type,
        'severity',a.severity,
        'ageMinutes',round(a.age_minutes::numeric,0),
        'updatedAt',a.updated_at
      ))
      from alert_rows a
    ),'[]'::jsonb)
  )
  into v_core;

  v_has_workforce:=
    erp_private.can_access_module('workforce','read')
    and erp_private.can_access_module('orders','read');

  if v_has_workforce then
    v_workforce:=public.erp_x_order_workforce_indicators(v_from,v_to);
  end if;

  v_has_customer:=erp_private.can_access_module('customer_intelligence','read');
  if v_has_customer then
    select jsonb_build_object(
      'customers',count(*)::integer,
      'paidAmount',coalesce(sum(ci.paid_amount),0),
      'orders',coalesce(sum(ci.valid_order_count),0),
      'bySegment',coalesce((
        select jsonb_object_agg(x.segment,x.total order by x.segment)
        from (
          select segment,count(*)::integer total
          from erp_supply.customer_intelligence_current
          where organization_id=v_org
          group by segment
        ) x
      ),'{}'::jsonb)
    )
    into v_customer
    from erp_supply.customer_intelligence_current ci
    where ci.organization_id=v_org;
  end if;

  v_has_freight:=erp_private.can_access_module('freight','read');
  if v_has_freight then
    v_freight:=public.erp_x_freight_metrics();
  end if;

  v_has_inventory:=erp_private.can_access_module('inventory','read');
  if v_has_inventory then
    select jsonb_build_object(
      'onHand',coalesce(sum(b.on_hand),0),
      'reserved',coalesce(sum(b.reserved),0),
      'committed',coalesce(sum(b.committed),0),
      'available',coalesce(sum(b.on_hand-b.reserved-b.committed),0),
      'fullyAllocatedBalances',count(*) filter(
        where b.on_hand>0 and b.on_hand-b.reserved-b.committed=0
      )::integer,
      'criticalSignalAvailable',false
    )
    into v_inventory
    from erp_supply.inventory_balances b
    where b.organization_id=v_org;
  end if;

  if to_regclass('erp_supply.logistics_shipments') is not null
     and (
       erp_private.can_access_module('shipping','read')
       or erp_private.can_access_module('sales','read')
       or erp_private.can_access_module('audit','read')
     ) then
    execute $q$
      select jsonb_build_object(
        'ready',count(*) filter(where status='READY')::integer,
        'inTransit',count(*) filter(where status='IN_TRANSIT')::integer,
        'delivered',count(*) filter(where status='DELIVERED')::integer,
        'failed',count(*) filter(where status='DELIVERY_FAILED')::integer,
        'returned',count(*) filter(where status='RETURNED')::integer,
        'pending',count(*) filter(where status in('READY','IN_TRANSIT','DELIVERY_FAILED'))::integer
      )
      from erp_supply.logistics_shipments
      where organization_id=$1
    $q$ into v_logistics using v_org;
    v_has_logistics:=true;
  end if;

  return v_core||jsonb_build_object(
    'workforce',v_workforce,
    'customerIntelligence',v_customer,
    'freight',v_freight,
    'inventory',v_inventory,
    'logistics',v_logistics,
    'sources',jsonb_build_object(
      'orders',true,
      'workforce',v_has_workforce,
      'customerIntelligence',v_has_customer,
      'freight',v_has_freight,
      'inventory',v_has_inventory,
      'logistics',v_has_logistics
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_analytics_kpis() from public,anon;
revoke all on function public.erp_x_analytics_dashboard(
  date,date,text,uuid,uuid,text,text,text,text
) from public,anon;

grant execute on function public.erp_x_analytics_kpis() to authenticated;
grant execute on function public.erp_x_analytics_dashboard(
  date,date,text,uuid,uuid,text,text,text,text
) to authenticated;

commit;
