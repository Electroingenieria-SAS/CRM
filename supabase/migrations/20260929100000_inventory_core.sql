begin;

create table erp_supply.material_master (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  reference text not null,
  name text not null,
  unit text not null,
  attributes jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_master_reference_not_blank check (btrim(reference) <> ''),
  constraint material_master_name_not_blank check (btrim(name) <> ''),
  constraint material_master_unit_not_blank check (btrim(unit) <> ''),
  constraint material_master_org_reference unique (organization_id, reference)
);

create table erp_supply.material_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  code text not null,
  label text not null,
  attributes jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_variants_code_not_blank check (btrim(code) <> ''),
  constraint material_variants_label_not_blank check (btrim(label) <> ''),
  constraint material_variants_identity unique (organization_id, material_id, code)
);

create table erp_supply.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  location_type text not null default 'WAREHOUSE'
    check (location_type in ('WAREHOUSE','ZONE','SHELF','AREA')),
  parent_id uuid references erp_supply.inventory_locations(id) on delete restrict,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_locations_code_not_blank check (btrim(code) <> ''),
  constraint inventory_locations_name_not_blank check (btrim(name) <> ''),
  constraint inventory_locations_identity unique (organization_id, code)
);

create table erp_supply.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  location_id uuid not null references erp_supply.inventory_locations(id) on delete restrict,
  on_hand numeric(18,4) not null default 0,
  reserved numeric(18,4) not null default 0,
  committed numeric(18,4) not null default 0,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint inventory_balances_nonnegative
    check (on_hand >= 0 and reserved >= 0 and committed >= 0),
  constraint inventory_balances_capacity
    check (on_hand >= reserved + committed),
  constraint inventory_balances_identity
    unique nulls not distinct (organization_id, material_id, variant_id, location_id)
);

create table erp_supply.inventory_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  operation_key text not null,
  operation_type text not null,
  actor_profile_id uuid not null references erp_supply.profiles(id) on delete restrict,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint inventory_operations_key_not_blank check (btrim(operation_key) <> ''),
  constraint inventory_operations_type_not_blank check (btrim(operation_type) <> ''),
  constraint inventory_operations_idempotency unique (organization_id, operation_key)
);

create table erp_supply.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity > 0),
  unit text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PARTIALLY_PICKED','PICKED','CLOSED','RELEASED')),
  reference text,
  created_by uuid not null references erp_supply.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint inventory_reservations_unit_not_blank check (btrim(unit) <> '')
);

create table erp_supply.inventory_reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  reservation_id uuid not null references erp_supply.inventory_reservations(id) on delete restrict,
  balance_id uuid not null references erp_supply.inventory_balances(id) on delete restrict,
  location_id uuid not null references erp_supply.inventory_locations(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity > 0),
  picked_quantity numeric(18,4) not null default 0 check (picked_quantity >= 0),
  released_quantity numeric(18,4) not null default 0 check (released_quantity >= 0),
  consumed_quantity numeric(18,4) not null default 0 check (consumed_quantity >= 0),
  returned_quantity numeric(18,4) not null default 0 check (returned_quantity >= 0),
  waste_quantity numeric(18,4) not null default 0 check (waste_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_allocations_reservation_capacity
    check (picked_quantity + released_quantity <= quantity),
  constraint inventory_allocations_commitment_capacity
    check (consumed_quantity + returned_quantity + waste_quantity <= picked_quantity),
  constraint inventory_allocations_location_unique unique (reservation_id, balance_id)
);

