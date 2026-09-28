begin;

create table erp_supply.freight_carriers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table erp_supply.freight_destinations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  country_code text not null default 'CO' check (length(country_code)=2),
  department_key text not null,
  department_name text not null,
  city_key text not null,
  city_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, country_code, department_key, city_key)
);

create table erp_supply.freight_destination_aliases (
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  alias_key text not null,
  destination_id uuid not null references erp_supply.freight_destinations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, alias_key)
);

create table erp_supply.freight_model_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_code text not null,
  algorithm_version text not null,
  active boolean not null default true,
  parameters jsonb not null default '{}'::jsonb,
  source_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, model_code, algorithm_version)
);

create table erp_supply.freight_legacy_route_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_version_id uuid not null references erp_supply.freight_model_versions(id),
  carrier_id uuid not null references erp_supply.freight_carriers(id),
  destination_id uuid not null references erp_supply.freight_destinations(id),
  route_code text not null default 'NATIONAL_DISPATCH'
    check (route_code in ('LOCAL_DISPATCH','NATIONAL_DISPATCH')),
  origin_city_key text not null,
  sample_count integer not null check (sample_count > 0),
  weight_sample_count integer not null default 0 check (weight_sample_count >= 0),
  weight_p20 numeric check (weight_p20 is null or weight_p20 >= 0),
  weight_p50 numeric check (weight_p50 is null or weight_p50 >= 0),
  weight_p80 numeric check (weight_p80 is null or weight_p80 >= 0),
  cost_p20 numeric not null check (cost_p20 >= 0),
  cost_p50 numeric not null check (cost_p50 >= 0),
  cost_p80 numeric not null check (cost_p80 >= 0),
  transit_sample_count integer not null default 0 check (transit_sample_count >= 0),
  transit_p50_days numeric check (transit_p50_days is null or transit_p50_days >= 0),
  transit_p80_days numeric check (transit_p80_days is null or transit_p80_days >= 0),
  source_start date not null,
  source_end date not null,
  source_label text not null,
  created_at timestamptz not null default now(),
  check (source_end >= source_start),
  unique (organization_id, model_version_id, carrier_id, destination_id, route_code)
);

create table erp_supply.freight_predictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid references erp_supply.orders(id) on delete set null,
  carrier_id uuid references erp_supply.freight_carriers(id),
  destination_id uuid references erp_supply.freight_destinations(id),
  route_code text not null check (
    route_code in ('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')
  ),
  destination_city_key text not null,
  destination_department_key text not null,
  requested_weight_kg numeric check (requested_weight_kg is null or requested_weight_kg >= 0),
  requested_package_count numeric check (
    requested_package_count is null or requested_package_count >= 0
  ),
  requested_volume_m3 numeric check (requested_volume_m3 is null or requested_volume_m3 >= 0),
  estimate_low numeric check (estimate_low is null or estimate_low >= 0),
  estimate_mid numeric check (estimate_mid is null or estimate_mid >= 0),
  estimate_high numeric check (estimate_high is null or estimate_high >= 0),
  sample_count integer not null default 0 check (sample_count >= 0),
  evidence_level text not null check (evidence_level in ('HIGH','MEDIUM','LOW','NONE')),
  fallback_scope text not null check (
    fallback_scope in (
      'CITY','DEPARTMENT','NATIONAL',
      'CITY_ALL_CARRIERS','DEPARTMENT_ALL_CARRIERS','NATIONAL_ALL_CARRIERS',
      'NO_FREIGHT','NONE'
    )
  ),
  algorithm_version text not null,
  explanation jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now()
);

create unique index uq_freight_prediction_idempotency
  on erp_supply.freight_predictions(organization_id,idempotency_key)
  where idempotency_key is not null;

