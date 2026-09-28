begin;

create table erp_supply.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  from_step_code text not null references erp_supply.workflow_steps(code),
  action_code text not null default 'COMPLETE',
  to_step_code text not null references erp_supply.workflow_steps(code),
  order_type_code text references erp_supply.order_types(code),
  payment_condition_code text references erp_supply.payment_conditions(code),
  delivery_route_code text references erp_supply.delivery_routes(code),
  requires_cut boolean,
  requires_purchase boolean,
  approval_contract_code text,
  priority integer not null default 100,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(trim(action_code)) > 0)
);

create unique index uq_workflow_transition_rule
on erp_supply.workflow_transitions(
  from_step_code,
  action_code,
  coalesce(order_type_code,'*'),
  coalesce(payment_condition_code,'*'),
  coalesce(delivery_route_code,'*'),
  coalesce(requires_cut::text,'*'),
  coalesce(requires_purchase::text,'*'),
  priority
);

create index idx_workflow_transition_lookup
on erp_supply.workflow_transitions(from_step_code,action_code,active,priority);

create table erp_supply.order_block_reasons (
  code text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 100
);

create table erp_supply.order_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  task_id uuid not null references erp_supply.order_tasks(id) on delete cascade,
  reason_code text not null references erp_supply.order_block_reasons(code),
  detail text,
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  blocked_by uuid not null references erp_supply.profiles(id),
  blocked_at timestamptz not null default now(),
  resolved_by uuid references erp_supply.profiles(id),
  resolved_at timestamptz,
  resolution text,
  metadata jsonb not null default '{}'::jsonb,
  check ((status='OPEN' and resolved_at is null and resolved_by is null)
      or (status='RESOLVED' and resolved_at is not null and resolved_by is not null)),
  check (resolved_at is null or resolved_at >= blocked_at)
);

create unique index uq_open_block_per_task
on erp_supply.order_blocks(task_id)
where status='OPEN';

create index idx_order_blocks_order_status
on erp_supply.order_blocks(organization_id,order_id,status,blocked_at desc);

create table erp_supply.order_issue_types (
  code text primary key,
  name text not null,
  default_severity text not null default 'MEDIUM'
    check (default_severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  default_blocking boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100
);

create table erp_supply.order_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  task_id uuid references erp_supply.order_tasks(id) on delete set null,
  issue_type_code text not null references erp_supply.order_issue_types(code),
  severity text not null check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  blocking boolean not null default false,
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','CANCELLED')),
  responsible_profile_id uuid references erp_supply.profiles(id),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  resolved_by uuid references erp_supply.profiles(id),
  resolved_at timestamptz,
  resolution text,
  metadata jsonb not null default '{}'::jsonb,
  check (resolved_at is null or resolved_at >= created_at)
);

create index idx_order_issues_order_status
on erp_supply.order_issues(organization_id,order_id,status,blocking,created_at desc);

create table erp_supply.order_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  task_id uuid references erp_supply.order_tasks(id) on delete cascade,
  evidence_type text not null,
  storage_provider text not null default 'EXTERNAL',
  storage_reference text not null,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 15728640),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (length(trim(evidence_type)) > 0),
  check (length(trim(storage_reference)) > 0)
);

create index idx_order_evidence_task
on erp_supply.order_evidence(organization_id,order_id,task_id,created_at desc);

create table erp_supply.workflow_step_requirements (
  step_code text not null references erp_supply.workflow_steps(code) on delete cascade,
  requirement_code text not null,
  requirement_type text not null check (requirement_type in ('EVIDENCE','APPROVAL_CONTRACT')),
  evidence_type text,
  approval_contract_code text,
  required_count integer not null default 1 check (required_count > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  primary key (step_code,requirement_code),
  check (
    (requirement_type='EVIDENCE' and evidence_type is not null and approval_contract_code is null)
    or
    (requirement_type='APPROVAL_CONTRACT' and approval_contract_code is not null and evidence_type is null)
  )
);

create table erp_supply.order_action_authorities (
  action_code text not null,
  role_code text not null references erp_supply.roles(code) on delete cascade,
  active boolean not null default true,
  primary key (action_code,role_code)
);

create table erp_supply.task_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  task_id uuid not null references erp_supply.order_tasks(id) on delete cascade,
  profile_id uuid not null references erp_supply.profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  raw_seconds bigint not null default 0 check (raw_seconds >= 0),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  check (ended_at is null or ended_at >= started_at)
);

