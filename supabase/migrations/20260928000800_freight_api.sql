begin;

create or replace function public.erp_x_freight_catalogs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
begin
  if not erp_private.can_access_module('freight','read') then
    raise exception 'No autorizado para consultar inteligencia de fletes' using errcode='42501';
  end if;

  return jsonb_build_object(
    'carriers',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',id,'code',code,'name',name
      ) order by name),'[]'::jsonb)
      from erp_supply.freight_carriers
      where organization_id=v_org and active
    ),
    'destinations',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',id,
        'city',city_name,
        'cityKey',city_key,
        'department',department_name,
        'departmentKey',department_key,
        'countryCode',country_code
      ) order by department_name,city_name),'[]'::jsonb)
      from erp_supply.freight_destinations
      where organization_id=v_org and active
    ),
    'routes',jsonb_build_array('LOCAL_DISPATCH','NATIONAL_DISPATCH'),
    'model',(
      select jsonb_build_object(
        'code',model_code,
        'algorithmVersion',algorithm_version,
        'parameters',parameters,
        'sourceSummary',source_summary
      )
      from erp_supply.freight_model_versions
      where organization_id=v_org and model_code='ROBUST_HISTORICAL_FALLBACK' and active
      order by created_at desc
      limit 1
    )
  );
end;
$$;

