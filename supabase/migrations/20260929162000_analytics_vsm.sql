begin;

create table erp_supply.analytics_historical_stage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  external_order_key text not null,
  order_number text not null,
  client_name text,
  seller_reference text,
  route_code text,
  step_code text not null references erp_supply.workflow_steps(code),
  task_created_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  waiting_seconds bigint not null default 0 check (waiting_seconds>=0),
  processing_seconds bigint not null default 0 check (processing_seconds>=0),
  blocked_seconds bigint not null default 0 check (blocked_seconds>=0),
  transit_seconds bigint check (transit_seconds is null or transit_seconds>=0),
  source text not null,
  external_key text not null,
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id,source,external_key)
);

create index idx_analytics_history_stage_time
on erp_supply.analytics_historical_stage_events(
  organization_id,step_code,task_created_at,completed_at
);

alter table erp_supply.analytics_historical_stage_events enable row level security;

create policy analytics_historical_stage_events_read
on erp_supply.analytics_historical_stage_events
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('vsm','read')
    or erp_private.can_access_module('reports','read')
    or erp_private.can_access_module('imports','read')
  )
);

grant select on erp_supply.analytics_historical_stage_events to authenticated;
revoke insert,update,delete on erp_supply.analytics_historical_stage_events
from authenticated;

