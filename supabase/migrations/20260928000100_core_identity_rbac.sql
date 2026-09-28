begin;

create extension if not exists pgcrypto;
create schema if not exists erp_supply;
create schema if not exists erp_private;

revoke all on schema erp_supply from public, anon;
revoke all on schema erp_private from public, anon;
grant usage on schema erp_supply, erp_private to authenticated;

create table erp_supply.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  timezone text not null default 'America/Bogota',
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table erp_supply.roles (
  code text primary key,
  name text not null,
  description text,
  system_role boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table erp_supply.profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  display_name text not null,
  employee_code text,
  active boolean not null default true,
  is_system boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table erp_supply.profile_roles (
  profile_id uuid not null references erp_supply.profiles(id) on delete cascade,
  role_code text not null references erp_supply.roles(code),
  is_primary boolean not null default false,
  granted_at timestamptz not null default now(),
  granted_by uuid references erp_supply.profiles(id),
  primary key (profile_id, role_code)
);

create table erp_supply.modules (
  code text primary key,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 100,
  active boolean not null default true
);

create table erp_supply.role_module_permissions (
  role_code text not null references erp_supply.roles(code) on delete cascade,
  module_code text not null references erp_supply.modules(code) on delete cascade,
  can_read boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_approve boolean not null default false,
  can_admin boolean not null default false,
  primary key (role_code, module_code)
);

alter table erp_supply.organizations enable row level security;
alter table erp_supply.roles enable row level security;
alter table erp_supply.profiles enable row level security;
alter table erp_supply.profile_roles enable row level security;
alter table erp_supply.modules enable row level security;
alter table erp_supply.role_module_permissions enable row level security;

create or replace function erp_private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select p.id
  from erp_supply.profiles p
  where p.auth_user_id = auth.uid()
    and p.active
  order by p.created_at
  limit 1
$$;

create or replace function erp_private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select p.organization_id
  from erp_supply.profiles p
  where p.auth_user_id = auth.uid()
    and p.active
  order by p.created_at
  limit 1
$$;

create or replace function erp_private.current_roles()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select coalesce(array_agg(pr.role_code order by pr.role_code), array[]::text[])
  from erp_supply.profile_roles pr
  where pr.profile_id = erp_private.current_profile_id()
$$;

create or replace function erp_private.can_access_module(
  p_module_code text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select coalesce(bool_or(
    case lower(p_action)
      when 'read' then mp.can_read
      when 'create' then mp.can_create
      when 'update' then mp.can_update
      when 'approve' then mp.can_approve
      when 'admin' then mp.can_admin
      else false
    end
  ), false)
  from erp_supply.role_module_permissions mp
  where mp.role_code = any(erp_private.current_roles())
    and mp.module_code = p_module_code
$$;

revoke all on function erp_private.current_profile_id() from public, anon;
revoke all on function erp_private.current_org_id() from public, anon;
revoke all on function erp_private.current_roles() from public, anon;
revoke all on function erp_private.can_access_module(text, text) from public, anon;
grant execute on function erp_private.current_profile_id() to authenticated;
grant execute on function erp_private.current_org_id() to authenticated;
grant execute on function erp_private.current_roles() to authenticated;
grant execute on function erp_private.can_access_module(text, text) to authenticated;

create policy organizations_read_own
on erp_supply.organizations for select
to authenticated
using (id = erp_private.current_org_id());

create policy roles_read_authenticated
on erp_supply.roles for select
to authenticated
using (active);

create policy profiles_read_own_org
on erp_supply.profiles for select
to authenticated
using (organization_id = erp_private.current_org_id());

create policy profile_roles_read_own_org
on erp_supply.profile_roles for select
to authenticated
using (
  exists (
    select 1
    from erp_supply.profiles p
    where p.id = profile_roles.profile_id
      and p.organization_id = erp_private.current_org_id()
  )
);

create policy modules_read_authenticated
on erp_supply.modules for select
to authenticated
using (active);

create policy permissions_read_authenticated
on erp_supply.role_module_permissions for select
to authenticated
using (role_code = any(erp_private.current_roles()));

grant select on erp_supply.organizations to authenticated;
grant select on erp_supply.roles to authenticated;
grant select on erp_supply.profiles to authenticated;
grant select on erp_supply.profile_roles to authenticated;
grant select on erp_supply.modules to authenticated;
grant select on erp_supply.role_module_permissions to authenticated;

commit;
