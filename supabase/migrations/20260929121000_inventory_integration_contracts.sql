begin;

create or replace function public.erp_x_inventory_availability(
  p_material_id uuid,
  p_variant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_unit text;
  v_on_hand numeric;
  v_reserved numeric;
  v_committed numeric;
begin
  if erp_private.current_profile_id() is null then
    raise exception 'Sesión inválida' using errcode='42501';
  end if;

  if not (
    erp_private.can_access_module('inventory','read')
    or erp_private.can_access_module('orders','read')
    or erp_private.can_access_module('purchasing','read')
  ) then
    raise exception 'No autorizado para consultar disponibilidad' using errcode='42501';
  end if;

  select upper(btrim(m.unit))
  into v_unit
  from erp_supply.material_master m
  where m.id=p_material_id and m.organization_id=v_org and m.active;

  if v_unit is null then
    raise exception 'Material no disponible en esta organización' using errcode='22023';
  end if;

  if p_variant_id is not null and not exists(
    select 1
    from erp_supply.material_variants v
    where v.id=p_variant_id
      and v.organization_id=v_org
      and v.material_id=p_material_id
      and v.active
  ) then
    raise exception 'Variante no disponible para el material' using errcode='22023';
  end if;

  select
    coalesce(sum(b.on_hand),0),
    coalesce(sum(b.reserved),0),
    coalesce(sum(b.committed),0)
  into v_on_hand,v_reserved,v_committed
  from erp_supply.inventory_balances b
  where b.organization_id=v_org
    and b.material_id=p_material_id
    and (p_variant_id is null or b.variant_id=p_variant_id);

  return jsonb_build_object(
    'materialId',p_material_id,
    'variantId',p_variant_id,
    'unit',v_unit,
    'onHand',v_on_hand,
    'reserved',v_reserved,
    'committed',v_committed,
    'available',v_on_hand-v_reserved-v_committed,
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_inventory_availability(uuid,uuid) from public,anon;
grant execute on function public.erp_x_inventory_availability(uuid,uuid) to authenticated;

commit;