create table erp_supply.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  balance_id uuid not null references erp_supply.inventory_balances(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  location_id uuid not null references erp_supply.inventory_locations(id) on delete restrict,
  counted_quantity numeric(18,4) not null check (counted_quantity >= 0),
  theoretical_quantity numeric(18,4) not null check (theoretical_quantity >= 0),
  difference numeric(18,4) not null,
  blind boolean not null default true,
  status text not null default 'SUBMITTED'
    check (status in ('SUBMITTED','APPLIED','RECOUNT_REQUIRED','REJECTED')),
  submitted_by uuid not null references erp_supply.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references erp_supply.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index uq_inventory_counts_pending_balance
  on erp_supply.inventory_counts(organization_id, balance_id)
  where status = 'SUBMITTED';

create table erp_supply.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  operation_id uuid not null references erp_supply.inventory_operations(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  location_id uuid not null references erp_supply.inventory_locations(id) on delete restrict,
  order_id uuid references erp_supply.orders(id) on delete set null,
  reservation_id uuid references erp_supply.inventory_reservations(id) on delete set null,
  count_id uuid references erp_supply.inventory_counts(id) on delete set null,
  reversal_of_movement_id uuid references erp_supply.inventory_movements(id) on delete restrict,
  movement_type text not null check (
    movement_type in (
      'RECEIPT','RESERVE','RELEASE','PICK','CONSUME','RETURN',
      'ADJUSTMENT_IN','ADJUSTMENT_OUT','WASTE','REVERSAL'
    )
  ),
  quantity numeric(18,4) not null check (quantity > 0),
  unit text not null,
  on_hand_delta numeric(18,4) not null default 0,
  reserved_delta numeric(18,4) not null default 0,
  committed_delta numeric(18,4) not null default 0,
  actor_profile_id uuid not null references erp_supply.profiles(id) on delete restrict,
  reference text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_movements_effect_not_zero
    check (on_hand_delta <> 0 or reserved_delta <> 0 or committed_delta <> 0),
  constraint inventory_movements_unit_not_blank check (btrim(unit) <> '')
);

create unique index uq_inventory_movements_single_reversal
  on erp_supply.inventory_movements(reversal_of_movement_id)
  where reversal_of_movement_id is not null;

create index idx_inventory_balances_material
  on erp_supply.inventory_balances(organization_id, material_id, variant_id, location_id);
create index idx_inventory_movements_material_time
  on erp_supply.inventory_movements(organization_id, material_id, created_at desc);
create index idx_inventory_movements_order_time
  on erp_supply.inventory_movements(organization_id, order_id, created_at desc)
  where order_id is not null;
create index idx_inventory_reservations_order_status
  on erp_supply.inventory_reservations(organization_id, order_id, status);
create index idx_inventory_reservations_material_status
  on erp_supply.inventory_reservations(organization_id, material_id, variant_id, status);
create index idx_inventory_counts_status
  on erp_supply.inventory_counts(organization_id, status, submitted_at desc);

create or replace function erp_private.inventory_reject_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'Los movimientos confirmados de inventario son inmutables' using errcode='55000';
end;
$$;

create trigger trg_inventory_movements_immutable
before update or delete on erp_supply.inventory_movements
for each row execute function erp_private.inventory_reject_ledger_mutation();

revoke all on function erp_private.inventory_reject_ledger_mutation() from public, anon, authenticated;

alter table erp_supply.material_master enable row level security;
alter table erp_supply.material_variants enable row level security;
alter table erp_supply.inventory_locations enable row level security;
alter table erp_supply.inventory_balances enable row level security;
alter table erp_supply.inventory_operations enable row level security;
alter table erp_supply.inventory_reservations enable row level security;
alter table erp_supply.inventory_reservation_allocations enable row level security;
alter table erp_supply.inventory_counts enable row level security;
alter table erp_supply.inventory_movements enable row level security;

create policy material_master_read on erp_supply.material_master
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy material_variants_read on erp_supply.material_variants
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy inventory_locations_read on erp_supply.inventory_locations
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy inventory_balances_read on erp_supply.inventory_balances
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy inventory_reservations_read on erp_supply.inventory_reservations
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy inventory_reservation_allocations_read on erp_supply.inventory_reservation_allocations
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy inventory_counts_read on erp_supply.inventory_counts
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

create policy inventory_movements_read on erp_supply.inventory_movements
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('inventory','read')
);

grant select on erp_supply.material_master to authenticated;
grant select on erp_supply.material_variants to authenticated;
grant select on erp_supply.inventory_locations to authenticated;
grant select on erp_supply.inventory_balances to authenticated;
grant select on erp_supply.inventory_reservations to authenticated;
grant select on erp_supply.inventory_reservation_allocations to authenticated;
grant select on erp_supply.inventory_counts to authenticated;
grant select on erp_supply.inventory_movements to authenticated;

revoke all on erp_supply.inventory_operations from public, anon, authenticated;
revoke insert, update, delete on erp_supply.material_master from authenticated;
revoke insert, update, delete on erp_supply.material_variants from authenticated;
revoke insert, update, delete on erp_supply.inventory_locations from authenticated;
revoke insert, update, delete on erp_supply.inventory_balances from authenticated;
revoke insert, update, delete on erp_supply.inventory_reservations from authenticated;
revoke insert, update, delete on erp_supply.inventory_reservation_allocations from authenticated;
revoke insert, update, delete on erp_supply.inventory_counts from authenticated;
revoke insert, update, delete on erp_supply.inventory_movements from authenticated;

commit;