create or replace function erp_private.analytics_stage_metrics_all(
  p_organization_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  source_kind text,
  source_key text,
  order_id uuid,
  order_number text,
  customer_id uuid,
  client_name text,
  seller_profile_id uuid,
  route_code text,
  order_status text,
  step_code text,
  step_name text,
  sequence_no integer,
  task_status text,
  task_created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  waiting_seconds bigint,
  processing_seconds bigint,
  blocked_seconds bigint,
  transit_seconds bigint,
  total_seconds bigint
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if p_organization_id is null
     or p_organization_id is distinct from erp_private.current_org_id() then
    raise exception 'Organización analítica no autorizada' using errcode='42501';
  end if;
  if p_from is null or p_to is null or p_to<=p_from then
    raise exception 'Rango analítico inválido' using errcode='22023';
  end if;

  return query
  with operational as (
    select m.*
    from erp_private.analytics_stage_metrics(p_organization_id,p_from,p_to) m
  )
  select
    'OPERATIONAL'::text,
    o.order_id::text,
    o.order_id,
    o.order_number,
    o.customer_id,
    o.client_name,
    o.seller_profile_id,
    ord.delivery_route_code,
    ord.status,
    o.step_code,
    o.step_name,
    o.sequence_no,
    o.task_status,
    o.task_created_at,
    o.started_at,
    o.completed_at,
    o.waiting_seconds,
    o.processing_seconds,
    o.blocked_seconds,
    null::bigint,
    o.total_seconds
  from operational o
  join erp_supply.orders ord on ord.id=o.order_id

  union all

  select
    'HISTORICAL'::text,
    h.external_order_key,
    null::uuid,
    h.order_number,
    null::uuid,
    h.client_name,
    null::uuid,
    h.route_code,
    'HISTORICAL'::text,
    h.step_code,
    ws.name,
    0,
    'HISTORICAL'::text,
    h.task_created_at,
    h.started_at,
    h.completed_at,
    h.waiting_seconds,
    h.processing_seconds,
    h.blocked_seconds,
    h.transit_seconds,
    (
      h.waiting_seconds+h.processing_seconds+h.blocked_seconds+coalesce(h.transit_seconds,0)
    )::bigint
  from erp_supply.analytics_historical_stage_events h
  join erp_supply.workflow_steps ws on ws.code=h.step_code
  where h.organization_id=p_organization_id
    and h.task_created_at<p_to
    and coalesce(h.completed_at,h.started_at,h.task_created_at)>=p_from;
end;
$$;

revoke all on function erp_private.analytics_stage_metrics_all(uuid,timestamptz,timestamptz)
from public,anon;
grant execute on function erp_private.analytics_stage_metrics_all(uuid,timestamptz,timestamptz)
to authenticated;

create or replace function public.erp_x_analytics_vsm_summary(
  p_from date default null,
  p_to date default null,
  p_client text default null,
  p_seller_id uuid default null,
  p_step text default null,
  p_status text default null,
  p_route text default null,
  p_source text default null
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
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_client text:=lower(nullif(btrim(coalesce(p_client,'')),''));
  v_step text:=upper(nullif(btrim(coalesce(p_step,'')),''));
  v_status text:=upper(nullif(btrim(coalesce(p_status,'')),''));
  v_route text:=upper(nullif(btrim(coalesce(p_route,'')),''));
  v_source text:=upper(nullif(btrim(coalesce(p_source,'')),''));
  v_result jsonb;
begin
  if v_org is null
     or not erp_private.can_access_module('vsm','read')
     or not erp_private.can_access_module('orders','read') then
    raise exception 'No autorizado para consultar VSM' using errcode='42501';
  end if;

  select coalesce(timezone,'America/Bogota') into v_tz
  from erp_supply.organizations where id=v_org;

  v_from:=coalesce(p_from,((now() at time zone v_tz)::date-29));
  v_to:=coalesce(p_to,(now() at time zone v_tz)::date);

  if v_to<v_from or v_to-v_from>365 then
    raise exception 'Rango VSM inválido; máximo 366 días' using errcode='22023';
  end if;

  v_start:=v_from::timestamp at time zone v_tz;
  v_end:=(v_to+1)::timestamp at time zone v_tz;

  with filtered as (
    select *
    from erp_private.analytics_stage_metrics_all(v_org,v_start,v_end) m
    where (v_client is null or lower(coalesce(m.client_name,'')) like '%'||v_client||'%')
      and (p_seller_id is null or m.seller_profile_id=p_seller_id)
      and (v_step is null or m.step_code=v_step)
      and (v_status is null or m.order_status=v_status)
      and (v_route is null or m.route_code=v_route)
      and (v_source is null or m.source_kind=v_source)
  ),
  stage_rollup as (
    select
      f.step_code,
      max(f.step_name) step_name,
      count(*)::integer samples,
      round(avg(f.waiting_seconds)/60.0,2) avg_waiting_minutes,
      round(avg(f.processing_seconds)/60.0,2) avg_processing_minutes,
      round(avg(f.blocked_seconds)/60.0,2) avg_blocked_minutes,
      round(avg(f.total_seconds)/60.0,2) avg_total_minutes,
      round(percentile_cont(0.5) within group(order by f.total_seconds)/60.0,2) median_minutes,
      round(percentile_cont(0.75) within group(order by f.total_seconds)/60.0,2) p75_minutes,
      round(percentile_cont(0.90) within group(order by f.total_seconds)/60.0,2) p90_minutes,
      round(percentile_cont(0.95) within group(order by f.total_seconds)/60.0,2) p95_minutes
    from filtered f
    group by f.step_code
  ),
  order_cycles as (
    select
      source_kind,
      source_key,
      min(task_created_at) first_at,
      max(coalesce(completed_at,started_at,task_created_at)) last_at,
      sum(waiting_seconds)::bigint waiting_seconds,
      sum(processing_seconds)::bigint processing_seconds,
      sum(blocked_seconds)::bigint blocked_seconds,
      sum(coalesce(transit_seconds,0))::bigint transit_seconds,
      sum(total_seconds)::bigint stage_seconds
    from filtered
    group by source_kind,source_key
  ),
  stage_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'stepCode',s.step_code,
      'stepName',s.step_name,
      'samples',s.samples,
      'averageWaitingMinutes',s.avg_waiting_minutes,
      'averageProcessingMinutes',s.avg_processing_minutes,
      'averageBlockedMinutes',s.avg_blocked_minutes,
      'averageTotalMinutes',s.avg_total_minutes,
      'medianMinutes',s.median_minutes,
      'p75Minutes',s.p75_minutes,
      'p90Minutes',s.p90_minutes,
      'p95Minutes',s.p95_minutes,
      'currentQueue',(
        select count(*)::integer
        from erp_supply.orders o
        where o.organization_id=v_org
          and o.current_step_code=s.step_code
          and o.status not in('CLOSED','CANCELLED')
          and not o.is_test
      )
    ) order by s.avg_waiting_minutes desc,s.step_code),'[]'::jsonb) value
    from stage_rollup s
  ),
  bottleneck_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'stepCode',x.step_code,
      'stepName',x.step_name,
      'evidence',jsonb_build_object(
        'averageWaitingMinutes',x.avg_waiting_minutes,
        'averageTotalMinutes',x.avg_total_minutes,
        'p90Minutes',x.p90_minutes,
        'samples',x.samples,
        'currentQueue',x.current_queue,
        'blockedOrders',x.blocked_orders
      )
    ) order by x.avg_waiting_minutes desc,x.current_queue desc),'[]'::jsonb) value
    from (
      select
        s.*,
        (
          select count(*)::integer
          from erp_supply.orders o
          where o.organization_id=v_org
            and o.current_step_code=s.step_code
            and o.status not in('CLOSED','CANCELLED')
            and not o.is_test
        ) current_queue,
        (
          select count(*)::integer
          from erp_supply.orders o
          where o.organization_id=v_org
            and o.current_step_code=s.step_code
            and o.status='BLOCKED'
            and not o.is_test
        ) blocked_orders
      from stage_rollup s
      order by s.avg_waiting_minutes desc
      limit 8
    ) x
  )
  select jsonb_build_object(
    'range',jsonb_build_object('from',v_from,'to',v_to,'timezone',v_tz),
    'overall',jsonb_build_object(
      'orders',count(*)::integer,
      'averageStageCycleMinutes',coalesce(round(avg(stage_seconds)/60.0,2),0),
      'medianStageCycleMinutes',coalesce(round(
        percentile_cont(0.5) within group(order by stage_seconds)/60.0,2
      ),0),
      'p90StageCycleMinutes',coalesce(round(
        percentile_cont(0.90) within group(order by stage_seconds)/60.0,2
      ),0),
      'averageWaitingMinutes',coalesce(round(avg(waiting_seconds)/60.0,2),0),
      'averageProcessingMinutes',coalesce(round(avg(processing_seconds)/60.0,2),0),
      'averageBlockedMinutes',coalesce(round(avg(blocked_seconds)/60.0,2),0),
      'averageTransitMinutes',coalesce(round(avg(transit_seconds)/60.0,2),0)
    ),
    'stages',(select value from stage_json),
    'bottlenecks',(select value from bottleneck_json),
    'definitions',jsonb_build_object(
      'waiting','Desde creación de la etapa hasta inicio efectivo.',
      'processing','Tiempo laboral iniciado menos bloqueos explícitos.',
      'blocked','Intervalos de bloqueo explícito.',
      'transit','Solo se informa cuando existe una fuente explícita de tránsito.',
      'total','Ciclo de la etapa; no se denomina tiempo productivo.'
    ),
    'contractVersion','1.0.0'
  )
  into v_result
  from order_cycles;

  return v_result;
