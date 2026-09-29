begin;

create or replace function public.erp_x_logistics_candidates(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_search text:=lower(nullif(trim(coalesce(p_search,'')),''));
  v_total integer;
  v_items jsonb;
begin
  if not erp_private.can_access_module('shipping','read') then
    raise exception 'No autorizado para consultar liberaciones' using errcode='42501';
  end if;

  select count(*)::integer into v_total
  from erp_supply.orders o
  where o.organization_id=v_org
    and o.current_step_code in('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')
    and not exists(
      select 1 from erp_supply.logistics_shipments s
      where s.organization_id=v_org and s.order_id=o.id
    )
    and (
      v_search is null
      or lower(o.order_number) like '%'||v_search||'%'
      or lower(o.client_name) like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(item order by order_number),'[]'::jsonb)
  into v_items
  from(
    select o.order_number,jsonb_build_object(
      'orderId',o.id,
      'orderNumber',o.order_number,
      'customerName',o.client_name,
      'city',o.client_city,
      'address',o.client_address,
      'routeCode',o.delivery_route_code,
      'orderVersion',o.version,
      'readiness',public.erp_x_billing_readiness(o.id)
    ) item
    from erp_supply.orders o
    where o.organization_id=v_org
      and o.current_step_code in('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')
      and not exists(
        select 1 from erp_supply.logistics_shipments s
        where s.organization_id=v_org and s.order_id=o.id
      )
      and (
        v_search is null
        or lower(o.order_number) like '%'||v_search||'%'
        or lower(o.client_name) like '%'||v_search||'%'
      )
    order by o.updated_at desc,o.order_number
    limit v_size offset (v_page-1)*v_size
  ) q;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_logistics_candidates(text,integer,integer) from public,anon;
grant execute on function public.erp_x_logistics_candidates(text,integer,integer) to authenticated;

commit;
