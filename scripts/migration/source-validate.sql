\pset tuples_only on
\pset format aligned

with checks as (
  select 'profiles_without_org' check_name, count(*)::bigint failures
  from erp_supply.profiles p left join erp_supply.organizations o on o.id=p.organization_id
  where o.id is null
  union all
  select 'profiles_with_missing_auth_user',count(*)::bigint
  from erp_supply.profiles p left join auth.users u on u.id=p.auth_user_id
  where p.auth_user_id is not null and u.id is null
  union all
  select 'profile_roles_without_profile',count(*)::bigint
  from erp_supply.profile_roles pr left join erp_supply.profiles p on p.id=pr.profile_id
  where p.id is null
  union all
  select 'profile_roles_without_role',count(*)::bigint
  from erp_supply.profile_roles pr left join erp_supply.roles r on r.code=pr.role_code
  where r.code is null
  union all
  select 'orders_without_org',count(*)::bigint
  from erp_supply.orders x left join erp_supply.organizations o on o.id=x.organization_id
  where o.id is null
  union all
  select 'order_items_without_order',count(*)::bigint
  from erp_supply.order_items x left join erp_supply.orders o on o.id=x.order_id
  where o.id is null
  union all
  select 'invoices_without_order',count(*)::bigint
  from erp_supply.invoices x left join erp_supply.orders o on o.id=x.order_id
  where o.id is null
  union all
  select 'deliveries_without_order',count(*)::bigint
  from erp_supply.deliveries x left join erp_supply.orders o on o.id=x.order_id
  where o.id is null
  union all
  select 'inventory_items_without_org',count(*)::bigint
  from erp_supply.inventory_items x left join erp_supply.organizations o on o.id=x.organization_id
  where o.id is null
  union all
  select 'inventory_lots_without_item',count(*)::bigint
  from erp_supply.inventory_lots x left join erp_supply.inventory_items i on i.id=x.inventory_item_id
  where i.id is null
  union all
  select 'inventory_negative_available',count(*)::bigint
  from erp_supply.inventory_lots where quantity_available<0
  union all
  select 'inventory_negative_reserved',count(*)::bigint
  from erp_supply.inventory_lots where quantity_reserved<0
  union all
  select 'inventory_negative_blocked',count(*)::bigint
  from erp_supply.inventory_lots where quantity_blocked<0
  union all
  select 'movements_without_item',count(*)::bigint
  from erp_supply.inventory_movements m left join erp_supply.inventory_items i on i.id=m.inventory_item_id
  where i.id is null
  union all
  select 'reservations_without_order',count(*)::bigint
  from erp_supply.material_reservations r left join erp_supply.orders o on o.id=r.order_id
  where o.id is null
)
select check_name,failures,case when failures=0 then 'PASS' else 'FAIL' end status
from checks order by check_name;
