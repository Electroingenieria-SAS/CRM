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
  v_last_run uuid;
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
  create temporary table ci_customer_base on commit drop as
  with valid_orders as (
    select o.id,o.customer_id,o.created_at
    from erp_supply.orders o
    where o.organization_id=v_org
      and not o.is_test
      and o.customer_id is not null
      and o.status not in ('DRAFT','CANCELLED')
  ),
  paid_by_order as (
    select
      i.order_id,
      coalesce(sum(erp_private.customer_invoice_effective_paid(
        i.amount,i.reversed_amount,i.status
      )),0)::numeric paid_amount
    from erp_supply.invoices i
    join valid_orders vo on vo.id=i.order_id
    where i.organization_id=v_org
    group by i.order_id
  )
  select
    vo.customer_id,
    count(*)::bigint valid_order_count,
    coalesce(sum(p.paid_amount),0)::numeric(20,2) paid_amount,
    min(vo.created_at) first_order_at,
    max(vo.created_at) last_order_at
  from valid_orders vo
  left join paid_by_order p on p.order_id=vo.id
  group by vo.customer_id;

  select
    count(*)::integer,
    coalesce(sum(valid_order_count),0)::bigint,
    coalesce(sum(paid_amount),0)::numeric(20,2)
  into v_customer_count,v_order_count,v_total_paid
  from pg_temp.ci_customer_base;

  select md5(
    concat_ws('|',
      v_config.version,
      v_config.order_weight::text,
      v_config.paid_weight::text,
      v_config.normal_min_score::text,
      v_config.premium_min_score::text,
      v_config.urgent_min_score::text,
      v_config.minimum_population_clients::text,
      v_config.minimum_population_orders::text,
      v_config.medium_support_orders::text,
      v_config.high_support_orders::text
    )||'|'||
    coalesce(string_agg(
      md5(concat_ws('|',
        customer_id::text,
        valid_order_count::text,
        paid_amount::text,
        first_order_at::text,
        last_order_at::text
      )),
      '' order by customer_id
    ),'EMPTY')
  )
  into v_fingerprint
  from pg_temp.ci_customer_base;

  select s.last_run_id
  into v_last_run
  from erp_supply.customer_intelligence_state s
  join erp_supply.customer_intelligence_runs r on r.id=s.last_run_id
  where s.organization_id=v_org
    and r.status='COMPLETED'
    and r.algorithm_version=v_config.version
    and r.dataset_fingerprint=v_fingerprint;

  if v_last_run is not null then
    update erp_supply.customer_intelligence_state
    set dirty_since=null,dirty_reason=null,updated_at=now()
    where organization_id=v_org;

    return jsonb_build_object(
      'success',true,'reused',true,'runId',v_last_run,
      'algorithmVersion',v_config.version,'customerCount',v_customer_count,
      'validOrderCount',v_order_count,'totalPaid',v_total_paid
    );
  end if;

  insert into erp_supply.customer_intelligence_runs(
    organization_id,algorithm_version,dataset_fingerprint,actor_profile_id,status,
    customer_count,valid_order_count,total_paid
  )
  values(
    v_org,v_config.version,v_fingerprint,v_actor,'RUNNING',
    v_customer_count,v_order_count,v_total_paid
  )
  returning id into v_run_id;

  drop table if exists pg_temp.ci_scored;
  create temporary table ci_scored on commit drop as
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
  ranked as (
    select
      s.*,
      dense_rank() over(
        order by s.score desc,s.paid_amount desc,s.valid_order_count desc
      )::integer overall_rank,
      case when count(*) over()=1 then 50::numeric
        else round(100*percent_rank() over(order by s.score),2) end percentile,
      round(100*s.frequency_norm,2)::numeric frequency_percentile,
      round(100*s.paid_norm,2)::numeric paid_percentile,
      round(100*s.valid_order_count::numeric/nullif(s.sample_orders,0),3)::numeric order_share_pct,
      case when s.total_paid>0
        then round(100*s.paid_amount/s.total_paid,3)::numeric
        else 0::numeric end paid_share_pct,
      round(100*sum(s.valid_order_count) over(
        order by s.valid_order_count desc,s.paid_amount desc,s.customer_id
        rows between unbounded preceding and current row
      )::numeric/nullif(s.sample_orders,0),3)::numeric cumulative_orders_pct,
      case when s.total_paid>0 then round(100*sum(s.paid_amount) over(
        order by s.paid_amount desc,s.valid_order_count desc,s.customer_id
        rows between unbounded preceding and current row
      )/s.total_paid,3)::numeric else 0::numeric end cumulative_paid_pct
    from scored0 s
  )
  select
    r.*,
    case
      when r.score>=v_config.urgent_min_score then 'URGENT'
      when r.score>=v_config.premium_min_score then 'PREMIUM'
      when r.score>=v_config.normal_min_score then 'NORMAL'
      else 'BASIC'
    end segment,
    case
      when r.valid_order_count>=v_config.high_support_orders then 'HIGH'
      when r.valid_order_count>=v_config.medium_support_orders then 'MEDIUM'
      else 'LOW'
    end support_level,
    (
      r.sample_clients<v_config.minimum_population_clients
      or r.sample_orders<v_config.minimum_population_orders
      or r.valid_order_count<v_config.medium_support_orders
    ) provisional
  from ranked r;

  insert into erp_supply.customer_intelligence_history(
    organization_id,customer_id,run_id,algorithm_version,segment,previous_segment,
    score,valid_order_count,paid_amount
  )
  select
    v_org,s.customer_id,v_run_id,v_config.version,s.segment,prev.segment,
    s.score,s.valid_order_count,s.paid_amount
  from pg_temp.ci_scored s
  left join erp_supply.customer_intelligence_current prev
    on prev.organization_id=v_org and prev.customer_id=s.customer_id
  where prev.customer_id is null or prev.segment is distinct from s.segment;

  insert into erp_supply.customer_intelligence_current(
    organization_id,customer_id,run_id,algorithm_version,valid_order_count,paid_amount,
    order_rank,paid_rank,overall_rank,frequency_percentile,paid_percentile,percentile,
    score,segment,support_level,provisional,order_share_pct,paid_share_pct,
    cumulative_orders_pct,cumulative_paid_pct,first_order_at,last_order_at,
    sample_clients,sample_orders,calculated_at
  )
  select
    v_org,s.customer_id,v_run_id,v_config.version,s.valid_order_count,s.paid_amount,
    s.order_rank,s.paid_rank,s.overall_rank,s.frequency_percentile,s.paid_percentile,
    s.percentile,s.score,s.segment,s.support_level,s.provisional,s.order_share_pct,
    s.paid_share_pct,s.cumulative_orders_pct,s.cumulative_paid_pct,s.first_order_at,
    s.last_order_at,s.sample_clients,s.sample_orders,now()
  from pg_temp.ci_scored s
  on conflict (organization_id,customer_id) do update set
    run_id=excluded.run_id,algorithm_version=excluded.algorithm_version,
    valid_order_count=excluded.valid_order_count,paid_amount=excluded.paid_amount,
    order_rank=excluded.order_rank,paid_rank=excluded.paid_rank,
    overall_rank=excluded.overall_rank,frequency_percentile=excluded.frequency_percentile,
    paid_percentile=excluded.paid_percentile,percentile=excluded.percentile,
    score=excluded.score,segment=excluded.segment,support_level=excluded.support_level,
    provisional=excluded.provisional,order_share_pct=excluded.order_share_pct,
    paid_share_pct=excluded.paid_share_pct,cumulative_orders_pct=excluded.cumulative_orders_pct,
    cumulative_paid_pct=excluded.cumulative_paid_pct,first_order_at=excluded.first_order_at,
    last_order_at=excluded.last_order_at,sample_clients=excluded.sample_clients,
    sample_orders=excluded.sample_orders,calculated_at=excluded.calculated_at;

  delete from erp_supply.customer_intelligence_current c
  where c.organization_id=v_org
    and not exists(select 1 from pg_temp.ci_scored s where s.customer_id=c.customer_id);

  update erp_supply.customer_intelligence_runs
  set status='COMPLETED',completed_at=now()
  where id=v_run_id;

  insert into erp_supply.customer_intelligence_state(
    organization_id,dirty_since,dirty_reason,last_run_id,updated_at
  )
  values(v_org,null,null,v_run_id,now())
  on conflict (organization_id) do update set
    dirty_since=case
      when customer_intelligence_state.dirty_since>v_started_at
      then customer_intelligence_state.dirty_since else null end,
    dirty_reason=case
      when customer_intelligence_state.dirty_since>v_started_at
      then customer_intelligence_state.dirty_reason else null end,
    last_run_id=excluded.last_run_id,updated_at=now();

  return jsonb_build_object(
    'success',true,'reused',false,'runId',v_run_id,
    'algorithmVersion',v_config.version,'customerCount',v_customer_count,
    'validOrderCount',v_order_count,'totalPaid',v_total_paid
  );
end;
$$;

revoke all on function erp_private.recalculate_customer_intelligence()
from public,anon;
grant execute on function erp_private.recalculate_customer_intelligence()
to authenticated;

comment on function erp_private.recalculate_customer_intelligence()
is 'Full deterministic recalculation using valid non-draft/non-cancelled orders plus registered invoice value net of reversals. Serializes only per organization.';

commit;
