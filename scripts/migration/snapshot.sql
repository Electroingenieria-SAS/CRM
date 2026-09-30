select jsonb_pretty(jsonb_build_object(
  'organizations',(select count(*) from erp_supply.organizations),
  'profiles',(select count(*) from erp_supply.profiles),
  'profile_roles',(select count(*) from erp_supply.profile_roles),
  'orders',(select count(*) from erp_supply.orders),
  'order_items',(select count(*) from erp_supply.order_items),
  'invoices',(select count(*) from erp_supply.invoices),
  'materials',(select count(*) from erp_supply.material_master),
  'shipments',(select count(*) from erp_supply.logistics_shipments),
  'orders_by_status',coalesce((
    select jsonb_object_agg(status,total)
    from (select status,count(*)::bigint total from erp_supply.orders group by status) x
  ),'{}'::jsonb),
  'shipments_by_status',coalesce((
    select jsonb_object_agg(status,total)
    from (select status,count(*)::bigint total from erp_supply.logistics_shipments group by status) x
  ),'{}'::jsonb),
  'invoice_amount_by_currency',coalesce((
    select jsonb_object_agg(currency,total)
    from (
      select currency,sum(amount-reversed_amount)::numeric total
      from erp_supply.invoices
      where status<>'VOID'
      group by currency
    ) x
  ),'{}'::jsonb),
  'actual_freight_total',coalesce((select sum(actual_freight) from erp_supply.logistics_shipments),0),
  'inventory',jsonb_build_object(
    'physical_total',coalesce((select sum(on_hand) from erp_supply.inventory_balances),0),
    'committed_total',coalesce((select sum(committed) from erp_supply.inventory_balances),0),
    'erp_reserved_effective',coalesce((select sum(reserved) from erp_supply.inventory_balances),0),
    'available_to_promise',coalesce((
      select sum(on_hand-reserved-committed) from erp_supply.inventory_balances
    ),0),
    'active_reservation_count',(
      select count(*) from erp_supply.inventory_reservations
      where status in ('ACTIVE','PARTIALLY_PICKED')
    ),
    'active_reservation_requested',coalesce((
      select sum(quantity) from erp_supply.inventory_reservations
      where status in ('ACTIVE','PARTIALLY_PICKED')
    ),0)
  )
));
