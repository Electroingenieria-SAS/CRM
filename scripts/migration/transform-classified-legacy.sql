\set ON_ERROR_STOP on

-- Classified legacy datasets are imported after the operational opening balance is built.
-- Historical inventory movements are preserved for traceability only; they do not replay balances.

insert into erp_supply.inventory_operations(
  id,organization_id,operation_key,operation_type,actor_profile_id,result,created_at,completed_at
)
select
  (
    substr(md5('legacy-operation:'||m.id::text),1,8)||'-'||
    substr(md5('legacy-operation:'||m.id::text),9,4)||'-'||
    substr(md5('legacy-operation:'||m.id::text),13,4)||'-'||
    substr(md5('legacy-operation:'||m.id::text),17,4)||'-'||
    substr(md5('legacy-operation:'||m.id::text),21,12)
  )::uuid,
  o.id,
  'legacy-movement:'||m.id::text,
  'LEGACY_HISTORY',
  m.actor_profile_id,
  jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyMovementId',m.id,
    'legacyMovementType',m.movement_type,
    'historicalOnly',true
  ),
  m.created_at,
  m.created_at
from migration_legacy.inventory_movements m
join migration_legacy.organizations so on so.id=m.organization_id
join erp_supply.organizations o on o.code=so.code
on conflict(organization_id,operation_key) do nothing;

insert into erp_supply.inventory_movements(
  id,organization_id,operation_id,material_id,variant_id,location_id,order_id,
  movement_type,quantity,unit,on_hand_delta,reserved_delta,committed_delta,
  actor_profile_id,reference,reason,metadata,created_at
)
select
  (
    substr(md5('legacy-movement:'||m.id::text),1,8)||'-'||
    substr(md5('legacy-movement:'||m.id::text),9,4)||'-'||
    substr(md5('legacy-movement:'||m.id::text),13,4)||'-'||
    substr(md5('legacy-movement:'||m.id::text),17,4)||'-'||
    substr(md5('legacy-movement:'||m.id::text),21,12)
  )::uuid,
  o.id,
  op.id,
  i.material_master_id,
  l.material_variant_id,
  loc.id,
  m.order_id,
  case
    when m.movement_type in('RECEIPT','CUT_REEL_ENTRY') then 'RECEIPT'
    when m.movement_type in('ISSUE','CUT_CONSUMPTION') then 'CONSUME'
  end,
  m.quantity,
  m.unit,
  case
    when m.movement_type in('RECEIPT','CUT_REEL_ENTRY') then m.quantity
    else -m.quantity
  end,
  0,
  0,
  m.actor_profile_id,
  m.reference,
  'LEGACY_HISTORY_NO_BALANCE_REPLAY',
  coalesce(m.metadata,'{}'::jsonb) || jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyMovementId',m.id,
    'legacyMovementType',m.movement_type,
    'legacyFromLocation',m.from_location,
    'legacyToLocation',m.to_location,
    'historicalOnly',true,
    'openingBalanceReplayed',false
  ),
  m.created_at
from migration_legacy.inventory_movements m
join migration_legacy.organizations so on so.id=m.organization_id
join erp_supply.organizations o on o.code=so.code
join migration_legacy.inventory_items i on i.id=m.inventory_item_id
join migration_legacy.inventory_lots l on l.id=m.lot_id
join erp_supply.inventory_locations loc
  on loc.organization_id=o.id
 and loc.code='LEGACY-'||substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),1,20)
join erp_supply.inventory_operations op
  on op.organization_id=o.id and op.operation_key='legacy-movement:'||m.id::text
on conflict(id) do nothing;

insert into erp_supply.workforce_activity_catalog(
  organization_id,code,name,description,category_code,category_label,subcategory,
  activity_group,activity_kind,standard_minutes,evidence_policy,team_allowed,
  allowed_roles,active,sort_order,metadata,created_at,updated_at
)
select
  o.id,
  c.code,
  c.name,
  c.description,
  'LEGACY_'||coalesce(nullif(upper(c.activity_group),''),'GENERAL'),
  'Legacy '||initcap(lower(coalesce(nullif(c.activity_group,''),'General'))),
  'Migración CRM-SUMINISTROS',
  case when c.activity_group in('LOGISTICS','COMMERCIAL','FINANCE','PURCHASING','MANAGEMENT','GENERAL','IMPROVEMENT')
    then c.activity_group else 'GENERAL' end,
  case when c.activity_kind in('ACTIVITY','DELIVERABLE') then c.activity_kind else 'ACTIVITY' end,
  c.standard_minutes,
  case when c.evidence_policy in('NONE','FINAL_PHOTO','BEFORE_AFTER','FILE','LINK','ERP_REFERENCE')
    then c.evidence_policy else 'NONE' end,
  coalesce(c.team_allowed,false),
  coalesce(c.allowed_roles,'{}'::text[]),
  coalesce(c.active,true),
  coalesce(c.sort_order,100),
  coalesce(c.metadata,'{}'::jsonb) || jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyCatalogId',c.id,
    'legacyCatalogOrigin',c.catalog_origin,
    'legacyAcceptanceRequired',c.acceptance_required
  ),
  c.created_at,
  c.updated_at
