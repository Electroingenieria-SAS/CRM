begin;

create or replace function erp_private.customer_invoice_effective_paid(
  p_amount numeric,
  p_reversed_amount numeric,
  p_status text
)
returns numeric
language sql
immutable
set search_path=pg_catalog
as $$
  select case upper(coalesce(p_status,''))
    when 'REGISTERED' then greatest(coalesce(p_amount,0),0)
    when 'PARTIALLY_REVERSED' then greatest(coalesce(p_amount,0)-coalesce(p_reversed_amount,0),0)
    else 0::numeric
  end
$$;

revoke all on function erp_private.customer_invoice_effective_paid(numeric,numeric,text)
from public,anon,authenticated;

create or replace function erp_private.recalculate_customer_intelligence()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_config erp_supply.customer_intelligence_algorithm_versions%rowtype;
  v_fingerprint text;
  v_run_id uuid;
  v_existing_run uuid;
  v_customer_count integer:=0;
  v_order_count bigint:=0;
  v_total_paid numeric(20,2):=0;
  v_started_at timestamptz:=clock_timestamp();
begin
  if v_org is null or v_actor is null then
    raise exception 'Usuario sin perfil operativo activo' using errcode='42501';
  end if;

  if not erp_private.can_access_module('customer_intelligence','admin') then
    raise exception 'No autorizado para recalcular inteligencia de clientes' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org::text,0));

  select *
  into v_config
  from erp_supply.customer_intelligence_algorithm_versions
  where organization_id=v_org and active
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No existe una versión activa del algoritmo';
  end if;

  drop table if exists pg_temp.ci_customer_base;

  create temporary table ci_customer_base
  on commit drop
  as
  with normalized as (
    select
      b.*,
      dense_rank() over(order by b.valid_order_count desc)::integer order_rank,
      dense_rank() over(order by b.paid_amount desc)::integer paid_rank,
      case
        when count(*) over()=1 then 0.5
        else percent_rank() over(order by b.valid_order_count)::numeric
      end frequency_norm,
      case
        when count(*) over()=1 then 0.5
        else percent_rank() over(order by b.paid_amount)::numeric
      end paid_norm,
      count(*) over()::integer sample_clients,
      sum(b.valid_order_count) over()::bigint sample_orders,
      sum(b.paid_amount) over()::numeric total_paid
    from pg_temp.ci_customer_base b
  ),
  scored0 as (
    select
      n.*,
      round(100*(
        v_config.order_weight*n.frequency_norm
        + v_config.paid_weight*n.paid_norm
      ),2)::numeric score
    from normalized n
  ),
  scored as (
    select
      s.*,
      dense_rank() over(order by s.score desc,s.paid_amount desc,s.valid_order_count desc)::integer overall_rank,
      case
        when count(*) over()=1 then 50::numeric
        else round(100*percent_rank() over(order by s.score),2)
      end percentile,
      round(100*s.frequency_norm,2)::numeric frequency_percentile,
      round(100*s.paid_norm,2)::numeric paid_percentile,
      round(100*s.valid_order_count::numeric/nullif(s.sample_orders,0),3)::numeric order_share_pct,
      case when s.total_paid>0
        then round(100*s.paid_amount/s.total_paid,3)::numeric
        else 0::numeric end paid_share_pct,
      round(100*sum(s.valid_order_count) over(
        order by s.score desc,s.paid_amount desc,s.valid_order_count desc,s.customer_id
        rows between unbounded preceding and current row
      )::numeric/nullif(s.sample_orders,0),3)::numeric cumulative_orders_pct,
      case when s.total_paid>0
        then round(100*sum(s.paid_amount) over(
          order by s.score desc,s.paid_amount desc,s.valid_order_count desc,s.customer_id
          rows between unbounded preceding and current row
        )/s.total_paid,3)::numeric
        else 0::numeric end cumulative_paid_pct
    from scored0 s
  ),
  classified as (
    select
      s.*,
      case
        when s.score>=v_config.urgent_min_score then 'URGENT'
        when s.score>=v_config.premium_min_score then 'PREMIUM'
        when s.score>=v_config.normal_min_score then 'NORMAL'
        else 'BASIC'
      end segment,
      case
        when s.valid_order_count>=v_config.high_support_orders then 'HIGH'
        when s.valid_order_count>=v_config.medium_support_orders then 'MEDIUM'
        else 'LOW'
      end support_level,
      (
        s.sample_clients<v_config.minimum_population_clients
        or s.sample_orders<v_config.minimum_population_orders
        or s.valid_order_count<v_config.medium_support_orders
      ) provisional
    from scored s
  )
  insert into erp_supply.customer_intelligence_history(
    organization_id,customer_id,run_id,algorithm_version,segment,previous_segment,
    score,valid_order_count,paid_amount
  )
  select
    v_org,c.customer_id,v_run_id,v_config.version,c.segment,prev.segment,
    c.score,c.valid_order_count,c.paid_amount
  from classified c
  left join erp_supply.customer_intelligence_current prev
    on prev.organization_id=v_org and prev.customer_id=c.customer_id
  where prev.customer_id is null or prev.segment is distinct from c.segment
  on conflict (run_id,customer_id) do nothing;

  with normalized as (
    select
      b.*,
      dense_rank() over(order by b.valid_order_count desc)::integer order_rank,
      dense_rank() over(order by b.paid_amount desc)::integer paid_rank,
      case when count(*) over()=1 then 0.5
        else percent_rank() over(order by b.valid_order_count)::numeric end frequency_norm,
      case when count(*) over()=1 then 0.5
        else percent_rank() over(order by b.paid_amount)::numeric end paid_norm,
      count(*) over()::integer sample_clients,
      sum(b.valid_order_count) over()::bigint sample_orders,
      sum(b.paid_amount) over()::numeric total_paid
    from pg_temp.ci_customer_base b
  ),
  scored0 as (
    select n.*,round(100*(
      v_config.order_weight*n.frequency_norm
      + v_config.paid_weight*n.paid_norm
    ),2)::numeric score
    from normalized n
  ),
  scored as (
    select
      s.*,
      dense_rank() over(order by s.score desc,s.paid_amount desc,s.valid_order_count desc)::integer overall_rank,
      case when count(*) over()=1 then 50::numeric
        else round(100*percent_rank() over(order by s.score),2) end percentile,
      round(100*s.frequency_norm,2)::numeric frequency_percentile,
      round(100*s.paid_norm,2)::numeric paid_percentile,
      round(100*s.valid_order_count::numeric/nullif(s.sample_orders,0),3)::numeric order_share_pct,
      case when s.total_paid>0 then round(100*s.paid_amount/s.total_paid,3)::numeric else 0::numeric end paid_share_pct,
      round(100*sum(s.valid_order_count) over(
        order by s.score desc,s.paid_amount desc,s.valid_order_count desc,s.customer_id
        rows between unbounded preceding and current row
      )::numeric/nullif(s.sample_orders,0),3)::numeric cumulative_orders_pct,
      case when s.total_paid>0 then round(100*sum(s.paid_amount) over(
        order by s.score desc,s.paid_amount desc,s.valid_order_count desc,s.customer_id
        rows between unbounded preceding and current row
      )/s.total_paid,3)::numeric else 0::numeric end cumulative_paid_pct
    from scored0 s
  ),
  classified as (
    select
      s.*,
      case
        when s.score>=v_config.urgent_min_score then 'URGENT'
        when s.score>=v_config.premium_min_score then 'PREMIUM'
        when s.score>=v_config.normal_min_score then 'NORMAL'
        else 'BASIC'
      end segment,
      case
        when s.valid_order_count>=v_config.high_support_orders then 'HIGH'
        when s.valid_order_count>=v_config.medium_support_orders then 'MEDIUM'
        else 'LOW'
      end support_level,
      (
        s.sample_clients<v_config.minimum_population_clients
        or s.sample_orders<v_config.minimum_population_orders
        or s.valid_order_count<v_config.medium_support_orders
      ) provisional
    from scored s
  )
  insert into erp_supply.customer_intelligence_current(
    organization_id,customer_id,run_id,algorithm_version,valid_order_count,paid_amount,
    order_rank,paid_rank,overall_rank,frequency_percentile,paid_percentile,percentile,
    score,segment,support_level,provisional,order_share_pct,paid_share_pct,
    cumulative_orders_pct,cumulative_paid_pct,first_order_at,last_order_at,
    sample_clients,sample_orders,calculated_at
  )
  select
    v_org,c.customer_id,v_run_id,v_config.version,c.valid_order_count,c.paid_amount,
    c.order_rank,c.paid_rank,c.overall_rank,c.frequency_percentile,c.paid_percentile,
    c.percentile,c.score,c.segment,c.support_level,c.provisional,c.order_share_pct,
    c.paid_share_pct,c.cumulative_orders_pct,c.cumulative_paid_pct,c.first_order_at,
    c.last_order_at,c.sample_clients,c.sample_orders,now()
  from classified c
  on conflict (organization_id,customer_id) do update set
    run_id=excluded.run_id,
    algorithm_version=excluded.algorithm_version,
    valid_order_count=excluded.valid_order_count,
    paid_amount=excluded.paid_amount,
    order_rank=excluded.order_rank,
    paid_rank=excluded.paid_rank,
    overall_rank=excluded.overall_rank,
    frequency_percentile=excluded.frequency_percentile,
    paid_percentile=excluded.paid_percentile,
    percentile=excluded.percentile,
    score=excluded.score,
    segment=excluded.segment,
    support_level=excluded.support_level,
    provisional=excluded.provisional,
    order_share_pct=excluded.order_share_pct,
    paid_share_pct=excluded.paid_share_pct,
    cumulative_orders_pct=excluded.cumulative_orders_pct,
    cumulative_paid_pct=excluded.cumulative_paid_pct,
    first_order_at=excluded.first_order_at,
    last_order_at=excluded.last_order_at,
    sample_clients=excluded.sample_clients,
    sample_orders=excluded.sample_orders,
    calculated_at=excluded.calculated_at;

  delete from erp_supply.customer_intelligence_current c
  where c.organization_id=v_org
    and not exists (
      select 1
      from erp_supply.orders o
      where o.organization_id=v_org
        and o.customer_id=c.customer_id
        and not o.is_test
        and o.status not in ('DRAFT','CANCELLED')
    );

  update erp_supply.customer_intelligence_runs
  set status='COMPLETED',completed_at=now()
  where id=v_run_id;

  insert into erp_supply.customer_intelligence_state(
    organization_id,dirty_since,dirty_reason,last_run_id,updated_at
  )
  values(v_org,null,null,v_run_id,now())
  on conflict (organization_id) do update set
    dirty_since=case
      when erp_supply.customer_intelligence_state.dirty_since is not null
       and erp_supply.customer_intelligence_state.dirty_since>v_started_at
      then erp_supply.customer_intelligence_state.dirty_since
      else null
    end,
    dirty_reason=case
      when erp_supply.customer_intelligence_state.dirty_since is not null
       and erp_supply.customer_intelligence_state.dirty_since>v_started_at
      then erp_supply.customer_intelligence_state.dirty_reason
      else null
    end,
    last_run_id=excluded.last_run_id,
    updated_at=now();

  return jsonb_build_object(
    'success',true,
    'reused',false,
    'runId',v_run_id,
    'algorithmVersion',v_config.version,
    'customerCount',v_customer_count,
    'validOrderCount',v_order_count,
    'totalPaid',v_total_paid
  );
exception
  when others then
    if v_run_id is not null then
      update erp_supply.customer_intelligence_runs
      set status='FAILED',completed_at=now(),error_code=sqlstate
      where id=v_run_id;
    end if;
    raise;
end;
$$;

revoke all on function erp_private.recalculate_customer_intelligence()
from public,anon;
grant execute on function erp_private.recalculate_customer_intelligence()
to authenticated;

comment on function erp_private.recalculate_customer_intelligence()
is 'Privileged internal aggregate: validates customer_intelligence.admin, locks only one organization, computes ranking/Pareto, stores history only on segment change.';

commit;
