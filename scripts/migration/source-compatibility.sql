\pset tuples_only on
\pset format aligned

with checks as (
  select 'orders_missing_seller' check_name,count(*)::bigint failures
  from erp_supply.orders where seller_profile_id is null
  union all
  select 'orders_invalid_target_status',count(*)::bigint
  from erp_supply.orders where status not in (
    'DRAFT','QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED','PENDING_APPROVAL','CLOSED','CANCELLED'
  )
  union all
  select 'order_items_nonpositive_quantity',count(*)::bigint
  from erp_supply.order_items where quantity is null or quantity<=0
  union all
  select 'profiles_duplicate_org_email',coalesce(sum(c-1),0)::bigint
  from (
    select organization_id,lower(email),count(*) c
    from erp_supply.profiles group by organization_id,lower(email) having count(*)>1
  ) x
  union all
  select 'materials_duplicate_org_reference',coalesce(sum(c-1),0)::bigint
  from (
    select organization_id,reference,count(*) c
    from erp_supply.material_master group by organization_id,reference having count(*)>1
  ) x
  union all
  select 'materials_blank_reference',count(*)::bigint
  from erp_supply.material_master where btrim(coalesce(reference,''))=''
  union all
  select 'materials_blank_unit',count(*)::bigint
  from erp_supply.material_master where btrim(coalesce(unit,''))=''
  union all
  select 'deliveries_without_actor_fallback',count(*)::bigint
  from erp_supply.deliveries d join erp_supply.orders o on o.id=d.order_id
  where coalesce(d.assigned_profile_id,o.current_assignee_id,o.seller_profile_id) is null
  union all
  select 'deliveries_unmapped_status',count(*)::bigint
  from erp_supply.deliveries where status not in (
    'PLANNED','DISPATCHED','IN_TRANSIT','DELIVERED','NOT_DELIVERED','REPROGRAMMED','CANCELLED'
  )
  union all
  select 'active_reservation_shortage',count(*)::bigint
  from erp_supply.material_reservations
  where status='ACTIVE' and shortage_quantity>0
)
select check_name,failures,case when failures=0 then 'PASS' else 'FAIL' end status
from checks order by check_name;

select
  count(*) filter(where amount>0) as operational_invoices,
  count(*) filter(where amount is null or amount<=0) as archive_only_invoice_refs
from erp_supply.invoices;
