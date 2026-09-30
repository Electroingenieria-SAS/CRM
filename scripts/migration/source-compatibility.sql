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
  union all
  select 'inventory_movements_missing_actor',count(*)::bigint
  from erp_supply.inventory_movements where actor_profile_id is null
  union all
  select 'inventory_movements_missing_lot',count(*)::bigint
  from erp_supply.inventory_movements where lot_id is null
  union all
  select 'inventory_movements_unmapped_type',count(*)::bigint
  from erp_supply.inventory_movements
  where movement_type not in('RECEIPT','ISSUE','CUT_REEL_ENTRY','CUT_CONSUMPTION')
  union all
  select 'workforce_assignment_missing_actor',count(*)::bigint
  from erp_supply.work_assignments a
  left join erp_supply.profiles p on p.id=a.assigned_by
  where a.assigned_by is null or p.id is null
  union all
  select 'workforce_member_missing_profile',count(*)::bigint
  from erp_supply.work_assignment_members m
  left join erp_supply.profiles p on p.id=m.profile_id
  where p.id is null
  union all
  select 'workforce_member_unmapped_status',count(*)::bigint
  from erp_supply.work_assignment_members
  where status not in('PLANNED','WAITING_EVIDENCE','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED')
  union all
  select 'workforce_execution_missing_reference',count(*)::bigint
  from erp_supply.work_executions e
  left join erp_supply.profiles p on p.id=e.profile_id
  left join erp_supply.work_activity_catalog c on c.id=e.catalog_id
  where p.id is null or c.id is null
     or (e.assignment_id is not null and e.assignment_member_id is null)
  union all
  select 'workforce_execution_unmapped_status',count(*)::bigint
  from erp_supply.work_executions
  where status not in('PAUSED','WAITING_EVIDENCE','IN_PROGRESS','COMPLETED','CANCELLED')
  union all
  select 'workforce_evidence_unmapped_type',count(*)::bigint
  from erp_supply.work_evidence
  where evidence_type not in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO','FILE','LINK','ERP_REFERENCE')
  union all
  select 'audit_sensitive_payload',count(*)::bigint
  from erp_supply.system_audit
  where (
    coalesce(metadata,'{}'::jsonb) ||
    jsonb_build_object('beforeData',before_data,'afterData',after_data)
  )::text ~* '"(password|passwd|token|access_token|refresh_token|service_role|authorization|jwt|secret)"[[:space:]]*:'
)
select check_name,failures,case when failures=0 then 'PASS' else 'FAIL' end status
from checks order by check_name;

select
  count(*) filter(where amount>0) as operational_invoices,
  count(*) filter(where amount is null or amount<=0) as archive_only_invoice_refs
from erp_supply.invoices;
