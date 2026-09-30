begin;

create table erp_supply.order_receptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  order_task_id uuid references erp_supply.order_tasks(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','CONFIRMED','CANCELLED')),
  picking_profile_id uuid references erp_supply.profiles(id),
  cutting_profile_id uuid references erp_supply.profiles(id),
  created_by uuid not null references erp_supply.profiles(id),
  validated_by uuid references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id,order_id),
  check ((status='CONFIRMED' and confirmed_at is not null and validated_by is not null) or status<>'CONFIRMED')
);

create table erp_supply.order_reception_lines (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references erp_supply.order_receptions(id) on delete cascade,
  order_item_id uuid not null references erp_supply.order_items(id) on delete restrict,
  material_id uuid not null references erp_supply.material_master(id) on delete restrict,
  variant_id uuid references erp_supply.material_variants(id) on delete restrict,
  preferred_location_id uuid references erp_supply.inventory_locations(id) on delete restrict,
  quantity numeric(18,4) not null check (quantity>0),
  unit text not null check (btrim(unit)<>''),
  requires_cut boolean not null default false,
  cut_length_each numeric(18,4) check (cut_length_each is null or cut_length_each>0),
  metadata jsonb not null default '{}'::jsonb,
  unique (reception_id,order_item_id),
  check (not requires_cut or cut_length_each is not null)
);

create index idx_order_receptions_queue
  on erp_supply.order_receptions(organization_id,status,created_at desc);

alter table erp_supply.order_receptions enable row level security;
alter table erp_supply.order_reception_lines enable row level security;

create policy order_receptions_read on erp_supply.order_receptions
for select to authenticated using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('receiving','read')
);

create policy order_reception_lines_read on erp_supply.order_reception_lines
for select to authenticated using (
  exists(
    select 1 from erp_supply.order_receptions r
    where r.id=reception_id
      and r.organization_id=erp_private.current_org_id()
      and erp_private.can_access_module('receiving','read')
  )
);

grant select on erp_supply.order_receptions,erp_supply.order_reception_lines to authenticated;

commit;