from migration_legacy.work_activity_catalog c
join migration_legacy.organizations so on so.id=c.organization_id
join erp_supply.organizations o on o.code=so.code
where exists(select 1 from migration_legacy.work_assignments a where a.catalog_id=c.id)
   or exists(select 1 from migration_legacy.work_executions e where e.catalog_id=c.id)
on conflict(organization_id,code) do update set
  name=excluded.name,
  description=excluded.description,
  activity_group=excluded.activity_group,
  activity_kind=excluded.activity_kind,
  standard_minutes=excluded.standard_minutes,
  evidence_policy=excluded.evidence_policy,
  team_allowed=excluded.team_allowed,
  allowed_roles=excluded.allowed_roles,
  active=excluded.active,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata,
  updated_at=excluded.updated_at;

insert into erp_supply.workforce_activities(
  id,organization_id,catalog_id,assignee_profile_id,created_by,assigned_by,title,description,
  status,source,planned_start,planned_end,actual_start,actual_end,block_reason,result_note,
  version,metadata,created_at,updated_at,cancelled_at
)
select
  m.id,
  o.id,
  tc.id,
  m.profile_id,
  a.assigned_by,
  a.assigned_by,
  a.title,
  a.description,
  case m.status
    when 'PLANNED' then 'PLANNED'
    when 'WAITING_EVIDENCE' then 'IN_PROGRESS'
    when 'IN_PROGRESS' then 'IN_PROGRESS'
    when 'PAUSED' then 'BLOCKED'
    when 'COMPLETED' then 'COMPLETED'
    when 'CANCELLED' then 'CANCELLED'
  end,
  'PLANNED',
  coalesce(a.planned_start,m.assigned_at,a.created_at),
  greatest(
    coalesce(
      a.planned_end,
      a.due_at,
      coalesce(a.planned_start,m.assigned_at,a.created_at)
        + make_interval(mins=>greatest(coalesce(a.estimated_minutes,60),1))
    ),
    coalesce(a.planned_start,m.assigned_at,a.created_at)+interval '1 minute'
  ),
  case when m.status in('WAITING_EVIDENCE','IN_PROGRESS','PAUSED','COMPLETED')
    then coalesce(m.first_started_at,m.assigned_at) end,
  case when m.status='COMPLETED'
    then coalesce(m.completed_at,m.submitted_at,a.updated_at,m.assigned_at) end,
  case when m.status='PAUSED' then 'PAUSED_LEGACY' end,
  case when m.status='COMPLETED' then a.decision_note end,
  1,
  coalesce(a.metadata,'{}'::jsonb) || coalesce(m.metadata,'{}'::jsonb) || jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyAssignmentId',a.id,
    'legacyAssignmentMemberId',m.id,
    'legacyAssignmentStatus',a.status,
    'legacyMemberStatus',m.status,
    'legacyPriority',a.priority,
    'legacyRequestOrigin',a.request_origin,
    'legacyApprovalStatus',a.approval_status
  ),
  a.created_at,
  greatest(a.updated_at,m.assigned_at),
  case when m.status='CANCELLED' then coalesce(m.cancelled_at,a.updated_at,m.assigned_at) end
from migration_legacy.work_assignment_members m
join migration_legacy.work_assignments a on a.id=m.assignment_id
join migration_legacy.work_activity_catalog sc on sc.id=a.catalog_id
join migration_legacy.organizations so on so.id=a.organization_id
join erp_supply.organizations o on o.code=so.code
join erp_supply.workforce_activity_catalog tc on tc.organization_id=o.id and tc.code=sc.code
on conflict(id) do update set
  catalog_id=excluded.catalog_id,
  assignee_profile_id=excluded.assignee_profile_id,
  title=excluded.title,
  description=excluded.description,
  status=excluded.status,
  planned_start=excluded.planned_start,
  planned_end=excluded.planned_end,
  actual_start=excluded.actual_start,
  actual_end=excluded.actual_end,
  block_reason=excluded.block_reason,
  result_note=excluded.result_note,
  metadata=excluded.metadata,
  updated_at=excluded.updated_at,
  cancelled_at=excluded.cancelled_at;

