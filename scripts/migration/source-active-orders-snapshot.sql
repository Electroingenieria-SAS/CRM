\pset tuples_only on
\pset format unaligned

select coalesce(jsonb_pretty(jsonb_agg(row_to_json(x) order by x.order_id)),'[]')
from (
  select
    o.id as order_id,
    o.status,
    o.current_step_code,
    o.current_assignee_id,
    o.current_role_code,
    o.version,
    (select count(*) from erp_supply.order_tasks t where t.order_id=o.id) as task_count,
    (select count(*) from erp_supply.invoices i where i.order_id=o.id) as invoice_count,
    (select count(*) from erp_supply.material_reservations r where r.order_id=o.id) as reservation_count,
    (select count(*) from erp_supply.deliveries d where d.order_id=o.id) as shipment_count
  from erp_supply.orders o
  where o.status not in ('CLOSED','CANCELLED')
) x;