end;
$$;

create or replace function public.erp_x_analytics_order_vsm(
  p_order_id uuid default null,
  p_external_order_key text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_from timestamptz;
  v_to timestamptz:=now()+interval '1 second';
  v_key text:=nullif(btrim(coalesce(p_external_order_key,'')),'');
  v_stages jsonb;
  v_logistics jsonb;
  v_source text;
  v_order_number text;
  v_client text;
  v_created timestamptz;
  v_closed timestamptz;
begin
  if v_org is null
     or not erp_private.can_access_module('vsm','read')
     or not erp_private.can_access_module('orders','read') then
    raise exception 'No autorizado para consultar VSM' using errcode='42501';
  end if;

  if p_order_id is null and v_key is null then
    raise exception 'Debe indicar pedido operativo o clave histórica' using errcode='22023';
  end if;

  if p_order_id is not null then
    select * into v_order
    from erp_supply.orders
    where id=p_order_id and organization_id=v_org and not is_test;
    if not found then raise exception 'Pedido no disponible' using errcode='P0002'; end if;

    v_source:='OPERATIONAL';
    v_order_number:=v_order.order_number;
    v_client:=v_order.client_name;
    v_created:=v_order.created_at;
    v_closed:=v_order.closed_at;
    v_from:=v_order.created_at;

    select coalesce(jsonb_agg(jsonb_build_object(
      'stepCode',m.step_code,
      'stepName',m.step_name,
      'status',m.task_status,
      'createdAt',m.task_created_at,
      'startedAt',m.started_at,
      'completedAt',m.completed_at,
      'waitingMinutes',round(m.waiting_seconds/60.0,2),
      'processingMinutes',round(m.processing_seconds/60.0,2),
      'blockedMinutes',round(m.blocked_seconds/60.0,2),
      'transitMinutes',case when m.transit_seconds is null then null
                            else round(m.transit_seconds/60.0,2) end,
      'totalMinutes',round(m.total_seconds/60.0,2)
    ) order by m.sequence_no,m.task_created_at),'[]'::jsonb)
    into v_stages
    from erp_private.analytics_stage_metrics_all(v_org,v_from,v_to) m
    where m.source_kind='OPERATIONAL' and m.order_id=p_order_id;

    if to_regclass('erp_supply.logistics_shipments') is not null
       and (
         erp_private.can_access_module('shipping','read')
         or erp_private.can_access_module('sales','read')
         or erp_private.can_access_module('audit','read')
       ) then
      execute $q$
        select jsonb_build_object(
          'status',s.status,
          'releasedAt',s.released_at,
          'dispatchedAt',s.dispatched_at,
          'deliveredAt',s.delivered_at,
          'dispatchWaitingMinutes',case
            when s.dispatched_at is null then null
            else round(extract(epoch from (s.dispatched_at-s.released_at))/60.0,2)
          end,
          'transitMinutes',case
            when s.dispatched_at is null then null
            else round(extract(epoch from (coalesce(s.delivered_at,now())-s.dispatched_at))/60.0,2)
          end
        )
        from erp_supply.logistics_shipments s
        where s.organization_id=$1 and s.order_id=$2
      $q$ into v_logistics using v_org,p_order_id;
    end if;
  else
    v_source:='HISTORICAL';
    select
      min(h.order_number),
      min(h.client_name),
      min(h.task_created_at),
      max(h.completed_at)
    into v_order_number,v_client,v_created,v_closed
    from erp_supply.analytics_historical_stage_events h
    where h.organization_id=v_org and h.external_order_key=v_key;

    if v_created is null then
      raise exception 'Pedido histórico no disponible' using errcode='P0002';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'stepCode',h.step_code,
      'stepName',ws.name,
      'status','HISTORICAL',
      'createdAt',h.task_created_at,
      'startedAt',h.started_at,
      'completedAt',h.completed_at,
      'waitingMinutes',round(h.waiting_seconds/60.0,2),
      'processingMinutes',round(h.processing_seconds/60.0,2),
      'blockedMinutes',round(h.blocked_seconds/60.0,2),
      'transitMinutes',case when h.transit_seconds is null then null
                            else round(h.transit_seconds/60.0,2) end,
      'totalMinutes',round((
        h.waiting_seconds+h.processing_seconds+h.blocked_seconds+coalesce(h.transit_seconds,0)
      )/60.0,2)
    ) order by h.task_created_at),'[]'::jsonb)
    into v_stages
    from erp_supply.analytics_historical_stage_events h
    join erp_supply.workflow_steps ws on ws.code=h.step_code
    where h.organization_id=v_org and h.external_order_key=v_key;
  end if;

  return jsonb_build_object(
    'source',v_source,
    'orderId',p_order_id,
    'externalOrderKey',v_key,
    'orderNumber',v_order_number,
    'clientName',v_client,
    'createdAt',v_created,
    'closedAt',v_closed,
    'leadTimeMinutes',case
      when v_created is null then null
      else round(
        erp_private.workforce_business_seconds(v_org,v_created,coalesce(v_closed,now()))/60.0,
        2
      )
    end,
    'stages',v_stages,
    'logistics',v_logistics,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_analytics_vsm_summary(
  date,date,text,uuid,text,text,text,text
) from public,anon;
revoke all on function public.erp_x_analytics_order_vsm(uuid,text) from public,anon;

grant execute on function public.erp_x_analytics_vsm_summary(
  date,date,text,uuid,text,text,text,text
) to authenticated;
grant execute on function public.erp_x_analytics_order_vsm(uuid,text) to authenticated;

commit;