insert into erp_supply.workforce_activities(
  id,organization_id,catalog_id,assignee_profile_id,created_by,assigned_by,title,description,
  status,source,planned_start,planned_end,actual_start,actual_end,block_reason,result_note,
  version,metadata,created_at,updated_at,cancelled_at
)
select
  e.id,
  o.id,
  tc.id,
  e.profile_id,
  e.profile_id,
  e.profile_id,
  e.title_snapshot,
  e.result_note,
  case e.status
    when 'PAUSED' then 'BLOCKED'
    when 'WAITING_EVIDENCE' then 'IN_PROGRESS'
    when 'IN_PROGRESS' then 'IN_PROGRESS'
    when 'COMPLETED' then 'COMPLETED'
    when 'CANCELLED' then 'CANCELLED'
  end,
  'MANUAL',
  e.started_at,
  greatest(
    coalesce(
      e.ended_at,
      e.updated_at,
      e.started_at+make_interval(secs=>greatest(coalesce(e.elapsed_seconds,0),60))
    ),
    e.started_at+interval '1 minute'
  ),
  case when e.status in('PAUSED','WAITING_EVIDENCE','IN_PROGRESS','COMPLETED') then e.started_at end,
  case when e.status='COMPLETED' then coalesce(e.ended_at,e.updated_at,e.started_at) end,
  case when e.status='PAUSED' then 'PAUSED_LEGACY' end,
  e.result_note,
  1,
  coalesce(e.metadata,'{}'::jsonb) || jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyExecutionId',e.id,
    'legacyExecutionStatus',e.status,
    'legacyExecutionSource',e.source,
    'elapsedSeconds',e.elapsed_seconds,
    'activeSeconds',e.active_seconds,
    'businessSeconds',e.business_seconds,
    'pausedSeconds',e.paused_seconds,
    'startDelaySeconds',e.start_delay_seconds,
    'deviationRatio',e.deviation_ratio,
    'deviationReason',e.deviation_reason
  ),
  e.created_at,
  e.updated_at,
  case when e.status='CANCELLED' then coalesce(e.ended_at,e.updated_at,e.started_at) end
from migration_legacy.work_executions e
join migration_legacy.work_activity_catalog sc on sc.id=e.catalog_id
join migration_legacy.organizations so on so.id=e.organization_id
join erp_supply.organizations o on o.code=so.code
join erp_supply.workforce_activity_catalog tc on tc.organization_id=o.id and tc.code=sc.code
where e.assignment_id is null
on conflict(id) do update set
  catalog_id=excluded.catalog_id,
  assignee_profile_id=excluded.assignee_profile_id,
  title=excluded.title,
  description=excluded.description,
  status=excluded.status,
  planned_start=excluded.planned_start,
  planned_end=excluded.planned_end,
  actual_start=excluded.actual_start,
  actual_end=excluded.actual_end,
  block_reason=excluded.block_reason,
  result_note=excluded.result_note,
  metadata=excluded.metadata,
  updated_at=excluded.updated_at,
  cancelled_at=excluded.cancelled_at;

insert into erp_supply.workforce_activity_events(
  organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
  idempotency_key,payload,created_at
)
select
  o.id,
  coalesce(e.assignment_member_id,e.id),
  e.profile_id,
  'LEGACY_EXECUTION_IMPORTED',
  null,
  case e.status
    when 'PAUSED' then 'BLOCKED'
    when 'WAITING_EVIDENCE' then 'IN_PROGRESS'
    when 'IN_PROGRESS' then 'IN_PROGRESS'
    when 'COMPLETED' then 'COMPLETED'
    when 'CANCELLED' then 'CANCELLED'
  end,
  'legacy-execution:'||e.id::text,
  jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyExecutionId',e.id,
    'legacyAssignmentId',e.assignment_id,
    'legacyAssignmentMemberId',e.assignment_member_id,
    'legacyStatus',e.status,
    'legacySource',e.source,
    'startedAt',e.started_at,
    'endedAt',e.ended_at,
    'elapsedSeconds',e.elapsed_seconds,
    'activeSeconds',e.active_seconds,
    'businessSeconds',e.business_seconds,
    'pausedSeconds',e.paused_seconds,
    'startDelaySeconds',e.start_delay_seconds,
    'deviationRatio',e.deviation_ratio,
    'deviationReason',e.deviation_reason,
    'resultNote',e.result_note
  ),
  e.created_at
