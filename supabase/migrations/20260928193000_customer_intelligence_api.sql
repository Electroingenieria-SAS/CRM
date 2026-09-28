begin;

create or replace function public.erp_x_customer_intelligence_recalculate()
returns jsonb
language sql
volatile
security invoker
set search_path=pg_catalog,erp_private
as $$
  select erp_private.recalculate_customer_intelligence()
$$;

create or replace function public.erp_x_customer_intelligence_list(
  p_search text default null,
  p_segment text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_total bigint;
  v_rows jsonb;
  v_dirty timestamptz;
  v_last_calculated timestamptz;
  v_version text;
begin
  if not erp_private.can_access_module('customer_intelligence','read') then
    raise exception 'No autorizado para consultar inteligencia de clientes' using errcode='42501';
  end if;

  select s.dirty_since into v_dirty
  from erp_supply.customer_intelligence_state s
  where s.organization_id=v_org;

  select max(c.calculated_at),max(c.algorithm_version)
  into v_last_calculated,v_version
  from erp_supply.customer_intelligence_current c
  where c.organization_id=v_org;

  with filtered as (
    select c.*,cu.display_name,cu.document,cu.identity_kind
    from erp_supply.customer_intelligence_current c
    join erp_supply.customers cu on cu.id=c.customer_id
    where c.organization_id=v_org
      and (
        nullif(trim(p_search),'') is null
        or lower(cu.display_name) like '%'||lower(trim(p_search))||'%'
        or lower(coalesce(cu.document,'')) like '%'||lower(trim(p_search))||'%'
      )
      and (
        nullif(trim(p_segment),'') is null
        or c.segment=upper(trim(p_segment))
      )
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select c.*,cu.display_name,cu.document,cu.identity_kind
    from erp_supply.customer_intelligence_current c
    join erp_supply.customers cu on cu.id=c.customer_id
    where c.organization_id=v_org
      and (
        nullif(trim(p_search),'') is null
        or lower(cu.display_name) like '%'||lower(trim(p_search))||'%'
        or lower(coalesce(cu.document,'')) like '%'||lower(trim(p_search))||'%'
      )
      and (
        nullif(trim(p_segment),'') is null
        or c.segment=upper(trim(p_segment))
      )
    order by c.overall_rank,cu.display_name
    offset (v_page-1)*v_size
    limit v_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerId',customer_id,
    'customerName',display_name,
    'customerDocument',document,
    'identityKind',identity_kind,
    'validOrderCount',valid_order_count,
    'observationCount',valid_order_count,
    'paidAmount',paid_amount,
    'orderRank',order_rank,
    'paidRank',paid_rank,
    'overallRank',overall_rank,
    'frequencyPercentile',frequency_percentile,
    'paidPercentile',paid_percentile,
    'percentile',percentile,
    'score',score,
    'segment',segment,
    'supportLevel',support_level,
    'provisional',provisional,
    'orderSharePct',order_share_pct,
    'paidSharePct',paid_share_pct,
    'cumulativeOrdersPct',cumulative_orders_pct,
    'cumulativePaidPct',cumulative_paid_pct,
    'firstOrderAt',first_order_at,
    'lastOrderAt',last_order_at,
    'calculatedAt',calculated_at,
    'algorithmVersion',algorithm_version
  ) order by overall_rank,display_name),'[]'::jsonb)
  into v_rows
  from filtered;

  return jsonb_build_object(
    'items',v_rows,
    'pagination',jsonb_build_object(
      'page',v_page,
      'pageSize',v_size,
      'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'state',jsonb_build_object(
      'dirty',v_dirty is not null,
      'dirtySince',v_dirty,
      'lastCalculatedAt',v_last_calculated,
      'algorithmVersion',coalesce(v_version,'1.0.0')
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_customer_intelligence_detail(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_result jsonb;
begin
  if not erp_private.can_access_module('customer_intelligence','read') then
    raise exception 'No autorizado para consultar inteligencia de clientes' using errcode='42501';
  end if;

  select jsonb_build_object(
    'customer',jsonb_build_object(
      'id',cu.id,
      'name',cu.display_name,
      'document',cu.document,
      'identityKind',cu.identity_kind
    ),
    'metrics',jsonb_build_object(
      'validOrderCount',c.valid_order_count,
      'observationCount',c.valid_order_count,
      'paidAmount',c.paid_amount,
      'orderRank',c.order_rank,
      'paidRank',c.paid_rank,
      'overallRank',c.overall_rank,
      'frequencyPercentile',c.frequency_percentile,
      'paidPercentile',c.paid_percentile,
      'percentile',c.percentile,
      'score',c.score,
      'segment',c.segment,
      'supportLevel',c.support_level,
      'provisional',c.provisional,
      'firstOrderAt',c.first_order_at,
      'lastOrderAt',c.last_order_at,
      'calculatedAt',c.calculated_at,
      'algorithmVersion',c.algorithm_version
    ),
    'history',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'segment',h.segment,
        'previousSegment',h.previous_segment,
        'score',h.score,
        'validOrderCount',h.valid_order_count,
        'paidAmount',h.paid_amount,
        'algorithmVersion',h.algorithm_version,
        'changedAt',h.changed_at
      ) order by h.changed_at desc),'[]'::jsonb)
      from erp_supply.customer_intelligence_history h
      where h.organization_id=v_org and h.customer_id=cu.id
    ),
    'explanation',jsonb_build_object(
      'orderWeight',cfg.order_weight,
      'paidWeight',cfg.paid_weight,
      'normalMinScore',cfg.normal_min_score,
      'premiumMinScore',cfg.premium_min_score,
      'urgentMinScore',cfg.urgent_min_score,
      'paidSource','REGISTERED_INVOICES_NET_OF_REVERSALS'
    ),
    'contractVersion','1.0.0'
  )
  into v_result
  from erp_supply.customers cu
  join erp_supply.customer_intelligence_current c
    on c.organization_id=cu.organization_id and c.customer_id=cu.id
  join erp_supply.customer_intelligence_algorithm_versions cfg
    on cfg.organization_id=cu.organization_id
   and cfg.version=c.algorithm_version
  where cu.id=p_customer_id and cu.organization_id=v_org;

  if v_result is null then
    raise exception 'Cliente sin inteligencia calculada' using errcode='P0002';
  end if;

  return v_result;
