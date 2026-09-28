begin;

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
  v_carrier_id_input uuid:=nullif(p_payload->>'carrierId','')::uuid;
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

  if v_carrier_id_input is not null then
    select id into v_carrier_id from erp_supply.freight_carriers
    where organization_id=v_org and id=v_carrier_id_input and active limit 1;
  elsif v_carrier_code is not null then
    select id into v_carrier_id from erp_supply.freight_carriers
    where organization_id=v_org and code=v_carrier_code and active limit 1;
  end if;

  if (v_carrier_id_input is not null or v_carrier_code is not null)
     and v_carrier_id is null then
    raise exception 'Transportadora inválida' using errcode='P0002';
  end if;

  if nullif(p_payload->>'orderId','') is not null and not exists(
    select 1 from erp_supply.orders
    where id=(p_payload->>'orderId')::uuid and organization_id=v_org
  ) then
    raise exception 'Pedido no visible para la organización' using errcode='42501';
  end if;

  if nullif(p_payload->>'predictionId','') is not null and not exists(
    select 1 from erp_supply.freight_predictions
    where id=(p_payload->>'predictionId')::uuid and organization_id=v_org
  ) then
    raise exception 'Predicción no visible para la organización' using errcode='42501';
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
        p.id,p.fallback_scope,p.estimate_mid,o.actual_cost,p.carrier_id,c.name carrier_name,
        abs(o.actual_cost-p.estimate_mid) absolute_error,
        case when o.actual_cost>0 then abs(o.actual_cost-p.estimate_mid)/o.actual_cost*100 end ape,
        p.estimate_mid-o.actual_cost bias
      from erp_supply.freight_predictions p
      join erp_supply.freight_observations o on o.prediction_id=p.id
      left join erp_supply.freight_carriers c on c.id=p.carrier_id
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
      ),'[]'::jsonb),
      'byCarrier',coalesce((
        select jsonb_agg(jsonb_build_object(
          'carrierId',carrier_id,'carrierName',carrier_name,'count',n,
          'mae',round(mae,0),'mapePct',round(mape,1),'bias',round(bias,0)
        ) order by carrier_name nulls last)
        from (
          select carrier_id,carrier_name,count(*) n,
                 avg(absolute_error) mae,avg(ape) mape,avg(bias) bias
          from evaluated
          group by carrier_id,carrier_name
        ) x
      ),'[]'::jsonb)
    )
    from evaluated
  );
end;
$$;

revoke all on function public.erp_x_freight_record_actual(jsonb) from public,anon;
revoke all on function public.erp_x_freight_statistics() from public,anon;

grant execute on function public.erp_x_freight_record_actual(jsonb) to authenticated;
grant execute on function public.erp_x_freight_statistics() to authenticated;

commit;