create table erp_supply.freight_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  prediction_id uuid references erp_supply.freight_predictions(id) on delete set null,
  order_id uuid references erp_supply.orders(id) on delete set null,
  carrier_id uuid references erp_supply.freight_carriers(id),
  destination_id uuid references erp_supply.freight_destinations(id),
  route_code text not null check (route_code in ('LOCAL_DISPATCH','NATIONAL_DISPATCH')),
  destination_city_key text not null,
  destination_department_key text not null,
  actual_cost numeric not null check (actual_cost >= 0),
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  package_count numeric check (package_count is null or package_count >= 0),
  volume_m3 numeric check (volume_m3 is null or volume_m3 >= 0),
  observed_at timestamptz not null default now(),
  source text not null check (source in ('LOGISTICS','IMPORT','MIGRATION','QA_SYNTHETIC')),
  external_key text,
  created_by uuid references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, source, external_key)
);

create index idx_freight_legacy_lookup
  on erp_supply.freight_legacy_route_stats(
    organization_id,route_code,carrier_id,destination_id,source_end desc
  );

create index idx_freight_destinations_lookup
  on erp_supply.freight_destinations(organization_id,department_key,city_key);

create index idx_freight_observations_lookup
  on erp_supply.freight_observations(
    organization_id,route_code,destination_department_key,destination_city_key,observed_at desc
  );

create index idx_freight_observations_carrier
  on erp_supply.freight_observations(organization_id,carrier_id,observed_at desc);

create index idx_freight_predictions_recent
  on erp_supply.freight_predictions(organization_id,created_at desc);

alter table erp_supply.freight_carriers enable row level security;
alter table erp_supply.freight_destinations enable row level security;
alter table erp_supply.freight_destination_aliases enable row level security;
alter table erp_supply.freight_model_versions enable row level security;
alter table erp_supply.freight_legacy_route_stats enable row level security;
alter table erp_supply.freight_predictions enable row level security;
alter table erp_supply.freight_observations enable row level security;

create policy freight_reference_read on erp_supply.freight_carriers
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_destinations_read on erp_supply.freight_destinations
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_aliases_read on erp_supply.freight_destination_aliases
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_models_read on erp_supply.freight_model_versions
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_legacy_read on erp_supply.freight_legacy_route_stats
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_predictions_read on erp_supply.freight_predictions
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_predictions_create on erp_supply.freight_predictions
for insert to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and created_by = erp_private.current_profile_id()
  and erp_private.can_access_module('freight','create')
);

create policy freight_observations_read on erp_supply.freight_observations
for select to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_observations_create on erp_supply.freight_observations
for insert to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and (
    erp_private.can_access_module('freight','update')
    or erp_private.can_access_module('freight','admin')
  )
);

grant select on erp_supply.freight_carriers to authenticated;
grant select on erp_supply.freight_destinations to authenticated;
grant select on erp_supply.freight_destination_aliases to authenticated;
grant select on erp_supply.freight_model_versions to authenticated;
grant select on erp_supply.freight_legacy_route_stats to authenticated;
grant select,insert on erp_supply.freight_predictions to authenticated;
grant select,insert on erp_supply.freight_observations to authenticated;

insert into erp_supply.modules(code,name,description,icon,sort_order,active)
values ('freight','Inteligencia de fletes','Estimación explicable e histórico de costos','truck',125,true)
on conflict (code) do update
set name=excluded.name,description=excluded.description,icon=excluded.icon,sort_order=excluded.sort_order,active=true;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
) values
('ventas','freight',true,true,false,false,false),
('aux_logistica','freight',true,true,false,false,false),
('coordinador_logistico','freight',true,true,true,false,false),
('lider_logistica','freight',true,true,true,false,false),
('jefe_logistica','freight',true,true,true,true,false),
('gerencia','freight',true,true,false,true,false),
('auditoria','freight',true,false,false,false,false)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
values ('super_admin','freight',true,true,true,true,true)
on conflict (role_code,module_code) do update set
  can_read=true,can_create=true,can_update=true,can_approve=true,can_admin=true;

commit;
