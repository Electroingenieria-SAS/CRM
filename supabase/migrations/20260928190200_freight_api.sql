begin;

create or replace function public.erp_x_freight_catalog()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid := erp_private.current_org_id();
  v_carriers jsonb;
  v_destinations jsonb;
  v_coverage jsonb;
begin
  if not erp_private.can_access_module('freight','read') then
    raise exception 'No autorizado para consultar Freight Intelligence' using errcode='42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id',id,'code',code,'name',name)
      order by name
    ),
    '[]'::jsonb
  )
  into v_carriers
  from erp_supply.freight_carriers
  where organization_id=v_org and active;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',d.id,
        'cityKey',d.city_key,
        'city',d.city_name,
        'departmentKey',d.department_key,
        'department',d.department_name,
        'countryCode',d.country_code
      )
      order by d.department_name,d.city_name
    ),
    '[]'::jsonb
  )
  into v_destinations
  from erp_supply.freight_destinations d
  where d.active
    and (
      exists (
        select 1
        from erp_supply.freight_historical_aggregates h
        where h.organization_id=v_org and h.destination_id=d.id
      )
      or exists (
        select 1
        from erp_supply.freight_observations o
        where o.organization_id=v_org and o.destination_id=d.id
      )
    );

  select jsonb_build_object(
    'historicalSamples',coalesce(sum(sample_count),0),
    'aggregateRows',count(*),
    'cities',count(distinct destination_id),
    'departments',count(distinct d.department_key),
    'carriers',count(distinct carrier_id),
    'sourceFrom',min(source_start),
    'sourceTo',max(source_end),
    'newActuals',(
      select count(*)
      from erp_supply.freight_observations o
      where o.organization_id=v_org
    )
  )
  into v_coverage
  from erp_supply.freight_historical_aggregates h
  join erp_supply.freight_destinations d on d.id=h.destination_id
  where h.organization_id=v_org;

  return jsonb_build_object(
    'carriers',v_carriers,
    'destinations',v_destinations,
    'coverage',v_coverage,
    'algorithmVersion','FREIGHT_ROBUST_V1',
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_freight_predict(
  p_destination_id uuid,
  p_route_code text,
  p_carrier_id uuid default null,
  p_weight_kg numeric default null,
  p_package_count numeric default null,
  p_volume_m3 numeric default null,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid := erp_private.current_org_id();
  v_actor uuid := erp_private.current_profile_id();
  v_route text := upper(trim(coalesce(p_route_code,'')));
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_prediction_id uuid;
  v_carrier record;
begin
  if not erp_private.can_access_module('freight','create') then
    raise exception 'No autorizado para solicitar predicciones de flete' using errcode='42501';
  end if;

  if v_actor is null or v_org is null then
    raise exception 'Usuario sin perfil operativo activo' using errcode='42501';
  end if;

  if not exists(
    select 1 from erp_supply.delivery_routes
    where code=v_route and active
  ) then
    raise exception 'Modalidad de entrega inválida';
  end if;

  if not exists(
    select 1 from erp_supply.freight_destinations
    where id=p_destination_id and active
  ) then
    raise exception 'Destino inválido' using errcode='P0002';
  end if;

  if p_order_id is not null and not exists(
    select 1
    from erp_supply.orders
    where id=p_order_id and organization_id=v_org
  ) then
    raise exception 'Pedido no visible para la organización' using errcode='42501';
  end if;

  if v_route in ('CLIENT_POINT','CLIENT_PICKUP') then
    v_result := jsonb_build_object(
      'available',false,
      'status','NOT_APPLICABLE',
      'carrierId',null,
      'carrierCode',null,
      'carrierName',null,
      'destinationId',p_destination_id,
      'fallbackLevel','NOT_APPLICABLE',
      'evidenceLevel','NOT_APPLICABLE',
      'sampleCount',0,
      'outlierCount',0,
      'basis','NO_FREIGHT_ROUTE',
      'explanationCode','ROUTE_HAS_NO_FREIGHT',
      'algorithmVersion','FREIGHT_ROBUST_V1'
    );

    insert into erp_supply.freight_predictions(
      organization_id,order_id,carrier_id,destination_id,route_code,
      requested_weight_kg,requested_package_count,requested_volume_m3,
      result_status,fallback_level,evidence_level,evidence_samples,outlier_count,
      estimate_low,estimate_mid,estimate_high,
      algorithm_version,basis,source_from,source_to,explanation_code,diagnostics,
      created_by
    )
    values(
      v_org,p_order_id,null,p_destination_id,v_route,
      p_weight_kg,p_package_count,p_volume_m3,
      'NOT_APPLICABLE','NOT_APPLICABLE','NOT_APPLICABLE',0,0,
      null,null,null,
      'FREIGHT_ROBUST_V1','NO_FREIGHT_ROUTE',null,null,
      'ROUTE_HAS_NO_FREIGHT','{}'::jsonb,v_actor
    )
    returning id into v_prediction_id;

    return jsonb_build_object(
      'results',jsonb_build_array(v_result||jsonb_build_object('predictionId',v_prediction_id)),
      'algorithmVersion','FREIGHT_ROBUST_V1',
      'contractVersion','1.0.0'
    );
  end if;

  for v_carrier in
    select id,code,name
    from erp_supply.freight_carriers
    where organization_id=v_org
      and active
      and (p_carrier_id is null or id=p_carrier_id)
    order by name
  loop
    v_result := erp_private.freight_predict_one(
      v_carrier.id,p_destination_id,v_route,
      p_weight_kg,p_package_count,p_volume_m3
    );

    insert into erp_supply.freight_predictions(
      organization_id,order_id,carrier_id,destination_id,route_code,
      requested_weight_kg,requested_package_count,requested_volume_m3,
      result_status,fallback_level,evidence_level,evidence_samples,outlier_count,
      estimate_low,estimate_mid,estimate_high,
      algorithm_version,basis,source_from,source_to,explanation_code,diagnostics,
      created_by
    )
    values(
      v_org,p_order_id,v_carrier.id,p_destination_id,v_route,
      p_weight_kg,p_package_count,p_volume_m3,
      v_result->>'status',
      v_result->>'fallbackLevel',
      v_result->>'evidenceLevel',
      coalesce((v_result->>'sampleCount')::integer,0),
      coalesce((v_result->>'outlierCount')::integer,0),
      nullif(v_result->>'estimateLow','')::numeric,
      nullif(v_result->>'estimateMid','')::numeric,
      nullif(v_result->>'estimateHigh','')::numeric,
      coalesce(v_result->>'algorithmVersion','FREIGHT_ROBUST_V1'),
      coalesce(v_result->>'basis','UNKNOWN'),
      nullif(v_result->>'sourceFrom','')::date,
      nullif(v_result->>'sourceTo','')::date,
      coalesce(v_result->>'explanationCode','UNKNOWN'),
      v_result - array[
        'estimateLow','estimateMid','estimateHigh',
        'carrierId','destinationId'
      ],
      v_actor
    )
    returning id into v_prediction_id;

    v_results := v_results || jsonb_build_array(
      v_result || jsonb_build_object('predictionId',v_prediction_id)
    );
  end loop;

  if jsonb_array_length(v_results)=0 then
    raise exception 'Transportadora inválida o inactiva' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'results',v_results,
    'algorithmVersion','FREIGHT_ROBUST_V1',
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_freight_history(
  p_destination_id uuid default null,
  p_department_key text default null,
  p_carrier_id uuid default null,
  p_route_code text default null,
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
  v_org uuid := erp_private.current_org_id();
  v_page integer := greatest(coalesce(p_page,1),1);
  v_size integer := least(greatest(coalesce(p_page_size,25),1),100);
  v_department text := nullif(erp_private.freight_department_key(p_department_key),'');
  v_route text := nullif(upper(trim(coalesce(p_route_code,''))),'');
  v_total bigint;
  v_rows jsonb;
  v_actuals jsonb;
begin
  if not erp_private.can_access_module('freight','read') then
    raise exception 'No autorizado para consultar histórico de fletes' using errcode='42501';
  end if;

  with filtered as (
    select h.*
    from erp_supply.freight_historical_aggregates h
    join erp_supply.freight_destinations d on d.id=h.destination_id
    where h.organization_id=v_org
      and (p_destination_id is null or h.destination_id=p_destination_id)
      and (v_department is null or d.department_key=v_department)
      and (p_carrier_id is null or h.carrier_id=p_carrier_id)
      and (v_route is null or h.route_code=v_route)
      and (p_from is null or h.source_end>=p_from)
      and (p_to is null or h.source_start<=p_to)
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select
      h.*,d.city_name,d.department_name,c.code carrier_code,c.name carrier_name
    from erp_supply.freight_historical_aggregates h
    join erp_supply.freight_destinations d on d.id=h.destination_id
    join erp_supply.freight_carriers c on c.id=h.carrier_id
    where h.organization_id=v_org
      and (p_destination_id is null or h.destination_id=p_destination_id)
      and (v_department is null or d.department_key=v_department)
      and (p_carrier_id is null or h.carrier_id=p_carrier_id)
      and (v_route is null or h.route_code=v_route)
      and (p_from is null or h.source_end>=p_from)
      and (p_to is null or h.source_start<=p_to)
    order by h.source_end desc,d.city_name,c.name
    offset (v_page-1)*v_size
    limit v_size
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',id,
      'carrierId',carrier_id,
      'carrierCode',carrier_code,
      'carrierName',carrier_name,
      'destinationId',destination_id,
      'city',city_name,
      'department',department_name,
      'route',route_code,
      'sampleCount',sample_count,
      'weightSampleCount',weight_sample_count,
      'weightP20',weight_p20,
      'weightP50',weight_p50,
      'weightP80',weight_p80,
      'costP20',cost_p20,
      'costP50',cost_p50,
      'costP80',cost_p80,
      'transitSamples',transit_sample_count,
      'transitP50Days',transit_p50_days,
      'transitP80Days',transit_p80_days,
      'sourceFrom',source_start,
      'sourceTo',source_end,
      'sourceLabel',source_label
    ) order by source_end desc,city_name,carrier_name),
    '[]'::jsonb
  )
  into v_rows
  from filtered;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',o.id,
      'orderId',o.order_id,
      'carrierId',o.carrier_id,
      'carrierName',c.name,
      'destinationId',o.destination_id,
      'city',d.city_name,
      'department',d.department_name,
      'route',o.route_code,
      'actualCost',o.actual_cost,
      'weightKg',o.weight_kg,
      'packageCount',o.package_count,
      'volumeM3',o.volume_m3,
      'observedAt',o.observed_at,
      'source',o.source
    ) order by o.observed_at desc),
    '[]'::jsonb
  )
  into v_actuals
  from (
    select *
    from erp_supply.freight_observations o
    where o.organization_id=v_org
      and (p_destination_id is null or o.destination_id=p_destination_id)
      and (p_carrier_id is null or o.carrier_id=p_carrier_id)
      and (v_route is null or o.route_code=v_route)
      and (p_from is null or o.observed_at::date>=p_from)
      and (p_to is null or o.observed_at::date<=p_to)
    order by o.observed_at desc
    limit 50
  ) o
  join erp_supply.freight_destinations d on d.id=o.destination_id
  join erp_supply.freight_carriers c on c.id=o.carrier_id;

  return jsonb_build_object(
    'rows',v_rows,
    'recentActuals',v_actuals,
    'pagination',jsonb_build_object(
      'page',v_page,
      'pageSize',v_size,
      'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_record_freight_actual(
  p_carrier_id uuid,
  p_destination_id uuid,
  p_route_code text,
  p_actual_cost numeric,
  p_observed_at timestamptz,
  p_order_id uuid default null,
  p_prediction_id uuid default null,
  p_weight_kg numeric default null,
  p_package_count numeric default null,
  p_volume_m3 numeric default null,
  p_service_type text default null,
  p_declared_value numeric default null,
  p_external_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid := erp_private.current_org_id();
  v_actor uuid := erp_private.current_profile_id();
  v_route text := upper(trim(coalesce(p_route_code,'')));
  v_observation_id uuid;
  v_prediction erp_supply.freight_predictions%rowtype;
  v_absolute_error numeric;
  v_signed_error numeric;
  v_ape numeric;
begin
  if not (
    erp_private.can_access_module('freight','update')
    or erp_private.can_access_module('freight','admin')
  ) then
    raise exception 'No autorizado para registrar costo real de flete' using errcode='42501';
  end if;

  if p_actual_cost is null or p_actual_cost<0 then
    raise exception 'El costo real debe ser un valor no negativo';
  end if;

  if p_observed_at is null then
    raise exception 'La fecha observada es obligatoria';
  end if;

  if not exists(
    select 1 from erp_supply.freight_carriers
    where id=p_carrier_id and organization_id=v_org and active
  ) then
    raise exception 'Transportadora inválida' using errcode='P0002';
  end if;

  if not exists(
    select 1 from erp_supply.freight_destinations
    where id=p_destination_id and active
  ) then
    raise exception 'Destino inválido' using errcode='P0002';
  end if;

  if p_order_id is not null and not exists(
    select 1 from erp_supply.orders
    where id=p_order_id and organization_id=v_org
  ) then
    raise exception 'Pedido no visible para la organización' using errcode='42501';
  end if;

  insert into erp_supply.freight_observations(
    organization_id,order_id,carrier_id,destination_id,route_code,
    actual_cost,weight_kg,package_count,volume_m3,service_type,declared_value,
    observed_at,source,external_key,created_by
  )
  values(
    v_org,p_order_id,p_carrier_id,p_destination_id,v_route,
    p_actual_cost,p_weight_kg,p_package_count,p_volume_m3,
    nullif(trim(p_service_type),''),
    p_declared_value,p_observed_at,'CRM',nullif(trim(p_external_key),''),v_actor
  )
  returning id into v_observation_id;

  if p_prediction_id is not null then
    select *
    into v_prediction
    from erp_supply.freight_predictions
    where id=p_prediction_id and organization_id=v_org;

    if not found then
      raise exception 'Predicción no visible para la organización' using errcode='42501';
    end if;

    if v_prediction.carrier_id is distinct from p_carrier_id
       or v_prediction.destination_id<>p_destination_id
       or v_prediction.route_code<>v_route then
      raise exception 'El costo real no corresponde a la predicción indicada';
    end if;

    if v_prediction.estimate_mid is not null then
      v_signed_error := v_prediction.estimate_mid-p_actual_cost;
      v_absolute_error := abs(v_signed_error);
      v_ape := case
        when p_actual_cost>0 then v_absolute_error/p_actual_cost*100
        else null
      end;

      insert into erp_supply.freight_prediction_outcomes(
        organization_id,prediction_id,observation_id,
        absolute_error,absolute_percentage_error,signed_error
      )
      values(
        v_org,p_prediction_id,v_observation_id,
        v_absolute_error,v_ape,v_signed_error
      );
    end if;
  end if;

  return jsonb_build_object(
    'success',true,
    'observationId',v_observation_id,
    'predictionId',p_prediction_id,
    'absoluteError',v_absolute_error,
    'absolutePercentageError',v_ape,
    'signedError',v_signed_error,
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_freight_metrics()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid := erp_private.current_org_id();
  v_summary jsonb;
  v_by_carrier jsonb;
begin
  if not erp_private.can_access_module('freight','read') then
    raise exception 'No autorizado para consultar métricas de flete' using errcode='42501';
  end if;

  select jsonb_build_object(
    'evaluatedPredictions',count(*),
    'mae',round(avg(o.absolute_error),0),
    'mape',round(avg(o.absolute_percentage_error),1),
    'bias',round(avg(o.signed_error),0)
  )
  into v_summary
  from erp_supply.freight_prediction_outcomes o
  where o.organization_id=v_org;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'carrierId',carrier_id,
      'carrierName',carrier_name,
      'samples',samples,
      'mae',mae,
      'mape',mape,
      'bias',bias
    ) order by carrier_name),
    '[]'::jsonb
  )
  into v_by_carrier
  from (
    select
      p.carrier_id,
      c.name carrier_name,
      count(*) samples,
      round(avg(o.absolute_error),0) mae,
      round(avg(o.absolute_percentage_error),1) mape,
      round(avg(o.signed_error),0) bias
    from erp_supply.freight_prediction_outcomes o
    join erp_supply.freight_predictions p on p.id=o.prediction_id
    left join erp_supply.freight_carriers c on c.id=p.carrier_id
    where o.organization_id=v_org
    group by p.carrier_id,c.name
  ) metrics;

  return jsonb_build_object(
    'summary',v_summary,
    'byCarrier',v_by_carrier,
    'algorithmVersion','FREIGHT_ROBUST_V1',
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_freight_catalog() from public,anon;
revoke all on function public.erp_x_freight_predict(uuid,text,uuid,numeric,numeric,numeric,uuid)
from public,anon;
revoke all on function public.erp_x_freight_history(uuid,text,uuid,text,date,date,integer,integer)
from public,anon;
revoke all on function public.erp_x_record_freight_actual(
  uuid,uuid,text,numeric,timestamptz,uuid,uuid,numeric,numeric,numeric,text,numeric,text
) from public,anon;
revoke all on function public.erp_x_freight_metrics() from public,anon;

grant execute on function public.erp_x_freight_catalog() to authenticated;
grant execute on function public.erp_x_freight_predict(
  uuid,text,uuid,numeric,numeric,numeric,uuid
) to authenticated;
grant execute on function public.erp_x_freight_history(
  uuid,text,uuid,text,date,date,integer,integer
) to authenticated;
grant execute on function public.erp_x_record_freight_actual(
  uuid,uuid,text,numeric,timestamptz,uuid,uuid,numeric,numeric,numeric,text,numeric,text
) to authenticated;
grant execute on function public.erp_x_freight_metrics() to authenticated;

commit;