end;
$$;

create or replace function public.erp_x_customer_intelligence_pareto()
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_orders_series jsonb;
  v_paid_series jsonb;
  v_summary jsonb;
begin
  if not erp_private.can_access_module('customer_intelligence','read') then
    raise exception 'No autorizado para consultar inteligencia de clientes' using errcode='42501';
  end if;

  with ranked as (
    select
      c.customer_id,
      cu.display_name,
      c.valid_order_count,
      row_number() over(
        order by c.valid_order_count desc,c.paid_amount desc,c.customer_id
      )::integer rank,
      count(*) over()::integer customer_count,
      sum(c.valid_order_count) over()::numeric total_orders
    from erp_supply.customer_intelligence_current c
    join erp_supply.customers cu on cu.id=c.customer_id
    where c.organization_id=v_org
  ),
  points as (
    select
      rank,customer_id,display_name,
      round(100*rank::numeric/nullif(customer_count,0),2) customer_pct,
      round(100*sum(valid_order_count) over(
        order by rank rows between unbounded preceding and current row
      )::numeric/nullif(total_orders,0),3) cumulative_pct
    from ranked
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rank',rank,'customerId',customer_id,'customerName',display_name,
    'customerPct',customer_pct,'cumulativePct',cumulative_pct
  ) order by rank),'[]'::jsonb)
  into v_orders_series
  from points;

  with ranked as (
    select
      c.customer_id,
      cu.display_name,
      c.paid_amount,
      row_number() over(
        order by c.paid_amount desc,c.valid_order_count desc,c.customer_id
      )::integer rank,
      count(*) over()::integer customer_count,
      sum(c.paid_amount) over()::numeric total_paid
    from erp_supply.customer_intelligence_current c
    join erp_supply.customers cu on cu.id=c.customer_id
    where c.organization_id=v_org
  ),
  points as (
    select
      rank,customer_id,display_name,
      round(100*rank::numeric/nullif(customer_count,0),2) customer_pct,
      case when total_paid>0 then round(100*sum(paid_amount) over(
        order by rank rows between unbounded preceding and current row
      )/total_paid,3) else 0::numeric end cumulative_pct
    from ranked
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'rank',rank,'customerId',customer_id,'customerName',display_name,
    'customerPct',customer_pct,'cumulativePct',cumulative_pct
  ) order by rank),'[]'::jsonb)
  into v_paid_series
  from points;

  with stats as (
    select
      count(*)::integer customers,
      coalesce(sum(valid_order_count),0)::bigint orders,
      coalesce(sum(paid_amount),0)::numeric paid_amount
    from erp_supply.customer_intelligence_current
    where organization_id=v_org
  ),
  order_top20 as (
    select coalesce(max(cumulative_pct),0)::numeric value
    from (
      select
        row_number() over(order by valid_order_count desc,paid_amount desc,customer_id) rank,
        count(*) over() cnt,
        round(100*sum(valid_order_count) over(
          order by valid_order_count desc,paid_amount desc,customer_id
          rows between unbounded preceding and current row
        )::numeric/nullif(sum(valid_order_count) over(),0),3) cumulative_pct
      from erp_supply.customer_intelligence_current
      where organization_id=v_org
    ) x
    where rank<=greatest(1,ceil(0.20*cnt)::integer)
  ),
  paid_top20 as (
    select coalesce(max(cumulative_pct),0)::numeric value
    from (
      select
        row_number() over(order by paid_amount desc,valid_order_count desc,customer_id) rank,
        count(*) over() cnt,
        case when sum(paid_amount) over()>0 then round(100*sum(paid_amount) over(
          order by paid_amount desc,valid_order_count desc,customer_id
          rows between unbounded preceding and current row
        )/sum(paid_amount) over(),3) else 0::numeric end cumulative_pct
      from erp_supply.customer_intelligence_current
      where organization_id=v_org
    ) x
    where rank<=greatest(1,ceil(0.20*cnt)::integer)
  )
  select jsonb_build_object(
    'customers',s.customers,
    'orders',s.orders,
    'paidAmount',s.paid_amount,
    'top20CustomersPaidPct',p.value,
    'top20CustomersOrdersPct',o.value
  )
  into v_summary
  from stats s cross join order_top20 o cross join paid_top20 p;

  return jsonb_build_object(
    'ordersSeries',v_orders_series,
    'paidSeries',v_paid_series,
    'summary',coalesce(v_summary,'{}'::jsonb),
    'contractVersion','1.1.0'
  );
