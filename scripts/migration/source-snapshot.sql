with legacy_lots as (
  select
    i.organization_id,
    i.material_master_id,
    l.material_variant_id,
    sum(l.quantity_available) as free_stock,
    sum(l.quantity_reserved + l.quantity_blocked) as committed_stock,
    sum(l.quantity_available + l.quantity_reserved + l.quantity_blocked) as physical_stock
  from erp_supply.inventory_lots l
  join erp_supply.inventory_items i on i.id=l.inventory_item_id
  where i.active and coalesce(l.source_active,true)
  group by i.organization_id,i.material_master_id,l.material_variant_id
),
legacy_reservations as (
  select
    organization_id,
    material_master_id,
    material_variant_id,
    count(*) filter (where status='ACTIVE') as active_count,
    coalesce(sum(quantity) filter (where status='ACTIVE'),0) as requested
  from erp_supply.material_reservations
  group by organization_id,material_master_id,material_variant_id
),
legacy_inventory as (
  select
    coalesce(sum(l.physical_stock),0) as physical_total,
    coalesce(sum(l.committed_stock),0) as committed_total,
    coalesce(sum(least(l.free_stock,coalesce(r.requested,0))),0) as erp_reserved_effective,
    coalesce(sum(greatest(l.free_stock-coalesce(r.requested,0),0)),0) as available_to_promise,
    coalesce(sum(r.active_count),0) as active_reservation_count,
    coalesce(sum(r.requested),0) as active_reservation_requested
  from legacy_lots l
  left join legacy_reservations r
    on r.organization_id=l.organization_id
   and r.material_master_id is not distinct from l.material_master_id
   and r.material_variant_id is not distinct from l.material_variant_id
),
delivery_status as (
  select canonical_status,count(*)::bigint total
  from (
    select case status
      when 'PLANNED' then 'READY'
      when 'REPROGRAMMED' then 'READY'
      when 'DISPATCHED' then 'IN_TRANSIT'
      when 'IN_TRANSIT' then 'IN_TRANSIT'
      when 'DELIVERED' then 'DELIVERED'
      when 'NOT_DELIVERED' then 'DELIVERY_FAILED'
      when 'CANCELLED' then 'CANCELLED'
      else status
    end canonical_status
    from erp_supply.deliveries
  ) s
  group by canonical_status
)
select jsonb_pretty(jsonb_build_object(
  'organizations',(select count(*) from erp_supply.organizations),
  'profiles',(select count(*) from erp_supply.profiles),
  'profile_roles',(select count(*) from erp_supply.profile_roles),
  'orders',(select count(*) from erp_supply.orders),
  'order_items',(select count(*) from erp_supply.order_items),
  'invoices',(select count(*) from erp_supply.invoices where amount>0),
  'archived_invoice_refs',(select count(*) from erp_supply.invoices where amount is null or amount<=0),
  'materials',(select count(*) from erp_supply.material_master),
  'shipments',(select count(*) from erp_supply.deliveries),
  'inventory_movements',(select count(*) from erp_supply.inventory_movements),
  'workforce_activities',(
    (select count(*) from erp_supply.work_assignment_members)
    +(select count(*) from erp_supply.work_executions where assignment_id is null)
  ),
  'workforce_execution_events',(select count(*) from erp_supply.work_executions),
  'workforce_evidence',(select count(*) from erp_supply.work_evidence),
  'legacy_audit_events',(
    select count(*) from erp_supply.system_audit a
    where a.created_at >= (select max(created_at)-interval '30 days' from erp_supply.system_audit)
       or upper(a.action) like 'AUTH\_%' escape '\\'
       or upper(a.action) like 'ADMIN\_%' escape '\\'
       or upper(a.action) like 'APPROVAL\_%' escape '\\'
  ),
  'orders_by_status',coalesce((
    select jsonb_object_agg(status,total)
    from (select status,count(*)::bigint total from erp_supply.orders group by status) x
  ),'{}'::jsonb),
  'shipments_by_status',coalesce((
    select jsonb_object_agg(canonical_status,total) from delivery_status
  ),'{}'::jsonb),
  'invoice_amount_by_currency',coalesce((
    select jsonb_object_agg(currency,total)
    from (
      select currency,sum(coalesce(amount,0))::numeric total
      from erp_supply.invoices group by currency
    ) x
  ),'{}'::jsonb),
  'actual_freight_total',coalesce((select sum(carrier_cost) from erp_supply.deliveries),0),
  'inventory',(
    select jsonb_build_object(
      'physical_total',physical_total,
      'committed_total',committed_total,
      'erp_reserved_effective',erp_reserved_effective,
      'available_to_promise',available_to_promise,
      'active_reservation_count',active_reservation_count,
      'active_reservation_requested',active_reservation_requested
    ) from legacy_inventory
  )
));
