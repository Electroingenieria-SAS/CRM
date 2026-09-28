begin;

create or replace function erp_private.freight_city_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, erp_private
as $$
  with n as (
    select erp_private.freight_normalize(
      split_part(coalesce(p_value,''),',',1)
    ) v
  )
  select case
    when v in (
      'BOGOTA D C','BOGOTA DC','BOGOTA DISTRITO CAPITAL',
      'SANTA FE DE BOGOTA','SANTAFE DE BOGOTA'
    ) then 'BOGOTA'
    when v in ('GUADALAJARA DE BUGA','BUGA') then 'BUGA'
    when v in ('SANTA CRUZ DE LORICA','LORICA') then 'LORICA'
    when v='SANTIAGO DE CALI' then 'CALI'
    when v='SAN JOSE DE CUCUTA' then 'CUCUTA'
    when v in ('ARMENIA Q','ARMENIA QUINDIO') then 'ARMENIA'
    when v like 'SAN VICENTE DEL CHUCU%'
      or v like 'SAN VICENTE DE CHUCURI%' then 'SAN VICENTE DE CHUCURI'
    else v
  end
  from n
$$;

drop policy if exists freight_predictions_create on erp_supply.freight_predictions;
create policy freight_predictions_create
on erp_supply.freight_predictions for insert
to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
  and erp_private.can_access_module('freight','create')
  and (
    carrier_id is null
    or exists (
      select 1
      from erp_supply.freight_carriers c
      where c.id=carrier_id
        and c.organization_id=erp_private.current_org_id()
        and c.active
    )
  )
  and (
    destination_id is null
    or exists (
      select 1
      from erp_supply.freight_destinations d
      where d.id=destination_id
        and d.organization_id=erp_private.current_org_id()
        and d.active
    )
  )
  and (
    order_id is null
    or exists (
      select 1
      from erp_supply.orders o
      where o.id=order_id
        and o.organization_id=erp_private.current_org_id()
    )
  )
);

drop policy if exists freight_observations_create on erp_supply.freight_observations;
create policy freight_observations_create
on erp_supply.freight_observations for insert
to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
  and (
    erp_private.can_access_module('freight','update')
    or erp_private.can_access_module('freight','admin')
  )
  and (
    carrier_id is null
    or exists (
      select 1
      from erp_supply.freight_carriers c
      where c.id=carrier_id
        and c.organization_id=erp_private.current_org_id()
        and c.active
    )
  )
  and (
    destination_id is null
    or exists (
      select 1
      from erp_supply.freight_destinations d
      where d.id=destination_id
        and d.organization_id=erp_private.current_org_id()
        and d.active
    )
  )
  and (
    prediction_id is null
    or exists (
      select 1
      from erp_supply.freight_predictions p
      where p.id=prediction_id
        and p.organization_id=erp_private.current_org_id()
    )
  )
  and (
    order_id is null
    or exists (
      select 1
      from erp_supply.orders o
      where o.id=order_id
        and o.organization_id=erp_private.current_org_id()
    )
  )
);

create or replace function public.erp_x_freight_catalog()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_raw jsonb;
  v_summary jsonb;
