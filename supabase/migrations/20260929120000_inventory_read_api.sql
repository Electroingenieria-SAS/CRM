begin;

create or replace function public.erp_x_inventory_locations()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
begin
  perform erp_private.inventory_require('read');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',l.id,'code',l.code,'name',l.name,'type',l.location_type,'parentId',l.parent_id
    ) order by l.code)
    from erp_supply.inventory_locations l
    where l.organization_id=erp_private.current_org_id() and l.active
  ),'[]'::jsonb);
end;
$$;

create or replace function public.erp_x_inventory_list(
  p_search text default null,
  p_location_id uuid default null,
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
  v_q text:=lower(btrim(coalesce(p_search,'')));
  v_total integer;
  v_items jsonb;
begin
  perform erp_private.inventory_require('read');

  select count(*) into v_total
  from erp_supply.inventory_balances b
  join erp_supply.material_master m on m.id=b.material_id
  left join erp_supply.material_variants v on v.id=b.variant_id
  join erp_supply.inventory_locations l on l.id=b.location_id
  where b.organization_id=v_org
    and m.active and l.active
    and (p_location_id is null or b.location_id=p_location_id)
    and (
      v_q='' or lower(concat_ws(' ',m.reference,m.name,coalesce(v.code,''),coalesce(v.label,''),l.code,l.name)) like '%'||v_q||'%'
    );

  select coalesce(jsonb_agg(to_jsonb(x) order by x.reference,x."variantLabel",x."locationCode"),'[]'::jsonb)
  into v_items
  from (
    select
      b.id "balanceId",
      m.id "materialId",
      m.reference,
      m.name,
      m.unit,
      v.id "variantId",
      v.code "variantCode",
      v.label "variantLabel",
      l.id "locationId",
      l.code "locationCode",
      l.name "locationName",
      b.on_hand "onHand",
      b.reserved,
      b.committed,
      b.on_hand-b.reserved-b.committed available,
      b.version
    from erp_supply.inventory_balances b
    join erp_supply.material_master m on m.id=b.material_id
    left join erp_supply.material_variants v on v.id=b.variant_id
    join erp_supply.inventory_locations l on l.id=b.location_id
    where b.organization_id=v_org
      and m.active and l.active
      and (p_location_id is null or b.location_id=p_location_id)
      and (
        v_q='' or lower(concat_ws(' ',m.reference,m.name,coalesce(v.code,''),coalesce(v.label,''),l.code,l.name)) like '%'||v_q||'%'
      )
    order by m.reference,coalesce(v.label,''),l.code
    offset (v_page-1)*v_size
    limit v_size
  ) x;

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

create or replace function public.erp_x_inventory_material_detail(
  p_material_id uuid,
  p_variant_id uuid default null,
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
  v_total integer;
  v_material jsonb;
  v_balances jsonb;
  v_reservations jsonb;
  v_movements jsonb;
begin
  perform erp_private.inventory_require('read');

  select jsonb_build_object(
    'id',m.id,'reference',m.reference,'name',m.name,'unit',m.unit,'attributes',m.attributes,
    'variant',case when p_variant_id is null then null else (
      select jsonb_build_object('id',v.id,'code',v.code,'label',v.label,'attributes',v.attributes)
      from erp_supply.material_variants v
      where v.id=p_variant_id and v.material_id=m.id and v.organization_id=v_org and v.active
    ) end
  )
  into v_material
  from erp_supply.material_master m
  where m.id=p_material_id and m.organization_id=v_org and m.active;

  if v_material is null then raise exception 'Material no encontrado' using errcode='22023'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'balanceId',b.id,'locationId',l.id,'locationCode',l.code,'locationName',l.name,
    'onHand',b.on_hand,'reserved',b.reserved,'committed',b.committed,
    'available',b.on_hand-b.reserved-b.committed,'version',b.version
  ) order by l.code),'[]'::jsonb)
  into v_balances
  from erp_supply.inventory_balances b
  join erp_supply.inventory_locations l on l.id=b.location_id
  where b.organization_id=v_org
    and b.material_id=p_material_id
    and (p_variant_id is null or b.variant_id=p_variant_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'orderId',r.order_id,'orderNumber',o.order_number,
    'quantity',r.quantity,'unit',r.unit,'status',r.status,'reference',r.reference,
    'createdAt',r.created_at
  ) order by r.created_at desc),'[]'::jsonb)
  into v_reservations
  from erp_supply.inventory_reservations r
  join erp_supply.orders o on o.id=r.order_id
  where r.organization_id=v_org
    and r.material_id=p_material_id
    and (p_variant_id is null or r.variant_id=p_variant_id)
    and r.status not in('CLOSED','RELEASED');

  select count(*) into v_total
  from erp_supply.inventory_movements m
  where m.organization_id=v_org
    and m.material_id=p_material_id
    and (p_variant_id is null or m.variant_id=p_variant_id);

  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb)
  into v_movements
  from (
    select
      m.id,
      m.movement_type "type",
      m.quantity,
      m.unit,
      m.on_hand_delta "onHandDelta",
      m.reserved_delta "reservedDelta",
      m.committed_delta "committedDelta",
      l.code "locationCode",
      l.name "locationName",
      o.order_number "orderNumber",
      p.display_name actor,
      m.reference,
      m.reason,
      m.created_at "createdAt"
    from erp_supply.inventory_movements m
    join erp_supply.inventory_locations l on l.id=m.location_id
    left join erp_supply.orders o on o.id=m.order_id
    join erp_supply.profiles p on p.id=m.actor_profile_id
    where m.organization_id=v_org
      and m.material_id=p_material_id
      and (p_variant_id is null or m.variant_id=p_variant_id)
    order by m.created_at desc,m.id desc
    offset (v_page-1)*v_size
    limit v_size
  ) x;

  return jsonb_build_object(
    'material',v_material,
    'balances',v_balances,
    'reservations',v_reservations,
    'movements',v_movements,
    'movementPagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_inventory_order_trace(
  p_order_id uuid,
  p_page integer default 1,
  p_page_size integer default 50
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
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_total integer;
  v_reservations jsonb;
  v_movements jsonb;
begin
  perform erp_private.inventory_require('read');
  if not exists(select 1 from erp_supply.orders o where o.id=p_order_id and o.organization_id=v_org) then
    raise exception 'Pedido no disponible' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'materialId',r.material_id,'reference',m.reference,'name',m.name,
    'variantId',r.variant_id,'variantLabel',v.label,'quantity',r.quantity,
    'unit',r.unit,'status',r.status,'createdAt',r.created_at
  ) order by r.created_at),'[]'::jsonb)
  into v_reservations
  from erp_supply.inventory_reservations r
  join erp_supply.material_master m on m.id=r.material_id
  left join erp_supply.material_variants v on v.id=r.variant_id
  where r.organization_id=v_org and r.order_id=p_order_id;

  select count(*) into v_total
  from erp_supply.inventory_movements m
  where m.organization_id=v_org and m.order_id=p_order_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt"),'[]'::jsonb)
  into v_movements
  from (
    select
      mv.id,mv.movement_type "type",mm.reference,mm.name,
      v.label "variantLabel",l.code "locationCode",
      mv.quantity,mv.unit,mv.reference "referenceText",mv.reason,
      p.display_name actor,mv.created_at "createdAt"
    from erp_supply.inventory_movements mv
    join erp_supply.material_master mm on mm.id=mv.material_id
    left join erp_supply.material_variants v on v.id=mv.variant_id
    join erp_supply.inventory_locations l on l.id=mv.location_id
    join erp_supply.profiles p on p.id=mv.actor_profile_id
    where mv.organization_id=v_org and mv.order_id=p_order_id
    order by mv.created_at,mv.id
    offset (v_page-1)*v_size
    limit v_size
  ) x;

  return jsonb_build_object(
    'orderId',p_order_id,
    'reservations',v_reservations,
    'movements',v_movements,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_inventory_locations() from public,anon;
revoke all on function public.erp_x_inventory_list(text,uuid,integer,integer) from public,anon;
revoke all on function public.erp_x_inventory_material_detail(uuid,uuid,integer,integer) from public,anon;
revoke all on function public.erp_x_inventory_order_trace(uuid,integer,integer) from public,anon;

grant execute on function public.erp_x_inventory_locations() to authenticated;
grant execute on function public.erp_x_inventory_list(text,uuid,integer,integer) to authenticated;
grant execute on function public.erp_x_inventory_material_detail(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.erp_x_inventory_order_trace(uuid,integer,integer) to authenticated;

commit;
