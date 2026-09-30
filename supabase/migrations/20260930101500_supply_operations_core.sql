begin;

create table erp_supply.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  tax_id text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code),
  check (btrim(code) <> ''),
  check (btrim(name) <> '')
);

create table erp_supply.supply_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  operation_key text not null,
  operation_type text not null,
  actor_profile_id uuid not null references erp_supply.profiles(id),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id,operation_key),
  check (btrim(operation_key) <> ''),
  check (btrim(operation_type) <> '')
);

create table erp_supply.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  requested_by uuid not null references erp_supply.profiles(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id,order_id)
);

create table erp_supply.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references erp_supply.purchase_requests(id) on delete cascade,
  order_item_id uuid not null references erp_supply.order_items(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity > 0),
  unit text not null check (btrim(unit) <> ''),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  unique (request_id,order_item_id)
);

create table erp_supply.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  request_id uuid not null references erp_supply.purchase_requests(id) on delete restrict,
  supplier_id uuid not null references erp_supply.suppliers(id) on delete restrict,
  external_reference text,
  status text not null default 'ORDERED'
    check (status in ('ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  issued_by uuid not null references erp_supply.profiles(id),
  issued_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table erp_supply.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references erp_supply.purchase_orders(id) on delete cascade,
  request_line_id uuid not null references erp_supply.purchase_request_lines(id) on delete restrict,
  ordered_quantity numeric(18,4) not null check (ordered_quantity > 0),
  received_quantity numeric(18,4) not null default 0 check (received_quantity >= 0),
  unit text not null check (btrim(unit) <> ''),
  unit_price numeric(18,2) check (unit_price is null or unit_price >= 0),
  metadata jsonb not null default '{}'::jsonb,
  unique (purchase_order_id,request_line_id),
  check (received_quantity <= ordered_quantity)
);

create table erp_supply.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  purchase_order_id uuid references erp_supply.purchase_orders(id) on delete restrict,
  order_id uuid references erp_supply.orders(id) on delete set null,
  receipt_type text not null default 'PURCHASE'
    check (receipt_type in ('PURCHASE','RETURN','STANDALONE')),
  document_reference text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PARTIALLY_RECEIVED','COMPLETED','CANCELLED')),
  received_by uuid not null references erp_supply.profiles(id),
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table erp_supply.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references erp_supply.goods_receipts(id) on delete cascade,
  purchase_order_line_id uuid references erp_supply.purchase_order_lines(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  location_id uuid not null references erp_supply.inventory_locations(id) on delete restrict,
  expected_quantity numeric(18,4) check (expected_quantity is null or expected_quantity >= 0),
  accepted_quantity numeric(18,4) not null default 0 check (accepted_quantity >= 0),
  rejected_quantity numeric(18,4) not null default 0 check (rejected_quantity >= 0),
  unit text not null check (btrim(unit) <> ''),
  incident_code text check (
    incident_code is null or incident_code in
      ('SHORTAGE','SURPLUS','DAMAGED','WRONG_REFERENCE','WRONG_QUANTITY','OTHER')
  ),
  note text,
  inventory_movement_id uuid references erp_supply.inventory_movements(id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING','ACCEPTED','PARTIAL','REJECTED')),
  metadata jsonb not null default '{}'::jsonb,
  check (accepted_quantity > 0 or rejected_quantity > 0)
);

create table erp_supply.picking_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  order_task_id uuid references erp_supply.order_tasks(id) on delete set null,
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','PARTIAL','COMPLETED','CANCELLED')),
  assigned_profile_id uuid references erp_supply.profiles(id),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id,order_id,order_task_id)
);

create table erp_supply.picking_job_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references erp_supply.picking_jobs(id) on delete cascade,
  order_item_id uuid not null references erp_supply.order_items(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  requested_quantity numeric(18,4) not null check (requested_quantity > 0),
  picked_quantity numeric(18,4) not null default 0 check (picked_quantity >= 0),
  unit text not null check (btrim(unit) <> ''),
  reservation_id uuid references erp_supply.inventory_reservations(id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING','RESERVED','PARTIAL','COMPLETED','CANCELLED')),
  metadata jsonb not null default '{}'::jsonb,
  unique (job_id,order_item_id),
  check (picked_quantity <= requested_quantity)
);

create table erp_supply.cutting_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  order_task_id uuid references erp_supply.order_tasks(id) on delete set null,
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','PAUSED','WAITING_EVIDENCE','COMPLETED','CANCELLED')),
  assigned_profile_id uuid references erp_supply.profiles(id),
  started_by uuid references erp_supply.profiles(id),
  completed_by uuid references erp_supply.profiles(id),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  evidence_id uuid references erp_supply.order_evidence(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id,order_id,order_task_id)
);

create table erp_supply.cutting_job_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references erp_supply.cutting_jobs(id) on delete cascade,
  order_item_id uuid not null references erp_supply.order_items(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  reservation_id uuid not null references erp_supply.inventory_reservations(id) on delete restrict,
  planned_quantity numeric(18,4) not null check (planned_quantity > 0),
  cut_length_each numeric(18,4) check (cut_length_each is null or cut_length_each > 0),
  consumed_quantity numeric(18,4) not null default 0 check (consumed_quantity >= 0),
  reusable_quantity numeric(18,4) not null default 0 check (reusable_quantity >= 0),
  waste_quantity numeric(18,4) not null default 0 check (waste_quantity >= 0),
  unit text not null check (btrim(unit) <> ''),
  status text not null default 'PENDING'
    check (status in ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
  metadata jsonb not null default '{}'::jsonb,
  unique (job_id,order_item_id),
  check (consumed_quantity + reusable_quantity + waste_quantity <= planned_quantity)
);

create table erp_supply.supply_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid references erp_supply.orders(id) on delete set null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  actor_profile_id uuid not null references erp_supply.profiles(id),
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (btrim(aggregate_type) <> ''),
  check (btrim(event_type) <> '')
);