create or replace function public.erp_x_freight_predict(
  p_route text,
  p_department text,
  p_city text,
  p_carrier_code text default null,
  p_weight_kg numeric default null,
  p_package_count numeric default null,
  p_volume_m3 numeric default null,
  p_order_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_route text:=upper(trim(coalesce(p_route,'')));
  v_city_key text:=erp_private.freight_city_key(p_city);
  v_department_key text:=erp_private.freight_department_key(p_department);
  v_carrier_code text:=nullif(erp_private.freight_normalize(p_carrier_code),'');
  v_carrier_id uuid;
  v_destination_id uuid;
  v_stats jsonb;
  v_scope text;
  v_carrier_fallback boolean:=false;
  v_samples integer:=0;
  v_low numeric;
  v_mid numeric;
  v_high numeric;
  v_source_to date;
  v_evidence text;
  v_prediction_id uuid;
  v_existing erp_supply.freight_predictions%rowtype;
  v_weight_context text:='NOT_USED';
begin
  if v_actor is null or v_org is null then
    raise exception 'Usuario sin perfil operativo activo' using errcode='42501';
  end if;

  if not erp_private.can_access_module('freight','create') then
    raise exception 'No autorizado para generar predicciones de flete' using errcode='42501';
  end if;

  if v_route in ('CLIENT_POINT','CLIENT_PICKUP') then
    return jsonb_build_object(
      'available',false,
      'reason','NO_FREIGHT_EXPECTED',
      'route',v_route,
      'algorithmVersion','1.0.0'
    );
  end if;

  if v_route not in ('LOCAL_DISPATCH','NATIONAL_DISPATCH') then
    raise exception 'Modalidad de entrega inválida' using errcode='22023';
  end if;

  if v_city_key='' then
    raise exception 'La ciudad destino es obligatoria' using errcode='22023';
  end if;

  if coalesce(p_weight_kg,0)<0 or coalesce(p_package_count,0)<0 or coalesce(p_volume_m3,0)<0 then
    raise exception 'Peso, bultos y volumen no pueden ser negativos' using errcode='22023';
  end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select * into v_existing
    from erp_supply.freight_predictions
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
    limit 1;

    if found then
      return jsonb_build_object(
        'available',v_existing.estimate_mid is not null,
        'idempotent',true,
        'predictionId',v_existing.id,
        'estimateMid',v_existing.estimate_mid,
        'estimateLow',v_existing.estimate_low,
        'estimateHigh',v_existing.estimate_high,
        'sampleCount',v_existing.sample_count,
        'evidenceLevel',v_existing.evidence_level,
        'fallbackScope',v_existing.fallback_scope,
        'algorithmVersion',v_existing.algorithm_version,
        'explanation',v_existing.explanation,
        'createdAt',v_existing.created_at
      );
    end if;
  end if;

  if v_carrier_code is not null then
    select id into v_carrier_id
    from erp_supply.freight_carriers
    where organization_id=v_org and code=v_carrier_code and active
    limit 1;
  end if;

  select id into v_destination_id
  from erp_supply.freight_destinations
  where organization_id=v_org
    and city_key=v_city_key
    and (v_department_key='' or department_key=v_department_key)
  order by (department_key=v_department_key) desc
  limit 1;

  v_stats:=erp_private.freight_scope_stats(
    v_org,v_route,'CITY',v_city_key,v_department_key,v_carrier_id
  );
  if coalesce((v_stats->>'sampleCount')::int,0)>=3 then
    v_scope:='CITY';
  else
    v_stats:=erp_private.freight_scope_stats(
      v_org,v_route,'DEPARTMENT',v_city_key,v_department_key,v_carrier_id
    );
    if v_department_key<>'' and coalesce((v_stats->>'sampleCount')::int,0)>=5 then
      v_scope:='DEPARTMENT';
    else
      v_stats:=erp_private.freight_scope_stats(
        v_org,v_route,'NATIONAL',v_city_key,v_department_key,v_carrier_id
      );
      if coalesce((v_stats->>'sampleCount')::int,0)>=10 then
        v_scope:='NATIONAL';
      end if;
    end if;
  end if;

  if v_scope is null and v_carrier_id is not null then
    v_carrier_fallback:=true;
    v_stats:=erp_private.freight_scope_stats(
      v_org,v_route,'CITY',v_city_key,v_department_key,null
    );
    if coalesce((v_stats->>'sampleCount')::int,0)>=3 then
      v_scope:='CITY';
    else
      v_stats:=erp_private.freight_scope_stats(
        v_org,v_route,'DEPARTMENT',v_city_key,v_department_key,null
      );
      if v_department_key<>'' and coalesce((v_stats->>'sampleCount')::int,0)>=5 then
        v_scope:='DEPARTMENT';
      else
        v_stats:=erp_private.freight_scope_stats(
          v_org,v_route,'NATIONAL',v_city_key,v_department_key,null
        );
        if coalesce((v_stats->>'sampleCount')::int,0)>=10 then
          v_scope:='NATIONAL';
        end if;
      end if;
    end if;
  end if;

  if v_scope is null then
    return jsonb_build_object(
      'available',false,
      'reason','INSUFFICIENT_EVIDENCE',
      'route',v_route,
      'city',p_city,
      'department',p_department,
      'carrierRequested',v_carrier_code,
      'algorithmVersion','1.0.0'
    );
  end if;

  v_samples:=(v_stats->>'sampleCount')::int;
  v_low:=nullif(v_stats->>'estimateLow','')::numeric;
  v_mid:=nullif(v_stats->>'estimateMid','')::numeric;
  v_high:=nullif(v_stats->>'estimateHigh','')::numeric;
  v_source_to:=nullif(v_stats->>'sourceTo','')::date;

  if p_weight_kg is not null
     and nullif(v_stats->>'weightP20','') is not null
     and nullif(v_stats->>'weightP80','') is not null then
    v_weight_context:=case
      when p_weight_kg < (v_stats->>'weightP20')::numeric then 'BELOW_HISTORICAL_BAND'
      when p_weight_kg > (v_stats->>'weightP80')::numeric then 'ABOVE_HISTORICAL_BAND'
      else 'WITHIN_HISTORICAL_BAND'
    end;
  end if;

  v_evidence:=erp_private.freight_evidence_level(
    v_scope,v_samples,v_mid,v_low,v_high,v_source_to,v_carrier_fallback
  );

  insert into erp_supply.freight_predictions(
    organization_id,order_id,carrier_id,destination_id,route_code,
    destination_city_key,destination_department_key,
    requested_weight_kg,requested_package_count,requested_volume_m3,
    estimate_low,estimate_mid,estimate_high,sample_count,evidence_level,
    fallback_scope,algorithm_version,explanation,idempotency_key,created_by
  )
  values(
    v_org,p_order_id,
    case when v_carrier_fallback then null else v_carrier_id end,
    v_destination_id,v_route,v_city_key,v_department_key,
    p_weight_kg,p_package_count,p_volume_m3,
    v_low,v_mid,v_high,v_samples,v_evidence,
    v_scope||case when v_carrier_fallback then '_ALL_CARRIERS' else '' end,
    '1.0.0',
    jsonb_build_object(
      'scope',v_scope,
      'carrierFallback',v_carrier_fallback,
      'legacySamples',coalesce((v_stats->>'legacySamples')::int,0),
      'newSamples',coalesce((v_stats->>'newSamples')::int,0),
      'outliersExcluded',coalesce((v_stats->>'outliersExcluded')::int,0),
      'sourceFrom',v_stats->>'sourceFrom',
      'sourceTo',v_stats->>'sourceTo',
      'rangeMethod',case
        when coalesce((v_stats->>'newSamples')::int,0)>0 then 'WEIGHTED_LEGACY_P20_P80_PLUS_NEW_P25_P75'
        else 'LEGACY_P20_P80'
      end,
      'weightContext',v_weight_context,
      'weightUsedToShiftEstimate',false,
      'reasonWeightNotShifted','RAW_PAIRED_WEIGHT_COST_HISTORY_NOT_YET_SUFFICIENT_IN_NEW_MODEL'
    ),
    nullif(trim(coalesce(p_idempotency_key,'')),''),
    v_actor
  )
  returning id into v_prediction_id;

  return jsonb_build_object(
    'available',true,
    'idempotent',false,
    'predictionId',v_prediction_id,
    'route',v_route,
    'destination',jsonb_build_object(
      'city',p_city,'cityKey',v_city_key,
      'department',p_department,'departmentKey',v_department_key
    ),
    'carrierRequested',v_carrier_code,
    'carrierUsed',case when v_carrier_fallback then null else v_carrier_code end,
    'estimateMid',round(v_mid,0),
    'estimateLow',round(v_low,0),
    'estimateHigh',round(v_high,0),
    'p90',nullif(v_stats->>'p90','')::numeric,
    'sampleCount',v_samples,
    'evidenceLevel',v_evidence,
    'fallbackScope',v_scope||case when v_carrier_fallback then '_ALL_CARRIERS' else '' end,
    'sourcePeriod',jsonb_build_object(
      'from',v_stats->>'sourceFrom','to',v_stats->>'sourceTo'
    ),
    'outliersExcluded',coalesce((v_stats->>'outliersExcluded')::int,0),
    'weightContext',v_weight_context,
    'algorithmVersion','1.0.0',
    'calculatedAt',now()
  );
end;
$$;

create or replace function public.erp_x_freight_history(
  p_department text default null,
  p_city text default null,
  p_carrier_code text default null,
  p_route text default null,
  p_from date default null,
  p_to date default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_city text:=erp_private.freight_city_key(p_city);
  v_department text:=erp_private.freight_department_key(p_department);
  v_carrier text:=nullif(erp_private.freight_normalize(p_carrier_code),'');
  v_route text:=nullif(upper(trim(coalesce(p_route,''))),'');
  v_total bigint;
  v_rows jsonb;
begin
  if not erp_private.can_access_module('freight','read') then
    raise exception 'No autorizado para consultar histórico de fletes' using errcode='42501';
  end if;

  with history as (
    select
      'LEGACY_SUMMARY'::text record_type,
      s.id,
      c.code carrier_code,
      c.name carrier_name,
      d.city_name city,
      d.department_name department,
      s.route_code,
      s.sample_count,
      s.cost_p20 estimate_low,
      s.cost_p50 estimate_mid,
      s.cost_p80 estimate_high,
      null::numeric actual_cost,
      s.weight_p50 weight_kg,
      s.source_start observed_from,
      s.source_end observed_to,
      s.source_label source
    from erp_supply.freight_legacy_route_stats s
    join erp_supply.freight_carriers c on c.id=s.carrier_id
    join erp_supply.freight_destinations d on d.id=s.destination_id
    where s.organization_id=v_org
    union all
    select
      'ACTUAL_OBSERVATION',
      o.id,
      c.code,
      c.name,
      o.destination_city_key,
      o.destination_department_key,
      o.route_code,
      1,
      null,null,null,
      o.actual_cost,
      o.weight_kg,
      o.observed_at::date,
      o.observed_at::date,
      o.source
    from erp_supply.freight_observations o
    left join erp_supply.freight_carriers c on c.id=o.carrier_id
    where o.organization_id=v_org
  ),
  filtered as (
    select *
    from history
    where (v_city='' or erp_private.freight_city_key(city)=v_city)
      and (v_department='' or erp_private.freight_department_key(department)=v_department)
      and (v_carrier is null or carrier_code=v_carrier)
      and (v_route is null or route_code=v_route)
      and (p_from is null or observed_to>=p_from)
      and (p_to is null or observed_from<=p_to)
  )
  select count(*) into v_total from filtered;

  with history as (
    select
      'LEGACY_SUMMARY'::text record_type,s.id,c.code carrier_code,c.name carrier_name,
      d.city_name city,d.department_name department,s.route_code,s.sample_count,
      s.cost_p20 estimate_low,s.cost_p50 estimate_mid,s.cost_p80 estimate_high,
      null::numeric actual_cost,s.weight_p50 weight_kg,s.source_start observed_from,
      s.source_end observed_to,s.source_label source
    from erp_supply.freight_legacy_route_stats s
    join erp_supply.freight_carriers c on c.id=s.carrier_id
    join erp_supply.freight_destinations d on d.id=s.destination_id
    where s.organization_id=v_org
    union all
    select
      'ACTUAL_OBSERVATION',o.id,c.code,c.name,o.destination_city_key,
      o.destination_department_key,o.route_code,1,null,null,null,o.actual_cost,
      o.weight_kg,o.observed_at::date,o.observed_at::date,o.source
    from erp_supply.freight_observations o
    left join erp_supply.freight_carriers c on c.id=o.carrier_id
    where o.organization_id=v_org
  ),
  filtered as (
    select *
    from history
    where (v_city='' or erp_private.freight_city_key(city)=v_city)
      and (v_department='' or erp_private.freight_department_key(department)=v_department)
      and (v_carrier is null or carrier_code=v_carrier)
      and (v_route is null or route_code=v_route)
      and (p_from is null or observed_to>=p_from)
      and (p_to is null or observed_from<=p_to)
    order by observed_to desc,city,carrier_name
    offset (v_page-1)*v_size
    limit v_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'recordType',record_type,'id',id,'carrierCode',carrier_code,'carrierName',carrier_name,
    'city',city,'department',department,'route',route_code,'sampleCount',sample_count,
    'estimateLow',estimate_low,'estimateMid',estimate_mid,'estimateHigh',estimate_high,
    'actualCost',actual_cost,'weightKg',weight_kg,'observedFrom',observed_from,
    'observedTo',observed_to,'source',source
  ) order by observed_to desc,city,carrier_name),'[]'::jsonb)
  into v_rows from filtered;

  return jsonb_build_object(
    'items',v_rows,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::int end
    )
  );
