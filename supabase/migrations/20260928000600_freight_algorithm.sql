begin;

create or replace function erp_private.freight_normalize(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(upper(coalesce(p_value,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),
      '[^A-Z0-9 ]+',' ','g'
    ),
    '\s+',' ','g'
  ))
$$;

create or replace function erp_private.freight_city_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, erp_private
as $$
  with n as (select erp_private.freight_normalize(p_value) v)
  select case
    when v in ('BOGOTA D C','BOGOTA DC','BOGOTA DISTRITO CAPITAL','SANTA FE DE BOGOTA','SANTAFE DE BOGOTA') then 'BOGOTA'
    when v in ('GUADALAJARA DE BUGA','BUGA') then 'BUGA'
    when v in ('SANTA CRUZ DE LORICA','LORICA') then 'LORICA'
    when v='SANTIAGO DE CALI' then 'CALI'
    when v='SAN JOSE DE CUCUTA' then 'CUCUTA'
    when v like 'SAN VICENTE DEL CHUCU%' or v like 'SAN VICENTE DE CHUCURI%' then 'SAN VICENTE DE CHUCURI'
    else v
  end
  from n
$$;

create or replace function erp_private.freight_department_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, erp_private
as $$
  with n as (select erp_private.freight_normalize(p_value) v)
  select case
    when v in ('VALLE','VALLE DEL CAUCA') then 'VALLE DEL CAUCA'
    when v in ('BOGOTA D C','BOGOTA DC','D C','DISTRITO CAPITAL','BOGOTA DISTRITO CAPITAL') then 'BOGOTA DC'
    when v in ('GUAJIRA','LA GUAJIRA') then 'GUAJIRA'
    else v
  end
  from n
$$;