create unique index uq_supply_event_idempotency
  on erp_supply.supply_events(organization_id,idempotency_key)
  where idempotency_key is not null;
create index idx_supply_requests_queue
  on erp_supply.purchase_requests(organization_id,status,requested_at desc);
create index idx_supply_purchase_orders_queue
  on erp_supply.purchase_orders(organization_id,status,issued_at desc);
create index idx_supply_receipts_queue
  on erp_supply.goods_receipts(organization_id,status,received_at desc);
create index idx_supply_picking_queue
  on erp_supply.picking_jobs(organization_id,status,created_at desc);
create index idx_supply_cutting_queue
  on erp_supply.cutting_jobs(organization_id,status,created_at desc);
create unique index uq_active_picking_order
  on erp_supply.picking_jobs(organization_id,order_id)
  where status in ('OPEN','IN_PROGRESS','PARTIAL');
create unique index uq_active_cutting_order
  on erp_supply.cutting_jobs(organization_id,order_id)
  where status in ('OPEN','IN_PROGRESS','PAUSED','WAITING_EVIDENCE');

alter table erp_supply.suppliers enable row level security;
alter table erp_supply.supply_operations enable row level security;
alter table erp_supply.purchase_requests enable row level security;
alter table erp_supply.purchase_request_lines enable row level security;
alter table erp_supply.purchase_orders enable row level security;
alter table erp_supply.purchase_order_lines enable row level security;
alter table erp_supply.goods_receipts enable row level security;
alter table erp_supply.goods_receipt_lines enable row level security;
alter table erp_supply.picking_jobs enable row level security;
alter table erp_supply.picking_job_lines enable row level security;
alter table erp_supply.cutting_jobs enable row level security;
alter table erp_supply.cutting_job_lines enable row level security;
alter table erp_supply.supply_events enable row level security;

create policy suppliers_read on erp_supply.suppliers for select to authenticated
using (organization_id=erp_private.current_org_id() and erp_private.can_access_module('purchasing','read'));
create policy purchase_requests_read on erp_supply.purchase_requests for select to authenticated
using (organization_id=erp_private.current_org_id() and erp_private.can_access_module('purchasing','read'));
create policy purchase_request_lines_read on erp_supply.purchase_request_lines for select to authenticated
using (exists(select 1 from erp_supply.purchase_requests r where r.id=request_id and r.organization_id=erp_private.current_org_id() and erp_private.can_access_module('purchasing','read')));
create policy purchase_orders_read on erp_supply.purchase_orders for select to authenticated
using (organization_id=erp_private.current_org_id() and erp_private.can_access_module('purchasing','read'));
create policy purchase_order_lines_read on erp_supply.purchase_order_lines for select to authenticated
using (exists(select 1 from erp_supply.purchase_orders p where p.id=purchase_order_id and p.organization_id=erp_private.current_org_id() and erp_private.can_access_module('purchasing','read')));
create policy receipts_read on erp_supply.goods_receipts for select to authenticated
using (organization_id=erp_private.current_org_id() and erp_private.can_access_module('receiving','read'));
create policy receipt_lines_read on erp_supply.goods_receipt_lines for select to authenticated
using (exists(select 1 from erp_supply.goods_receipts r where r.id=receipt_id and r.organization_id=erp_private.current_org_id() and erp_private.can_access_module('receiving','read')));
create policy picking_jobs_read on erp_supply.picking_jobs for select to authenticated
using (organization_id=erp_private.current_org_id() and erp_private.can_access_module('picking','read'));
create policy picking_lines_read on erp_supply.picking_job_lines for select to authenticated
using (exists(select 1 from erp_supply.picking_jobs j where j.id=job_id and j.organization_id=erp_private.current_org_id() and erp_private.can_access_module('picking','read')));
create policy cutting_jobs_read on erp_supply.cutting_jobs for select to authenticated
using (organization_id=erp_private.current_org_id() and erp_private.can_access_module('cutting','read'));
create policy cutting_lines_read on erp_supply.cutting_job_lines for select to authenticated
using (exists(select 1 from erp_supply.cutting_jobs j where j.id=job_id and j.organization_id=erp_private.current_org_id() and erp_private.can_access_module('cutting','read')));
create policy supply_events_read on erp_supply.supply_events for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('purchasing','read')
    or erp_private.can_access_module('receiving','read')
    or erp_private.can_access_module('picking','read')
    or erp_private.can_access_module('cutting','read')
    or erp_private.can_access_module('audit','read')
  )
);

grant select on erp_supply.suppliers,erp_supply.purchase_requests,erp_supply.purchase_request_lines,
  erp_supply.purchase_orders,erp_supply.purchase_order_lines,erp_supply.goods_receipts,
  erp_supply.goods_receipt_lines,erp_supply.picking_jobs,erp_supply.picking_job_lines,
  erp_supply.cutting_jobs,erp_supply.cutting_job_lines,erp_supply.supply_events to authenticated;

commit;
