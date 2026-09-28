begin;

create table erp_supply.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_number text not null,
  external_reference text,
  order_type_code text not null references erp_supply.order_types(code),
  payment_condition_code text not null references erp_supply.payment_conditions(code),
  delivery_route_code text not null references erp_supply.delivery_routes(code),
  client_name text not null,
  client_document text,
  client_city text,
  client_address text,
  client_phone text,
  seller_profile_id uuid not null references erp_supply.profiles(id),
  current_step_code text not null references erp_supply.workflow_steps(code),
  status text not null check (
    status in ('DRAFT','QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED','PENDING_APPROVAL','CLOSED','CANCELLED')
  ),
  priority text not null default 'MEDIUM' check (
    priority in ('LOW','MEDIUM','HIGH','URGENT','CRITICAL')
  ),
  requires_cut boolean not null default false,
  requires_purchase boolean not null default false,
  current_assignee_id uuid references erp_supply.profiles(id),
  current_role_code text references erp_supply.roles(code),
  promised_at timestamptz,
  requested_delivery_date date,
  source text not null default 'ERP' check (source in ('ERP','CSV_HISTORY','API','QA_BOT')),
  is_history boolean not null default false,
  is_test boolean not null default false,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  cancelled_at timestamptz,
  unique (organization_id, order_number)
);

create table erp_supply.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  sku text,
  reference text,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(18,4) not null check (quantity > 0),
  unit text not null default 'UND',
  warehouse_location text,
  requires_cut boolean not null default false,
  requested_cut_length numeric(18,4),
  dimensions jsonb not null default '{}'::jsonb,
  item_status text not null default 'PENDING',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, line_number),
  check (not requires_cut or requested_cut_length > 0)
);

create table erp_supply.order_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  step_code text not null references erp_supply.workflow_steps(code),
  sequence_no integer not null check (sequence_no > 0),
  queue_code text not null,
  status text not null check (
    status in ('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED','COMPLETED','CANCELLED')
  ),
  assigned_profile_id uuid references erp_supply.profiles(id),
  assigned_role_code text references erp_supply.roles(code),
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  blocked_at timestamptz,
  raw_seconds bigint not null default 0 check (raw_seconds >= 0),
  business_seconds bigint not null default 0 check (business_seconds >= 0),
  result_code text,
  result_detail text,
  metadata jsonb not null default '{}'::jsonb,
  unique (order_id, sequence_no)
);

create table erp_supply.order_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  task_id uuid references erp_supply.order_tasks(id) on delete set null,
  event_type text not null,
  action_code text,
  from_step_code text,
  to_step_code text,
  from_status text,
  to_status text,
  actor_profile_id uuid references erp_supply.profiles(id),
  actor_role_code text,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_orders_queue
on erp_supply.orders (organization_id, current_step_code, status, priority, updated_at desc);

create index idx_orders_search
on erp_supply.orders (organization_id, lower(order_number), lower(client_name));

create index idx_orders_assignee
on erp_supply.orders (organization_id, current_assignee_id, status);

create index idx_orders_created
on erp_supply.orders (organization_id, created_at desc);

create unique index uq_active_task_per_order
on erp_supply.order_tasks(order_id)
where status in ('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED');

create index idx_tasks_queue
on erp_supply.order_tasks(queue_code, status, assigned_profile_id, created_at);

create unique index uq_event_idempotency
on erp_supply.order_events(organization_id, idempotency_key)
where idempotency_key is not null;

create index idx_events_order_time
on erp_supply.order_events(order_id, created_at);

alter table erp_supply.orders enable row level security;
alter table erp_supply.order_items enable row level security;
alter table erp_supply.order_tasks enable row level security;
alter table erp_supply.order_events enable row level security;

create policy orders_read_own_org
on erp_supply.orders for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('orders','read')
);

create policy orders_insert_authorized
on erp_supply.orders for insert
to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and seller_profile_id = erp_private.current_profile_id()
  and (
    erp_private.can_access_module('orders','create')
    or erp_private.can_access_module('sales','create')
  )
);

create policy orders_update_authorized
on erp_supply.orders for update
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('orders','update')
)
with check (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('orders','update')
);

create policy order_items_read_visible_order
on erp_supply.order_items for select
to authenticated
using (
  exists (
    select 1
    from erp_supply.orders o
    where o.id = order_items.order_id
  )
);

create policy order_items_insert_visible_order
on erp_supply.order_items for insert
to authenticated
with check (
  exists (
    select 1
    from erp_supply.orders o
    where o.id = order_items.order_id
      and (
        erp_private.can_access_module('orders','create')
        or erp_private.can_access_module('sales','create')
      )
  )
);

create policy order_tasks_read_visible_order
on erp_supply.order_tasks for select
to authenticated
using (
  exists (
    select 1 from erp_supply.orders o where o.id = order_tasks.order_id
  )
);

create policy order_tasks_insert_authorized
on erp_supply.order_tasks for insert
to authenticated
with check (
  exists (
    select 1
    from erp_supply.orders o
    where o.id = order_tasks.order_id
      and (
        erp_private.can_access_module('orders','create')
        or erp_private.can_access_module('orders','update')
        or erp_private.can_access_module('sales','create')
      )
  )
);

create policy order_events_read_visible_order
on erp_supply.order_events for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and exists (
    select 1 from erp_supply.orders o where o.id = order_events.order_id
  )
);

create policy order_events_insert_actor
on erp_supply.order_events for insert
to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and actor_profile_id = erp_private.current_profile_id()
  and exists (
    select 1 from erp_supply.orders o where o.id = order_events.order_id
  )
);

grant select, insert, update on erp_supply.orders to authenticated;
grant select, insert on erp_supply.order_items to authenticated;
grant select, insert on erp_supply.order_tasks to authenticated;
grant select, insert on erp_supply.order_events to authenticated;
grant usage, select on sequence erp_supply.order_events_id_seq to authenticated;

commit;
