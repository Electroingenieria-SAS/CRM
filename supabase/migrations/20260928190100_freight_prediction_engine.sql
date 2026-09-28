begin;

create or replace function erp_private.freight_evidence_for_scope(
  p_carrier_id uuid,
  p_destination_id uuid,
  p_route_code text,
  p_scope text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_org uuid := erp_private.current_org_id();
  v_destination erp_supply.freight_destinations%rowtype;
  v_scope text := upper(trim(coalesce(p_scope,'')));
  v_base_samples integer := 0;
  v_base_low numeric;
  v_base_mid numeric;
  v_base_high numeric;
  v_weight_low numeric;
  v_weight_mid numeric;
  v_weight_high numeric;
  v_source_from date;
  v_source_to date;
  v_actual_raw integer := 0;
  v_actual_samples integer := 0;
  v_actual_low numeric;
  v_actual_mid numeric;
  v_actual_high numeric;
  v_actual_mean numeric;
  v_actual_p90 numeric;
  v_actual_newest timestamptz;
  v_actual_oldest timestamptz;
  v_outliers integer := 0;
  v_weight_count integer := 0;
  v_weight_corr numeric;
  v_weight_slope numeric;
  v_weight_intercept numeric;
  v_package_count integer := 0;
  v_package_corr numeric;
  v_package_slope numeric;
  v_package_intercept numeric;
  v_volume_count integer := 0;
  v_volume_corr numeric;
  v_volume_slope numeric;
  v_volume_intercept numeric;
begin
  if v_org is null then
    raise exception 'Usuario sin organización operativa' using errcode='42501';
  end if;

  if not (
    erp_private.can_access_module('freight','read')
    or erp_private.can_access_module('freight','create')
  ) then
    raise exception 'No autorizado para consultar evidencia de fletes' using errcode='42501';
  end if;

  if v_scope not in ('CITY','DEPARTMENT','NATIONAL') then
    raise exception 'Nivel de evidencia inválido';
  end if;

  select *
  into v_destination
  from erp_supply.freight_destinations
  where id=p_destination_id and active;

  if not found then
    raise exception 'Destino inválido' using errcode='P0002';
  end if;

  with baseline as (
    select h.*
    from erp_supply.freight_historical_aggregates h
    join erp_supply.freight_destinations d on d.id=h.destination_id
    where h.organization_id=v_org
      and h.route_code=p_route_code
      and h.carrier_id=p_carrier_id
      and (
        (v_scope='CITY' and h.destination_id=p_destination_id)
        or (
          v_scope='DEPARTMENT'
          and d.country_code=v_destination.country_code
          and d.department_key=v_destination.department_key
        )
        or v_scope='NATIONAL'
      )
  )
  select
    coalesce(sum(sample_count),0)::integer,
    sum(cost_p20*sample_count)/nullif(sum(sample_count),0),
    sum(cost_p50*sample_count)/nullif(sum(sample_count),0),
    sum(cost_p80*sample_count)/nullif(sum(sample_count),0),
    sum(weight_p20*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(weight_p50*weight_sample_count)/nullif(sum(weight_sample_count),0),
    sum(weight_p80*weight_sample_count)/nullif(sum(weight_sample_count),0),
    min(source_start),
    max(source_end)
  into
    v_base_samples,v_base_low,v_base_mid,v_base_high,
    v_weight_low,v_weight_mid,v_weight_high,
    v_source_from,v_source_to
  from baseline;

  with raw_actual as (
    select o.*
    from erp_supply.freight_observations o
    join erp_supply.freight_destinations d on d.id=o.destination_id
    where o.organization_id=v_org
      and o.route_code=p_route_code
      and o.carrier_id=p_carrier_id
      and o.observed_at >= now()-interval '730 days'
      and (
        (v_scope='CITY' and o.destination_id=p_destination_id)
        or (
          v_scope='DEPARTMENT'
          and d.country_code=v_destination.country_code
          and d.department_key=v_destination.department_key
        )
        or v_scope='NATIONAL'
      )
  ),
  quartiles as (
    select
      count(*)::integer raw_count,
      percentile_cont(0.25) within group(order by actual_cost) q1,
      percentile_cont(0.75) within group(order by actual_cost) q3
    from raw_actual
  ),
  clean as (
    select a.*
    from raw_actual a
    cross join quartiles q
    where q.raw_count < 4
       or q.q1 is null
       or q.q3 is null
       or a.actual_cost between
          (q.q1 - 1.5*(q.q3-q.q1))
          and
          (q.q3 + 1.5*(q.q3-q.q1))
  ),
  stats as (
    select
      (select raw_count from quartiles) raw_count,
      count(*)::integer clean_count,
      percentile_cont(0.25) within group(order by actual_cost) actual_low,
      percentile_cont(0.50) within group(order by actual_cost) actual_mid,
      percentile_cont(0.75) within group(order by actual_cost) actual_high,
      avg(actual_cost)::numeric actual_mean,
      percentile_cont(0.90) within group(order by actual_cost) actual_p90,
      max(observed_at) newest,
      min(observed_at) oldest,
      count(weight_kg) filter(where weight_kg>0)::integer weight_count,
      corr(actual_cost::double precision,weight_kg::double precision)
        filter(where weight_kg>0) weight_corr,
      regr_slope(actual_cost::double precision,weight_kg::double precision)
        filter(where weight_kg>0) weight_slope,
      regr_intercept(actual_cost::double precision,weight_kg::double precision)
        filter(where weight_kg>0) weight_intercept,
      count(package_count) filter(where package_count>0)::integer package_count_n,
      corr(actual_cost::double precision,package_count::double precision)
        filter(where package_count>0) package_corr,
      regr_slope(actual_cost::double precision,package_count::double precision)
        filter(where package_count>0) package_slope,
      regr_intercept(actual_cost::double precision,package_count::double precision)
        filter(where package_count>0) package_intercept,
      count(volume_m3) filter(where volume_m3>0)::integer volume_count,
      corr(actual_cost::double precision,volume_m3::double precision)
        filter(where volume_m3>0) volume_corr,
      regr_slope(actual_cost::double precision,volume_m3::double precision)
        filter(where volume_m3>0) volume_slope,
      regr_intercept(actual_cost::double precision,volume_m3::double precision)
        filter(where volume_m3>0) volume_intercept
    from clean
  )
  select
    raw_count,clean_count,actual_low,actual_mid,actual_high,actual_mean,actual_p90,newest,oldest,
    greatest(raw_count-clean_count,0),
    weight_count,weight_corr,weight_slope,weight_intercept,
    package_count_n,package_corr,package_slope,package_intercept,
    volume_count,volume_corr,volume_slope,volume_intercept
  into
    v_actual_raw,v_actual_samples,v_actual_low,v_actual_mid,v_actual_high,
    v_actual_mean,v_actual_p90,v_actual_newest,v_actual_oldest,v_outliers,
    v_weight_count,v_weight_corr,v_weight_slope,v_weight_intercept,
    v_package_count,v_package_corr,v_package_slope,v_package_intercept,
    v_volume_count,v_volume_corr,v_volume_slope,v_volume_intercept
  from stats;

  return jsonb_build_object(
    'scope',v_scope,
    'baselineSamples',v_base_samples,
    'baselineLow',v_base_low,
    'baselineMid',v_base_mid,
    'baselineHigh',v_base_high,
    'referenceWeightLow',v_weight_low,
    'referenceWeightMid',v_weight_mid,
    'referenceWeightHigh',v_weight_high,
    'sourceFrom',v_source_from,
    'sourceTo',v_source_to,
    'actualRawSamples',coalesce(v_actual_raw,0),
    'actualSamples',coalesce(v_actual_samples,0),
    'actualLow',v_actual_low,
    'actualMid',v_actual_mid,
    'actualHigh',v_actual_high,
    'actualMean',v_actual_mean,
    'actualP90',v_actual_p90,
    'actualNewest',v_actual_newest,
    'actualOldest',v_actual_oldest,
    'outlierCount',coalesce(v_outliers,0),
    'weightCount',coalesce(v_weight_count,0),
    'weightCorrelation',v_weight_corr,
    'weightSlope',v_weight_slope,
    'weightIntercept',v_weight_intercept,
    'packageCount',coalesce(v_package_count,0),
    'packageCorrelation',v_package_corr,
    'packageSlope',v_package_slope,
    'packageIntercept',v_package_intercept,
    'volumeCount',coalesce(v_volume_count,0),
    'volumeCorrelation',v_volume_corr,
    'volumeSlope',v_volume_slope,
    'volumeIntercept',v_volume_intercept
  );
end;
$$;

revoke all on function erp_private.freight_evidence_for_scope(uuid,uuid,text,text)
from public,anon;
grant execute on function erp_private.freight_evidence_for_scope(uuid,uuid,text,text)
to authenticated;

create or replace function erp_private.freight_predict_one(
  p_carrier_id uuid,
  p_destination_id uuid,
  p_route_code text,
  p_weight_kg numeric default null,
  p_package_count numeric default null,
  p_volume_m3 numeric default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_carrier erp_supply.freight_carriers%rowtype;
  v_destination erp_supply.freight_destinations%rowtype;
  v_evidence jsonb;
  v_scope text;
  v_samples integer;
  v_base_samples integer;
  v_actual_samples integer;
  v_outliers integer;
  v_base_low numeric;
  v_base_mid numeric;
  v_base_high numeric;
  v_actual_low numeric;
  v_actual_mid numeric;
  v_actual_high numeric;
  v_base_factor numeric := 0;
  v_actual_factor numeric := 0;
  v_base_weight numeric := 0;
  v_actual_weight numeric := 0;
  v_low numeric;
  v_mid numeric;
  v_high numeric;
  v_regression_mid numeric;
  v_basis text := 'ROBUST_HISTORY';
  v_best_corr numeric := 0;
  v_corr numeric;
  v_count integer;
  v_slope numeric;
  v_intercept numeric;
  v_source_from date;
  v_source_to date;
  v_actual_newest timestamptz;
  v_spread numeric;
  v_freshness numeric;
  v_evidence_level text;
  v_weight_position text := 'NOT_PROVIDED';
begin
  if coalesce(p_weight_kg,0)<0
     or coalesce(p_package_count,0)<0
     or coalesce(p_volume_m3,0)<0 then
    raise exception 'Peso, bultos y volumen no pueden ser negativos';
  end if;

  select * into v_carrier
  from erp_supply.freight_carriers
  where id=p_carrier_id
    and organization_id=erp_private.current_org_id()
    and active;

  if not found then
    raise exception 'Transportadora inválida' using errcode='P0002';
  end if;

  select * into v_destination
  from erp_supply.freight_destinations
  where id=p_destination_id and active;

  if not found then
    raise exception 'Destino inválido' using errcode='P0002';
  end if;

  if p_route_code in ('CLIENT_POINT','CLIENT_PICKUP') then
    return jsonb_build_object(
      'available',false,
      'status','NOT_APPLICABLE',
      'carrierId',v_carrier.id,
      'carrierCode',v_carrier.code,
      'carrierName',v_carrier.name,
      'destinationId',v_destination.id,
      'city',v_destination.city_name,
      'department',v_destination.department_name,
      'fallbackLevel','NOT_APPLICABLE',
      'evidenceLevel','NOT_APPLICABLE',
      'sampleCount',0,
      'outlierCount',0,
      'basis','NO_FREIGHT_ROUTE',
      'explanationCode','ROUTE_HAS_NO_FREIGHT',
      'algorithmVersion','FREIGHT_ROBUST_V1'
    );
  end if;

  foreach v_scope in array array['CITY','DEPARTMENT','NATIONAL'] loop
    v_evidence := erp_private.freight_evidence_for_scope(
      p_carrier_id,p_destination_id,p_route_code,v_scope
    );
    v_samples :=
      coalesce((v_evidence->>'baselineSamples')::integer,0)
      + coalesce((v_evidence->>'actualSamples')::integer,0);

    if (v_scope='CITY' and v_samples>=3)
       or (v_scope='DEPARTMENT' and v_samples>=5)
       or (v_scope='NATIONAL' and v_samples>=10) then
      exit;
    end if;
  end loop;

  if v_evidence is null then
    v_evidence := '{}'::jsonb;
  end if;

  v_samples :=
    coalesce((v_evidence->>'baselineSamples')::integer,0)
    + coalesce((v_evidence->>'actualSamples')::integer,0);

  if v_samples < (case v_scope when 'CITY' then 3 when 'DEPARTMENT' then 5 else 10 end) then
    return jsonb_build_object(
      'available',false,
      'status','INSUFFICIENT',
      'carrierId',v_carrier.id,
      'carrierCode',v_carrier.code,
      'carrierName',v_carrier.name,
      'destinationId',v_destination.id,
      'city',v_destination.city_name,
      'department',v_destination.department_name,
      'fallbackLevel','NONE',
      'evidenceLevel','NONE',
      'sampleCount',v_samples,
      'outlierCount',coalesce((v_evidence->>'outlierCount')::integer,0),
      'basis','NO_RESPONSIBLE_ESTIMATE',
      'explanationCode','NO_COMPATIBLE_HISTORY',
      'algorithmVersion','FREIGHT_ROBUST_V1'
    );
  end if;

  v_base_samples := coalesce((v_evidence->>'baselineSamples')::integer,0);
  v_actual_samples := coalesce((v_evidence->>'actualSamples')::integer,0);
  v_outliers := coalesce((v_evidence->>'outlierCount')::integer,0);
  v_base_low := nullif(v_evidence->>'baselineLow','')::numeric;
  v_base_mid := nullif(v_evidence->>'baselineMid','')::numeric;
  v_base_high := nullif(v_evidence->>'baselineHigh','')::numeric;
  v_actual_low := nullif(v_evidence->>'actualLow','')::numeric;
  v_actual_mid := nullif(v_evidence->>'actualMid','')::numeric;
  v_actual_high := nullif(v_evidence->>'actualHigh','')::numeric;
  v_source_from := nullif(v_evidence->>'sourceFrom','')::date;
  v_source_to := nullif(v_evidence->>'sourceTo','')::date;
  v_actual_newest := nullif(v_evidence->>'actualNewest','')::timestamptz;

  if v_source_to is not null then
    v_base_factor := case
      when current_date-v_source_to<=180 then 1.00
      when current_date-v_source_to<=365 then 0.85
      when current_date-v_source_to<=730 then 0.65
      else 0.40
    end;
  end if;

  if v_actual_newest is not null then
    v_actual_factor := case
      when current_date-v_actual_newest::date<=180 then 1.00
      when current_date-v_actual_newest::date<=365 then 0.85
      when current_date-v_actual_newest::date<=730 then 0.65
      else 0.40
    end;
  end if;

  v_base_weight := least(v_base_samples,25)*v_base_factor;
  v_actual_weight := least(v_actual_samples,25)*v_actual_factor;

  if v_base_weight+v_actual_weight<=0 then
    return jsonb_build_object(
      'available',false,
      'status','INSUFFICIENT',
      'carrierId',v_carrier.id,
      'carrierCode',v_carrier.code,
      'carrierName',v_carrier.name,
      'destinationId',v_destination.id,
      'city',v_destination.city_name,
      'department',v_destination.department_name,
      'fallbackLevel','NONE',
      'evidenceLevel','NONE',
      'sampleCount',v_samples,
      'outlierCount',v_outliers,
      'basis','STALE_OR_EMPTY_HISTORY',
      'explanationCode','NO_WEIGHTED_EVIDENCE',
      'algorithmVersion','FREIGHT_ROBUST_V1'
    );
  end if;

  v_low := (
    coalesce(v_base_low,0)*v_base_weight
    + coalesce(v_actual_low,0)*v_actual_weight
  ) / nullif(
    (case when v_base_low is null then 0 else v_base_weight end)
    + (case when v_actual_low is null then 0 else v_actual_weight end),0
  );

  v_mid := (
    coalesce(v_base_mid,0)*v_base_weight
    + coalesce(v_actual_mid,0)*v_actual_weight
  ) / nullif(
    (case when v_base_mid is null then 0 else v_base_weight end)
    + (case when v_actual_mid is null then 0 else v_actual_weight end),0
  );

  v_high := (
    coalesce(v_base_high,0)*v_base_weight
    + coalesce(v_actual_high,0)*v_actual_weight
  ) / nullif(
    (case when v_base_high is null then 0 else v_base_weight end)
    + (case when v_actual_high is null then 0 else v_actual_weight end),0
  );

  if coalesce(p_weight_kg,0)>0 then
    v_count := coalesce((v_evidence->>'weightCount')::integer,0);
    v_corr := nullif(v_evidence->>'weightCorrelation','')::numeric;
    v_slope := nullif(v_evidence->>'weightSlope','')::numeric;
    v_intercept := nullif(v_evidence->>'weightIntercept','')::numeric;
    if v_count>=8 and abs(coalesce(v_corr,0))>=0.50 and v_slope is not null then
      v_best_corr := abs(v_corr);
      v_regression_mid := greatest(0,v_intercept+v_slope*p_weight_kg);
      v_basis := 'WEIGHT_REGRESSION';
    end if;

    if nullif(v_evidence->>'referenceWeightMid','')::numeric is not null then
      v_weight_position := case
        when p_weight_kg < coalesce(nullif(v_evidence->>'referenceWeightLow','')::numeric,p_weight_kg)
          then 'BELOW_REFERENCE'
        when p_weight_kg > coalesce(nullif(v_evidence->>'referenceWeightHigh','')::numeric,p_weight_kg)
          then 'ABOVE_REFERENCE'
        else 'WITHIN_REFERENCE'
      end;
    else
      v_weight_position := 'NO_REFERENCE';
    end if;
  end if;

  if coalesce(p_package_count,0)>0 then
    v_count := coalesce((v_evidence->>'packageCount')::integer,0);
    v_corr := nullif(v_evidence->>'packageCorrelation','')::numeric;
    v_slope := nullif(v_evidence->>'packageSlope','')::numeric;
    v_intercept := nullif(v_evidence->>'packageIntercept','')::numeric;
    if v_count>=8
       and abs(coalesce(v_corr,0))>=0.50
       and abs(coalesce(v_corr,0))>v_best_corr
       and v_slope is not null then
      v_best_corr := abs(v_corr);
      v_regression_mid := greatest(0,v_intercept+v_slope*p_package_count);
      v_basis := 'PACKAGE_REGRESSION';
    end if;
  end if;

  if coalesce(p_volume_m3,0)>0 then
    v_count := coalesce((v_evidence->>'volumeCount')::integer,0);
    v_corr := nullif(v_evidence->>'volumeCorrelation','')::numeric;
    v_slope := nullif(v_evidence->>'volumeSlope','')::numeric;
    v_intercept := nullif(v_evidence->>'volumeIntercept','')::numeric;
    if v_count>=8
       and abs(coalesce(v_corr,0))>=0.50
       and abs(coalesce(v_corr,0))>v_best_corr
       and v_slope is not null then
      v_best_corr := abs(v_corr);
      v_regression_mid := greatest(0,v_intercept+v_slope*p_volume_m3);
      v_basis := 'VOLUME_REGRESSION';
    end if;
  end if;

  if v_regression_mid is not null then
    v_mid := v_regression_mid;
  end if;

  v_low := least(coalesce(v_low,v_mid),v_mid);
  v_high := greatest(coalesce(v_high,v_mid),v_mid);
  v_spread := case when v_mid>0 then (v_high-v_low)/v_mid else null end;
  v_freshness := greatest(v_base_factor,v_actual_factor);

  v_evidence_level := case
    when v_scope='CITY'
      and v_samples>=10
      and coalesce(v_spread,99)<=0.80
      and v_freshness>=0.85 then 'HIGH'
    when (
      (v_scope='CITY' and v_samples>=5)
      or (v_scope='DEPARTMENT' and v_samples>=12)
      or (v_scope='NATIONAL' and v_samples>=50)
    )
      and coalesce(v_spread,99)<=1.50
      and v_freshness>=0.65 then 'MEDIUM'
    else 'LOW'
  end;

  return jsonb_build_object(
    'available',true,
    'status','AVAILABLE',
    'carrierId',v_carrier.id,
    'carrierCode',v_carrier.code,
    'carrierName',v_carrier.name,
    'destinationId',v_destination.id,
    'city',v_destination.city_name,
    'department',v_destination.department_name,
    'fallbackLevel',v_scope,
    'evidenceLevel',v_evidence_level,
    'sampleCount',v_samples,
    'baselineSamples',v_base_samples,
    'actualSamples',v_actual_samples,
    'outlierCount',v_outliers,
    'estimateLow',round(v_low,0),
    'estimateMid',round(v_mid,0),
    'estimateHigh',round(v_high,0),
    'basis',v_basis,
    'explanationCode',v_scope||'_'||v_basis,
    'sourceFrom',v_source_from,
    'sourceTo',greatest(v_source_to,coalesce(v_actual_newest::date,v_source_to)),
    'weightPosition',v_weight_position,
    'referenceWeight',jsonb_build_object(
      'p20',nullif(v_evidence->>'referenceWeightLow','')::numeric,
      'p50',nullif(v_evidence->>'referenceWeightMid','')::numeric,
      'p80',nullif(v_evidence->>'referenceWeightHigh','')::numeric
    ),
    'recency',jsonb_build_object(
      'baselineFactor',v_base_factor,
      'actualFactor',v_actual_factor
    ),
    'correlations',jsonb_build_object(
      'weight',nullif(v_evidence->>'weightCorrelation','')::numeric,
      'packages',nullif(v_evidence->>'packageCorrelation','')::numeric,
      'volume',nullif(v_evidence->>'volumeCorrelation','')::numeric
    ),
    'newObservationDistribution',jsonb_build_object(
      'mean',nullif(v_evidence->>'actualMean','')::numeric,
      'p25',nullif(v_evidence->>'actualLow','')::numeric,
      'p50',nullif(v_evidence->>'actualMid','')::numeric,
      'p75',nullif(v_evidence->>'actualHigh','')::numeric,
      'p90',nullif(v_evidence->>'actualP90','')::numeric,
      'iqr',case
        when nullif(v_evidence->>'actualLow','') is null
          or nullif(v_evidence->>'actualHigh','') is null then null
        else nullif(v_evidence->>'actualHigh','')::numeric
          - nullif(v_evidence->>'actualLow','')::numeric
      end
    ),
    'algorithmVersion','FREIGHT_ROBUST_V1'
  );
end;
$$;

revoke all on function erp_private.freight_predict_one(uuid,uuid,text,numeric,numeric,numeric)
from public,anon;
grant execute on function erp_private.freight_predict_one(uuid,uuid,text,numeric,numeric,numeric)
to authenticated;

commit;