end;
$$;

create or replace function public.erp_x_customer_priority_signal(
  p_client_document text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_document text:=nullif(upper(regexp_replace(trim(coalesce(p_client_document,'')),'[^A-Za-z0-9]','','g')),'');
  v_result jsonb;
begin
  if not (
    erp_private.can_access_module('orders','create')
    or erp_private.can_access_module('customer_intelligence','read')
  ) then
    raise exception 'No autorizado para consultar prioridad automática' using errcode='42501';
  end if;

  if v_document is null then
    return jsonb_build_object(
      'segment','NORMAL','orderPriority','MEDIUM','score',0,
      'provisional',true,'supportLevel','LOW',
      'reason','CUSTOMER_IDENTITY_NOT_ESTABLISHED',
      'algorithmVersion','1.0.0'
    );
  end if;

  select jsonb_build_object(
    'customerId',cu.id,
    'segment',c.segment,
    'orderPriority',case c.segment
      when 'URGENT' then 'URGENT'
      when 'PREMIUM' then 'HIGH'
      when 'NORMAL' then 'MEDIUM'
      else 'LOW' end,
    'score',c.score,
    'overallRank',c.overall_rank,
    'provisional',c.provisional,
    'supportLevel',c.support_level,
    'algorithmVersion',c.algorithm_version
  )
  into v_result
  from erp_supply.customers cu
  join erp_supply.customer_intelligence_current c
    on c.organization_id=cu.organization_id and c.customer_id=cu.id
  where cu.organization_id=v_org and cu.normalized_document=v_document;

  return coalesce(v_result,jsonb_build_object(
    'segment','NORMAL','orderPriority','MEDIUM','score',0,
    'provisional',true,'supportLevel','LOW',
    'reason','NO_HISTORY_YET',
    'algorithmVersion','1.0.0'
  ));
end;
$$;

revoke all on function public.erp_x_customer_intelligence_recalculate() from public,anon;
revoke all on function public.erp_x_customer_intelligence_list(text,text,integer,integer) from public,anon;
revoke all on function public.erp_x_customer_intelligence_detail(uuid) from public,anon;
revoke all on function public.erp_x_customer_intelligence_pareto() from public,anon;
revoke all on function public.erp_x_customer_priority_signal(text) from public,anon;

grant execute on function public.erp_x_customer_intelligence_recalculate() to authenticated;
grant execute on function public.erp_x_customer_intelligence_list(text,text,integer,integer) to authenticated;
grant execute on function public.erp_x_customer_intelligence_detail(uuid) to authenticated;
grant execute on function public.erp_x_customer_intelligence_pareto() to authenticated;
grant execute on function public.erp_x_customer_priority_signal(text) to authenticated;

commit;