create unique index uq_open_session_per_task
on erp_supply.task_sessions(task_id)
where ended_at is null;

create index idx_task_sessions_profile_time
on erp_supply.task_sessions(profile_id,started_at desc);

alter table erp_supply.workflow_transitions enable row level security;
alter table erp_supply.order_block_reasons enable row level security;
alter table erp_supply.order_blocks enable row level security;
alter table erp_supply.order_issue_types enable row level security;
alter table erp_supply.order_issues enable row level security;
alter table erp_supply.order_evidence enable row level security;
alter table erp_supply.workflow_step_requirements enable row level security;
alter table erp_supply.order_action_authorities enable row level security;
alter table erp_supply.task_sessions enable row level security;

create policy workflow_transitions_read on erp_supply.workflow_transitions
for select to authenticated using (active);

create policy block_reasons_read on erp_supply.order_block_reasons
for select to authenticated using (active);

create policy issue_types_read on erp_supply.order_issue_types
for select to authenticated using (active);

create policy step_requirements_read on erp_supply.workflow_step_requirements
for select to authenticated using (active);

create policy action_authorities_read on erp_supply.order_action_authorities
for select to authenticated
using (role_code = any(erp_private.current_roles()));

create policy blocks_read_own_org on erp_supply.order_blocks
for select to authenticated using (organization_id=erp_private.current_org_id());

create policy blocks_insert_own_org on erp_supply.order_blocks
for insert to authenticated with check (
  organization_id=erp_private.current_org_id()
  and blocked_by=erp_private.current_profile_id()
);

create policy blocks_update_own_org on erp_supply.order_blocks
for update to authenticated
using (organization_id=erp_private.current_org_id())
with check (organization_id=erp_private.current_org_id());

create policy issues_read_own_org on erp_supply.order_issues
for select to authenticated using (organization_id=erp_private.current_org_id());

create policy issues_insert_own_org on erp_supply.order_issues
for insert to authenticated with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
);

create policy issues_update_own_org on erp_supply.order_issues
for update to authenticated
using (organization_id=erp_private.current_org_id())
with check (organization_id=erp_private.current_org_id());

create policy evidence_read_own_org on erp_supply.order_evidence
for select to authenticated using (organization_id=erp_private.current_org_id());

create policy evidence_insert_own_org on erp_supply.order_evidence
for insert to authenticated with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
);

create policy sessions_read_own_org on erp_supply.task_sessions
for select to authenticated using (organization_id=erp_private.current_org_id());

create policy sessions_insert_own_org on erp_supply.task_sessions
for insert to authenticated with check (
  organization_id=erp_private.current_org_id()
  and profile_id=erp_private.current_profile_id()
);

create policy sessions_update_own_org on erp_supply.task_sessions
for update to authenticated
using (organization_id=erp_private.current_org_id())
with check (organization_id=erp_private.current_org_id());

create policy task_update_own_org on erp_supply.order_tasks
for update to authenticated
using (
  exists (
    select 1 from erp_supply.orders o
    where o.id=order_tasks.order_id
      and o.organization_id=erp_private.current_org_id()
  )
)
with check (
  exists (
    select 1 from erp_supply.orders o
    where o.id=order_tasks.order_id
      and o.organization_id=erp_private.current_org_id()
  )
);

grant select on erp_supply.workflow_transitions to authenticated;
grant select on erp_supply.order_block_reasons to authenticated;
grant select,insert,update on erp_supply.order_blocks to authenticated;
grant select on erp_supply.order_issue_types to authenticated;
grant select,insert,update on erp_supply.order_issues to authenticated;
grant select,insert on erp_supply.order_evidence to authenticated;
grant select on erp_supply.workflow_step_requirements to authenticated;
grant select on erp_supply.order_action_authorities to authenticated;
grant select,insert,update on erp_supply.task_sessions to authenticated;
grant update on erp_supply.order_tasks to authenticated;

commit;