end;
$$;

create or replace function public.erp_x_freight_record_actual(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_route text:=upper(trim(coalesce(p_payload->>'route','')));
  v_city_key text:=erp_private.freight_city_key(p_payload->>'city');
  v_department_key text:=erp_private.freight_department_key(p_payload->>'department');
  v_carrier_code text:=nullif(erp_private.freight_normalize(p_payload->>'carrierCode'),'');
  v_carrier_id uuid;
  v_destination_id uuid;
  v_observation_id uuid;
  v_existing_id uuid;
  v_external_key text:=nullif(trim(coalesce(p_payload->>'externalKey','')),'');
  v_cost numeric:=nullif(p_payload->>'actualCost','')::numeric;
begin
  if not (
    erp_private.can_access_module('freight','update')
    or erp_private.can_access_module('freight','admin')
  ) then
    raise exception 'No autorizado para registrar costos reales de flete' using errcode='42501';
  end if;

  if v_route not in ('LOCAL_DISPATCH','NATIONAL_DISPATCH') then
    raise exception 'Modalidad de flete inválida' using errcode='22023';
  end if;
  if v_city_key='' then raise exception 'Ciudad requerida' using errcode='22023'; end if;
  if v_cost is null or v_cost<0 then raise exception 'Costo real inválido' using errcode='22023'; end if;

  if v_external_key is not null then
    select id into v_existing_id
    from erp_supply.freight_observations
    where organization_id=v_org
      and source=coalesce(nullif(p_payload->>'source',''),'LOGISTICS')
      and external_key=v_external_key;
    if found then
      return jsonb_build_object('success',true,'idempotent',true,'observationId',v_existing_id);
    end if;
  end if;

  if v_carrier_code is not null then
    select id into v_carrier_id from erp_supply.freight_carriers
    where organization_id=v_org and code=v_carrier_code and active limit 1;
  end if;

  select id into v_destination_id
  from erp_supply.freight_destinations
  where organization_id=v_org and city_key=v_city_key
    and (v_department_key='' or department_key=v_department_key)
  order by (department_key=v_department_key) desc limit 1;

  insert into erp_supply.freight_observations(
    organization_id,prediction_id,order_id,carrier_id,destination_id,route_code,
    destination_city_key,destination_department_key,actual_cost,weight_kg,
    package_count,volume_m3,observed_at,source,external_key,created_by
  )
  values(
    v_org,nullif(p_payload->>'predictionId','')::uuid,
    nullif(p_payload->>'orderId','')::uuid,
    v_carrier_id,v_destination_id,v_route,v_city_key,v_department_key,v_cost,
    nullif(p_payload->>'weightKg','')::numeric,
    nullif(p_payload->>'packageCount','')::numeric,
    nullif(p_payload->>'volumeM3','')::numeric,
    coalesce(nullif(p_payload->>'observedAt','')::timestamptz,now()),
    coalesce(nullif(p_payload->>'source',''),'LOGISTICS'),
    v_external_key,v_actor
  )
  returning id into v_observation_id;

  return jsonb_build_object(
    'success',true,'idempotent',false,'observationId',v_observation_id,'algorithmVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_freight_statistics()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
begin
  if not erp_private.can_access_module('freight','read') then
    raise exception 'No autorizado para consultar métricas de flete' using errcode='42501';
  end if;

  return (
    with evaluated as (
      select
        p.id,p.fallback_scope,p.estimate_mid,o.actual_cost,
        abs(o.actual_cost-p.estimate_mid) absolute_error,
        case when o.actual_cost>0 then abs(o.actual_cost-p.estimate_mid)/o.actual_cost*100 end ape,
        p.estimate_mid-o.actual_cost bias
      from erp_supply.freight_predictions p
      join erp_supply.freight_observations o on o.prediction_id=p.id
      where p.organization_id=v_org and p.estimate_mid is not null
    )
    select jsonb_build_object(
      'evaluatedPredictions',count(*),
      'mae',round(avg(absolute_error),0),
      'mapePct',round(avg(ape),1),
      'bias',round(avg(bias),0),
      'byFallback',coalesce((
        select jsonb_agg(jsonb_build_object(
          'scope',fallback_scope,'count',n,'mae',round(mae,0),'mapePct',round(mape,1)
        ) order by fallback_scope)
        from (
          select fallback_scope,count(*) n,avg(absolute_error) mae,avg(ape) mape
          from evaluated group by fallback_scope
        ) x
      ),'[]'::jsonb)
    )
    from evaluated
  );
end;
$$;

revoke all on function public.erp_x_freight_catalogs() from public,anon;
revoke all on function public.erp_x_freight_predict(text,text,text,text,numeric,numeric,numeric,uuid,text) from public,anon;
revoke all on function public.erp_x_freight_history(text,text,text,text,date,date,integer,integer) from public,anon;
revoke all on function public.erp_x_freight_record_actual(jsonb) from public,anon;
revoke all on function public.erp_x_freight_statistics() from public,anon;

grant execute on function public.erp_x_freight_catalogs() to authenticated;
grant execute on function public.erp_x_freight_predict(text,text,text,text,numeric,numeric,numeric,uuid,text) to authenticated;
grant execute on function public.erp_x_freight_history(text,text,text,text,date,date,integer,integer) to authenticated;
grant execute on function public.erp_x_freight_record_actual(jsonb) to authenticated;
grant execute on function public.erp_x_freight_statistics() to authenticated;

commit;
