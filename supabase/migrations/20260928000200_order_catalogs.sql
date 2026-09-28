begin;

create table erp_supply.order_types (
  code text primary key,
  name text not null,
  description text,
  requires_purchase_default boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100
);

create table erp_supply.payment_conditions (
  code text primary key,
  name text not null,
  requires_cartera boolean not null default false,
  requires_caja boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100
);

create table erp_supply.delivery_routes (
  code text primary key,
  name text not null,
  route_group text not null check (route_group in ('LOCAL','NATIONAL','PICKUP','POINT')),
  active boolean not null default true,
  sort_order integer not null default 100
);

create table erp_supply.workflow_steps (
  code text primary key,
  name text not null,
  module_code text not null references erp_supply.modules(code),
  queue_code text not null,
  sla_hours numeric(10,2),
  sort_order integer not null,
  terminal boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table erp_supply.step_roles (
  step_code text not null references erp_supply.workflow_steps(code) on delete cascade,
  role_code text not null references erp_supply.roles(code) on delete cascade,
  can_view boolean not null default true,
  can_claim boolean not null default false,
  can_assign boolean not null default false,
  can_start boolean not null default false,
  can_complete boolean not null default false,
  can_block boolean not null default false,
  can_override boolean not null default false,
  primary key (step_code, role_code)
);

alter table erp_supply.order_types enable row level security;
alter table erp_supply.payment_conditions enable row level security;
alter table erp_supply.delivery_routes enable row level security;
alter table erp_supply.workflow_steps enable row level security;
alter table erp_supply.step_roles enable row level security;

create policy order_types_read on erp_supply.order_types
for select to authenticated using (active);

create policy payment_conditions_read on erp_supply.payment_conditions
for select to authenticated using (active);

create policy delivery_routes_read on erp_supply.delivery_routes
for select to authenticated using (active);

create policy workflow_steps_read on erp_supply.workflow_steps
for select to authenticated using (active);

create policy step_roles_read on erp_supply.step_roles
for select to authenticated using (role_code = any(erp_private.current_roles()));

grant select on erp_supply.order_types to authenticated;
grant select on erp_supply.payment_conditions to authenticated;
grant select on erp_supply.delivery_routes to authenticated;
grant select on erp_supply.workflow_steps to authenticated;
grant select on erp_supply.step_roles to authenticated;

create or replace function erp_supply.initial_step(
  p_order_type text,
  p_payment_condition text,
  p_requires_purchase boolean,
  p_has_credit_arrears boolean,
  p_held_by_cashier boolean
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when upper(p_order_type) in ('PVC','PVP') and coalesce(p_has_credit_arrears,false) then 'CARTERA'
    when upper(p_order_type) in ('PVN','PNV') and coalesce(p_held_by_cashier,false) then 'CAJA'
    when upper(p_order_type) = 'PVE' or coalesce(p_requires_purchase,false) then 'COMPRAS'
    else 'RECEPCION_PEDIDO'
  end
$$;

revoke all on function erp_supply.initial_step(text,text,boolean,boolean,boolean) from public, anon;
grant execute on function erp_supply.initial_step(text,text,boolean,boolean,boolean) to authenticated;

commit;