create or replace function erp_private.freight_scope_stats(
  p_org uuid,
  p_route text,
  p_scope text,
  p_city_key text,
  p_department_key text,
  p_carrier_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_legacy_samples integer:=0;
  v_new_samples integer:=0;
  v_outliers integer:=0;
  v_legacy_low numeric;
  v_legacy_mid numeric;
  v_legacy_high numeric;
  v_new_low numeric;
  v_new_mid numeric;
  v_new_high numeric;
  v_new_p90 numeric;
  v_weight_p20 numeric;
  v_weight_p50 numeric;
  v_weight_p80 numeric;
  v_source_from date;
  v_source_to date;
  v_mid numeric;
  v_low numeric;
  v_high numeric;
  v_p90 numeric;
begin
  with legacy as (
    select s.*
    from erp_supply.freight_legacy_route_stats s
    join erp_supply.freight_destinations d on d.id=s.destination_id
    where s.organization_id=p_org
      and s.route_code=p_route
      and (p_carrier_id is null or s.carrier_id=p_carrier_id)
      and (
        (p_scope='CITY' and d.city_key=p_city_key)
        or (p_scope='DEPARTMENT' and d.department_key=p_department_key)
        or p_scope='NATIONAL'
      )
  )
  select
    coalesce(sum(sample_count),0)::int,
    sum(cost_p20*sample_count)/nullif(sum(sample_count),0),
    sum(cost_p50*sample_count)/nullif(sum(sample_count),0),
    sum(cost_p80*sample_count)/nullif(sum(sample_count),0),
    sum(weight_p20*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(weight_p50*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(weight_p80*weight_sample_count)/nullif(sum(weight_sample_count),0),
    min(source_start),
    max(source_end)
  into
    v_legacy_samples,v_legacy_low,v_legacy_mid,v_legacy_high,
    v_weight_p20,v_weight_p50,v_weight_p80,v_source_from,v_source_to
  from legacy;

  with raw as (
    select o.actual_cost,o.observed_at
    from erp_supply.freight_observations o
    where o.organization_id=p_org
      and o.route_code=p_route
      and o.actual_cost>=0
      and o.observed_at >= now()-interval '540 days'
      and (p_carrier_id is null or o.carrier_id=p_carrier_id)
      and (
        (p_scope='CITY' and o.destination_city_key=p_city_key)
        or (p_scope='DEPARTMENT' and o.destination_department_key=p_department_key)
        or p_scope='NATIONAL'
      )
  ),
  quartiles as (
    select
      percentile_cont(0.25) within group(order by actual_cost) q1,
      percentile_cont(0.75) within group(order by actual_cost) q3
    from raw
  ),
  cleaned as (
    select r.*
    from raw r cross join quartiles q
    where q.q1 is null
       or q.q3 is null
       or r.actual_cost between q.q1-1.5*(q.q3-q.q1) and q.q3+1.5*(q.q3-q.q1)
  )
  select
    (select count(*) from cleaned)::int,
    (select count(*) from raw)-(select count(*) from cleaned),
    percentile_cont(0.25) within group(order by actual_cost),
    percentile_cont(0.50) within group(order by actual_cost),
    percentile_cont(0.75) within group(order by actual_cost),
    percentile_cont(0.90) within group(order by actual_cost),
    least(v_source_from,min(observed_at)::date),
    greatest(v_source_to,max(observed_at)::date)
  into
    v_new_samples,v_outliers,v_new_low,v_new_mid,v_new_high,v_new_p90,
    v_source_from,v_source_to
  from cleaned;

  v_low:=case
    when v_legacy_samples+v_new_samples=0 then null
    else (
      coalesce(v_legacy_low,0)*v_legacy_samples
      +coalesce(v_new_low,0)*v_new_samples
    )/nullif(
      (case when v_legacy_low is null then 0 else v_legacy_samples end)
      +(case when v_new_low is null then 0 else v_new_samples end),0
    )
  end;

  v_mid:=case
    when v_legacy_samples+v_new_samples=0 then null
    else (
      coalesce(v_legacy_mid,0)*v_legacy_samples
      +coalesce(v_new_mid,0)*v_new_samples
    )/nullif(
      (case when v_legacy_mid is null then 0 else v_legacy_samples end)
      +(case when v_new_mid is null then 0 else v_new_samples end),0
    )
  end;

  v_high:=case
    when v_legacy_samples+v_new_samples=0 then null
    else (
      coalesce(v_legacy_high,0)*v_legacy_samples
      +coalesce(v_new_high,0)*v_new_samples
    )/nullif(
      (case when v_legacy_high is null then 0 else v_legacy_samples end)
      +(case when v_new_high is null then 0 else v_new_samples end),0
    )
  end;

  v_p90:=coalesce(v_new_p90,v_high);

  return jsonb_build_object(
    'scope',p_scope,
    'sampleCount',v_legacy_samples+v_new_samples,
    'legacySamples',v_legacy_samples,
    'newSamples',v_new_samples,
    'outliersExcluded',v_outliers,
    'estimateLow',round(v_low,0),
    'estimateMid',round(v_mid,0),
    'estimateHigh',round(v_high,0),
    'p90',case when v_p90 is null then null else round(v_p90,0) end,
    'weightP20',v_weight_p20,
    'weightP50',v_weight_p50,
    'weightP80',v_weight_p80,
    'sourceFrom',v_source_from,
    'sourceTo',v_source_to
  );
end;
$$;

create or replace function erp_private.freight_evidence_level(
  p_scope text,
  p_samples integer,
  p_mid numeric,
  p_low numeric,
  p_high numeric,
  p_source_to date,
  p_carrier_fallback boolean
)
returns text
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  v_spread numeric:=case when coalesce(p_mid,0)>0 then (p_high-p_low)/p_mid else 99 end;
  v_age integer:=case when p_source_to is null then 9999 else current_date-p_source_to end;
  v_level text;
begin
  v_level:=case
    when p_scope='CITY' and p_samples>=15 and v_spread<=1.50 and v_age<=365 then 'HIGH'
    when (p_scope='CITY' and p_samples>=5)
      or (p_scope='DEPARTMENT' and p_samples>=12) then 'MEDIUM'
    when p_samples>0 then 'LOW'
    else 'NONE'
  end;

  if p_carrier_fallback and v_level='HIGH' then return 'MEDIUM'; end if;
  if p_carrier_fallback and v_level='MEDIUM' then return 'LOW'; end if;
  if v_age>540 and v_level='HIGH' then return 'MEDIUM'; end if;
  if v_age>540 and v_level='MEDIUM' then return 'LOW'; end if;
  return v_level;
end;
$$;

revoke all on function erp_private.freight_normalize(text) from public,anon;
revoke all on function erp_private.freight_city_key(text) from public,anon;
revoke all on function erp_private.freight_department_key(text) from public,anon;
revoke all on function erp_private.freight_scope_stats(uuid,text,text,text,text,uuid) from public,anon;
revoke all on function erp_private.freight_evidence_level(text,integer,numeric,numeric,numeric,date,boolean) from public,anon;

grant execute on function erp_private.freight_normalize(text) to authenticated;
grant execute on function erp_private.freight_city_key(text) to authenticated;
grant execute on function erp_private.freight_department_key(text) to authenticated;
grant execute on function erp_private.freight_scope_stats(uuid,text,text,text,text,uuid) to authenticated;
grant execute on function erp_private.freight_evidence_level(text,integer,numeric,numeric,numeric,date,boolean) to authenticated;

commit;
