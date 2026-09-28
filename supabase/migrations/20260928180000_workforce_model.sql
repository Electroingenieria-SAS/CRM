begin;

create extension if not exists btree_gist with schema extensions;

insert into erp_supply.modules(code,name,description,icon,sort_order,active)
values(
  'workforce',
  'Jornada y actividades',
  'Planificación, ejecución, evidencias, ocupación y cronograma de trabajo',
  'timer',
  135,
  true
)
on conflict(code) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  active=true;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select
  r.code,
  'workforce',
  true,
  true,
  true,
  r.code in ('super_admin','gerencia','jefe_logistica','lider_logistica'),
  r.code in ('super_admin','gerencia','jefe_logistica','lider_logistica')
from erp_supply.roles r
where r.active
on conflict(role_code,module_code) do update set
  can_read=true,
  can_create=true,
  can_update=true,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

create table erp_supply.workforce_activity_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  category_code text not null,
  category_label text not null,
  subcategory text not null,
  activity_group text not null default 'GENERAL'
    check(activity_group in('LOGISTICS','COMMERCIAL','FINANCE','PURCHASING','MANAGEMENT','GENERAL','IMPROVEMENT')),
  activity_kind text not null default 'ACTIVITY'
    check(activity_kind in('ACTIVITY','DELIVERABLE')),
  standard_minutes integer check(standard_minutes is null or standard_minutes > 0),
  evidence_policy text not null default 'FINAL_PHOTO'
    check(evidence_policy in('NONE','FINAL_PHOTO','BEFORE_AFTER','FILE','LINK','ERP_REFERENCE')),
  team_allowed boolean not null default false,
  allowed_roles text[] not null default '{}'::text[],
  active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code),
  check(length(trim(code)) > 0),
  check(length(trim(name)) > 0),
  check(length(trim(category_code)) > 0),
  check(length(trim(category_label)) > 0),
  check(length(trim(subcategory)) > 0)
);

create table erp_supply.workforce_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  catalog_id uuid not null references erp_supply.workforce_activity_catalog(id),
  assignee_profile_id uuid not null references erp_supply.profiles(id),
  created_by uuid not null references erp_supply.profiles(id),
  assigned_by uuid not null references erp_supply.profiles(id),
  title text not null,
  description text,
  status text not null default 'PLANNED'
    check(status in('PLANNED','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED')),
  source text not null default 'MANUAL'
    check(source in('MANUAL','PLANNED','ORDER_EVENT')),
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  actual_start timestamptz,
  actual_end timestamptz,
  order_id uuid references erp_supply.orders(id) on delete set null,
  order_task_id uuid references erp_supply.order_tasks(id) on delete set null,
  block_reason text,
  result_note text,
  version integer not null default 1 check(version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique(id,organization_id),
  check(length(trim(title)) > 0),
  check(planned_end > planned_start),
  check(actual_end is null or actual_start is not null),
  check(actual_end is null or actual_end >= actual_start),
  check((status <> 'IN_PROGRESS') or actual_start is not null),
  check((status <> 'BLOCKED') or actual_start is not null),
  check((status <> 'COMPLETED') or actual_end is not null),
  check((status <> 'CANCELLED') or cancelled_at is not null),
  check(order_task_id is null or order_id is not null)
);

alter table erp_supply.workforce_activities
  add constraint workforce_no_overlapping_plans
  exclude using gist (
    organization_id with =,
    assignee_profile_id with =,
    tstzrange(planned_start,planned_end,'[)') with &&
  )
  where (status in ('PLANNED','IN_PROGRESS','BLOCKED'));

create table erp_supply.workforce_activity_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  activity_id uuid not null references erp_supply.workforce_activities(id) on delete cascade,
  evidence_type text not null
    check(evidence_type in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO','FILE','LINK','ERP_REFERENCE')),
  storage_provider text not null default 'EXTERNAL',
  storage_reference text not null,
  file_name text,
  mime_type text,
  size_bytes bigint check(size_bytes is null or size_bytes between 1 and 15728640),
  captured_at timestamptz,
  uploaded_by uuid not null references erp_supply.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(length(trim(storage_provider)) > 0),
  check(length(trim(storage_reference)) > 0)
);

create table erp_supply.workforce_activity_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id),
  activity_id uuid not null references erp_supply.workforce_activities(id) on delete cascade,
  actor_profile_id uuid not null references erp_supply.profiles(id),
  event_type text not null,
  from_status text,
  to_status text,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(length(trim(event_type)) > 0)
);

create unique index uq_workforce_event_idempotency
on erp_supply.workforce_activity_events(organization_id,idempotency_key)
where idempotency_key is not null;

create table erp_supply.workforce_profile_policies (
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  profile_id uuid primary key references erp_supply.profiles(id) on delete cascade,
  exclude_from_occupancy_metrics boolean not null default false,
  exclude_from_time_metrics boolean not null default false,
  special_treatment_label text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references erp_supply.profiles(id),
  updated_at timestamptz not null default now()
);

create table erp_supply.workforce_schedule_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  iso_weekday smallint not null check(iso_weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id,iso_weekday,start_time,end_time),
  check(end_time > start_time)
);

create table erp_supply.workforce_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  legal_basis text,
  source_url text,
  source_kind text not null default 'NATIONAL'
    check(source_kind in('NATIONAL','LOCAL','COMPANY')),
  created_at timestamptz not null default now(),
  unique(organization_id,holiday_date),
  check(length(trim(name)) > 0)
);

create index idx_workforce_activity_schedule
on erp_supply.workforce_activities(
  organization_id,assignee_profile_id,planned_start,planned_end,status
);

create index idx_workforce_activity_range
on erp_supply.workforce_activities(organization_id,planned_start,planned_end);

create index idx_workforce_activity_order
on erp_supply.workforce_activities(organization_id,order_id,order_task_id)
where order_id is not null;

create index idx_workforce_activity_events_timeline
on erp_supply.workforce_activity_events(organization_id,activity_id,created_at);

create index idx_workforce_evidence_activity
on erp_supply.workforce_activity_evidence(organization_id,activity_id,created_at);

create index idx_workforce_holidays_date
on erp_supply.workforce_holidays(organization_id,holiday_date);

alter table erp_supply.workforce_activity_catalog enable row level security;
alter table erp_supply.workforce_activities enable row level security;
alter table erp_supply.workforce_activity_evidence enable row level security;
alter table erp_supply.workforce_activity_events enable row level security;
alter table erp_supply.workforce_profile_policies enable row level security;
alter table erp_supply.workforce_schedule_segments enable row level security;
alter table erp_supply.workforce_holidays enable row level security;

commit;