begin
  v_raw:=public.erp_x_freight_catalogs();

  select coalesce(source_summary,'{}'::jsonb)
  into v_summary
  from erp_supply.freight_model_versions
  where organization_id=v_org
    and model_code='ROBUST_HISTORICAL_FALLBACK'
    and active
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'carriers',coalesce(v_raw->'carriers','[]'::jsonb),
    'destinations',coalesce(v_raw->'destinations','[]'::jsonb),
    'coverage',jsonb_build_object(
      'historicalSamples',coalesce((v_summary->>'legacyShipments')::integer,0),
      'aggregateRows',coalesce((v_summary->>'legacyRouteRows')::integer,0),
      'cities',coalesce((v_summary->>'legacyCities')::integer,0),
      'departments',coalesce((v_summary->>'legacyDepartments')::integer,0),
      'carriers',coalesce((v_summary->>'legacyCarriers')::integer,0),
      'sourceFrom',v_summary->>'sourceFrom',
      'sourceTo',v_summary->>'sourceTo',
      'newActuals',(
        select count(*)
        from erp_supply.freight_observations o
        where o.organization_id=v_org
      )
    ),
    'algorithmVersion',coalesce(v_raw#>>'{model,algorithmVersion}','1.0.0'),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_freight_compare(
  p_route text,
  p_department text,
  p_city text,
  p_carrier_id uuid default null,
  p_weight_kg numeric default null,
  p_package_count numeric default null,
  p_volume_m3 numeric default null,
  p_order_id uuid default null,
  p_request_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_results jsonb:='[]'::jsonb;
  v_raw jsonb;
  v_carrier record;
  v_status text;
  v_fallback text;
  v_evidence text;
  v_scope text;
  v_key text;
begin
  if not erp_private.can_access_module('freight','create') then
    raise exception 'No autorizado para generar predicciones de flete' using errcode='42501';
  end if;

  if upper(trim(coalesce(p_route,''))) in ('CLIENT_POINT','CLIENT_PICKUP') then
    v_raw:=public.erp_x_freight_predict(
      p_route,p_department,p_city,null,p_weight_kg,p_package_count,p_volume_m3,p_order_id,p_request_key
    );
    return jsonb_build_object(
      'results',jsonb_build_array(jsonb_build_object(
        'predictionId',null,
        'available',false,
        'status','NOT_APPLICABLE',
        'carrierId',null,
        'carrierCode',null,
        'carrierName',null,
        'city',p_city,
        'department',p_department,
        'fallbackLevel','NOT_APPLICABLE',
        'carrierFallback',false,
        'evidenceLevel','NOT_APPLICABLE',
        'sampleCount',0,
        'outlierCount',0,
        'basis','NO_FREIGHT_ROUTE',
        'explanationCode','ROUTE_HAS_NO_FREIGHT',
        'algorithmVersion',coalesce(v_raw->>'algorithmVersion','1.0.0')
      )),
      'algorithmVersion','1.0.0',
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
    v_key:=case
      when nullif(trim(coalesce(p_request_key,'')),'') is null then null
      else trim(p_request_key)||':'||v_carrier.code
    end;

    v_raw:=public.erp_x_freight_predict(
      p_route,p_department,p_city,v_carrier.code,
      p_weight_kg,p_package_count,p_volume_m3,p_order_id,v_key
    );

    v_status:=case
      when coalesce((v_raw->>'available')::boolean,false) then 'AVAILABLE'
      when v_raw->>'reason'='NO_FREIGHT_EXPECTED' then 'NOT_APPLICABLE'
      else 'INSUFFICIENT'
    end;

    v_scope:=coalesce(v_raw->>'fallbackScope','');
    v_fallback:=case
      when v_status='NOT_APPLICABLE' then 'NOT_APPLICABLE'
      when v_status='INSUFFICIENT' then 'NONE'
      when v_scope like 'CITY%' then 'CITY'
      when v_scope like 'DEPARTMENT%' then 'DEPARTMENT'
      when v_scope like 'NATIONAL%' then 'NATIONAL'
      else 'NONE'
    end;
    v_evidence:=case
      when v_status='NOT_APPLICABLE' then 'NOT_APPLICABLE'
      when v_status='INSUFFICIENT' then 'NONE'
      else coalesce(v_raw->>'evidenceLevel','LOW')
    end;

    v_results:=v_results||jsonb_build_array(jsonb_build_object(
      'predictionId',nullif(v_raw->>'predictionId','')::uuid,
      'available',v_status='AVAILABLE',
      'status',v_status,
      'carrierId',v_carrier.id,
      'carrierCode',v_carrier.code,
      'carrierName',v_carrier.name,
      'city',p_city,
      'department',p_department,
      'fallbackLevel',v_fallback,
      'carrierFallback',v_scope like '%ALL_CARRIERS',
      'evidenceLevel',v_evidence,
      'sampleCount',coalesce((v_raw->>'sampleCount')::integer,0),
      'outlierCount',coalesce((v_raw->>'outliersExcluded')::integer,0),
      'estimateLow',nullif(v_raw->>'estimateLow','')::numeric,
      'estimateMid',nullif(v_raw->>'estimateMid','')::numeric,
      'estimateHigh',nullif(v_raw->>'estimateHigh','')::numeric,
      'basis','ROBUST_HISTORY',
      'explanationCode',coalesce(nullif(v_scope,''),v_raw->>'reason','NO_COMPATIBLE_HISTORY'),
      'sourceFrom',v_raw#>>'{sourcePeriod,from}',
      'sourceTo',v_raw#>>'{sourcePeriod,to}',
      'weightPosition',v_raw->>'weightContext',
      'algorithmVersion',coalesce(v_raw->>'algorithmVersion','1.0.0')
    ));
  end loop;

  if jsonb_array_length(v_results)=0 then
    raise exception 'Transportadora inválida o inactiva' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'results',v_results,
    'algorithmVersion','1.0.0',
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_freight_catalog() from public,anon;
revoke all on function public.erp_x_freight_compare(
  text,text,text,uuid,numeric,numeric,numeric,uuid,text
) from public,anon;

grant execute on function public.erp_x_freight_catalog() to authenticated;
grant execute on function public.erp_x_freight_compare(
  text,text,text,uuid,numeric,numeric,numeric,uuid,text
) to authenticated;

commit;
