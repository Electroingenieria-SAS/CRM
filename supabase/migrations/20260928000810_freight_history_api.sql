begin;

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

revoke all on function public.erp_x_freight_history(
  text,text,text,text,date,date,integer,integer
) from public,anon;
grant execute on function public.erp_x_freight_history(
  text,text,text,text,date,date,integer,integer
) to authenticated;

commit;