from migration_legacy.work_executions e
join migration_legacy.organizations so on so.id=e.organization_id
join erp_supply.organizations o on o.code=so.code
join erp_supply.workforce_activities a on a.id=coalesce(e.assignment_member_id,e.id)
on conflict(organization_id,idempotency_key) where idempotency_key is not null do nothing;

insert into erp_supply.workforce_activity_evidence(
  id,organization_id,activity_id,evidence_type,storage_provider,storage_reference,
  file_name,mime_type,size_bytes,captured_at,uploaded_by,metadata,created_at
)
select
  ev.id,
  o.id,
  coalesce(e.assignment_member_id,e.id),
  ev.evidence_type,
  case when ev.drive_file_id is not null then 'GOOGLE_DRIVE' else 'EXTERNAL' end,
  coalesce(ev.web_view_link,ev.drive_file_id,ev.external_value,'legacy-evidence:'||ev.id::text),
  ev.file_name,
  ev.mime_type,
  ev.size_bytes,
  ev.created_at,
  ev.profile_id,
  coalesce(ev.metadata,'{}'::jsonb) || jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyExecutionId',ev.execution_id,
    'legacyDriveFileId',ev.drive_file_id,
    'legacyExternalValue',ev.external_value,
    'legacyNote',ev.note
  ),
  ev.created_at
from migration_legacy.work_evidence ev
join migration_legacy.work_executions e on e.id=ev.execution_id
join migration_legacy.organizations so on so.id=ev.organization_id
join erp_supply.organizations o on o.code=so.code
join erp_supply.workforce_activities a on a.id=coalesce(e.assignment_member_id,e.id)
on conflict(id) do update set
  activity_id=excluded.activity_id,
  evidence_type=excluded.evidence_type,
  storage_provider=excluded.storage_provider,
  storage_reference=excluded.storage_reference,
  file_name=excluded.file_name,
  mime_type=excluded.mime_type,
  size_bytes=excluded.size_bytes,
  captured_at=excluded.captured_at,
  uploaded_by=excluded.uploaded_by,
  metadata=excluded.metadata;

with audit_cutoff as (
  select max(created_at)-interval '30 days' recent_from
  from migration_legacy.system_audit
),
primary_org as (
  select id,code from migration_legacy.organizations order by created_at,id limit 1
)
insert into erp_supply.audit_events(
  organization_id,actor_profile_id,actor_kind,module_code,action,resource_type,
  resource_id,result,request_id,metadata,created_at
)
select
  target_org.id,
  a.actor_profile_id,
  case when a.actor_profile_id is null then 'SYSTEM' else 'USER' end,
  lower(coalesce(nullif(a.entity_type,''),'legacy')),
  upper(a.action),
  lower(coalesce(nullif(a.entity_type,''),'legacy')),
  a.entity_id,
  'SUCCESS',
  'legacy-audit:'||a.id::text,
  jsonb_build_object(
    'migrationSource','CRM-SUMINISTROS',
    'legacyAuditId',a.id,
    'legacyOrganizationMissing',a.organization_id is null,
    'legacyBefore',
      case when coalesce(a.before_data,'null'::jsonb)::text ~*
        '"(password|passwd|token|access_token|refresh_token|service_role|authorization|jwt|secret)"[[:space:]]*:'
        then null else a.before_data end,
    'legacyAfter',
      case when coalesce(a.after_data,'null'::jsonb)::text ~*
        '"(password|passwd|token|access_token|refresh_token|service_role|authorization|jwt|secret)"[[:space:]]*:'
        then null else a.after_data end,
    'legacyPayloadRedacted',
      (
        coalesce(a.metadata,'{}'::jsonb) ||
        jsonb_build_object('beforeData',a.before_data,'afterData',a.after_data)
      )::text ~*
        '"(password|passwd|token|access_token|refresh_token|service_role|authorization|jwt|secret)"[[:space:]]*:'
  ),
  a.created_at
from migration_legacy.system_audit a
cross join audit_cutoff c
cross join primary_org po
left join migration_legacy.organizations so on so.id=a.organization_id
join erp_supply.organizations target_org on target_org.code=coalesce(so.code,po.code)
where (
    a.created_at>=c.recent_from
    or left(upper(a.action),5)='AUTH_'
    or left(upper(a.action),6)='ADMIN_'
    or left(upper(a.action),9)='APPROVAL_'
  )
  and not exists(
    select 1 from erp_supply.audit_events x
    where x.request_id='legacy-audit:'||a.id::text
  );
