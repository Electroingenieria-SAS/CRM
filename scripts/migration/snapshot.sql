\pset tuples_only on
\pset format unaligned

select jsonb_pretty(jsonb_build_object(
  'captured_at', now(),
  'organizations', (select count(*) from erp_supply.organizations),
  'profiles', (select count(*) from erp_supply.profiles),
  'profile_roles', (select count(*) from erp_supply.profile_roles),
  'roles', (select count(*) from erp_supply.roles),
  'role_module_permissions', (select count(*) from erp_supply.role_module_permissions),
  'orders', (select count(*) from erp_supply.orders),
  'order_items', (select count(*) from erp_supply.order_items),
  'invoices', (select count(*) from erp_supply.invoices),
  'material_master', (select count(*) from erp_supply.material_master),
  'inventory_items', (select count(*) from erp_supply.inventory_items),
  'inventory_lots', (select count(*) from erp_supply.inventory_lots),
  'inventory_movements', (select count(*) from erp_supply.inventory_movements),
  'material_reservations', (select count(*) from erp_supply.material_reservations),
  'work_assignments', (select count(*) from erp_supply.work_assignments),
  'work_executions', (select count(*) from erp_supply.work_executions),
  'deliveries', (select count(*) from erp_supply.deliveries),
  'freight_route_reference', (select count(*) from erp_supply.freight_route_reference),
  'system_audit', (select count(*) from erp_supply.system_audit),
  'invoice_amount_by_currency', coalesce((
    select jsonb_object_agg(currency,total)
    from (
      select currency, sum(coalesce(amount,0))::text total
      from erp_supply.invoices
      group by currency
    ) x
  ), '{}'::jsonb),
  'inventory_lot_totals', (
    select jsonb_build_object(
      'available', coalesce(sum(quantity_available),0),
      'reserved', coalesce(sum(quantity_reserved),0),
      'blocked', coalesce(sum(quantity_blocked),0)
    )
    from erp_supply.inventory_lots
  ),
  'orders_by_status', coalesce((
    select jsonb_object_agg(status,total)
    from (select status,count(*) total from erp_supply.orders group by status) x
  ), '{}'::jsonb)
));
