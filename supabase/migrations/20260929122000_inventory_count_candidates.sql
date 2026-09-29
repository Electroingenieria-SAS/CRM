begin;

create or replace function public.erp_x_inventory_count_candidates(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_q text:=lower(btrim(coalesce(p_search,'')));
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_total integer;
  v_items jsonb;
begin
  perform erp_private.inventory_require('create');

  select count(*) into v_total
  from erp_supply.inventory_balances b
  join erp_supply.material_master m on m.id=b.material_id
  left join erp_supply.material_variants v on v.id=b.variant_id
  join erp_supply.inventory_locations l on l.id=b.location_id
  where b.organization_id=v_org and m.active and l.active
    and not exists (
      select 1 from erp_supply.inventory_counts c
      where c.balance_id=b.id and c.status='SUBMITTED'
    )
    and (
      v_q='' or lower(concat_ws(' ',m.reference,m.name,coalesce(v.label,''),l.code,l.name))
        like '%'||v_q||'%'
    );

  select coalesce(jsonb_agg(to_jsonb(x) order by x.reference,x."locationCode"),'[]'::jsonb)
  into v_items
  from (
    select
      b.id "balanceId",
      m.id "materialId",
      m.reference,
      m.name,
      m.unit,
      v.label "variantLabel",
      l.code "locationCode",
      l.name "locationName"
    from erp_supply.inventory_balances b
    join erp_supply.material_master m on m.id=b.material_id
    left join erp_supply.material_variants v on v.id=b.variant_id
    join erp_supply.inventory_locations l on l.id=b.location_id
    where b.organization_id=v_org and m.active and l.active
    and not exists (
      select 1 from erp_supply.inventory_counts c
      where c.balance_id=b.id and c.status='SUBMITTED'
    )
      and (
        v_q='' or lower(concat_ws(' ',m.reference,m.name,coalesce(v.label,''),l.code,l.name))
          like '%'||v_q||'%'
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
    'blind',true,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_inventory_count_candidates(text,integer,integer) from public,anon;
grant execute on function public.erp_x_inventory_count_candidates(text,integer,integer) to authenticated;

commit;
