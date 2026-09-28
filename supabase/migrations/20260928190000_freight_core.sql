begin;

create table erp_supply.freight_carriers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table erp_supply.freight_destinations (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'CO',
  department_key text not null,
  department_name text not null,
  city_key text not null,
  city_name text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (country_code, department_key, city_key)
);

create table erp_supply.freight_historical_aggregates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_version text not null,
  origin_city_key text not null,
  route_code text not null references erp_supply.delivery_routes(code),
  carrier_id uuid not null references erp_supply.freight_carriers(id),
  destination_id uuid not null references erp_supply.freight_destinations(id),
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
  check (cost_p20 <= cost_p50 and cost_p50 <= cost_p80),
  unique (organization_id, model_version, route_code, carrier_id, destination_id)
);

create table erp_supply.freight_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid references erp_supply.orders(id) on delete set null,
  carrier_id uuid not null references erp_supply.freight_carriers(id),
  destination_id uuid not null references erp_supply.freight_destinations(id),
  route_code text not null references erp_supply.delivery_routes(code),
  actual_cost numeric not null check (actual_cost >= 0),
  currency text not null default 'COP' check (currency = 'COP'),
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  package_count numeric check (package_count is null or package_count >= 0),
  volume_m3 numeric check (volume_m3 is null or volume_m3 >= 0),
  service_type text,
  declared_value numeric check (declared_value is null or declared_value >= 0),
  observed_at timestamptz not null,
  source text not null default 'CRM'
    check (source in ('CRM','IMPORT','LOGISTICS','QA_SYNTHETIC')),
  external_key text,
  created_by uuid references erp_supply.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table erp_supply.freight_predictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  order_id uuid references erp_supply.orders(id) on delete set null,
  carrier_id uuid references erp_supply.freight_carriers(id),
  destination_id uuid not null references erp_supply.freight_destinations(id),
  route_code text not null references erp_supply.delivery_routes(code),
  requested_weight_kg numeric check (requested_weight_kg is null or requested_weight_kg >= 0),
  requested_package_count numeric check (requested_package_count is null or requested_package_count >= 0),
  requested_volume_m3 numeric check (requested_volume_m3 is null or requested_volume_m3 >= 0),
  result_status text not null
    check (result_status in ('AVAILABLE','INSUFFICIENT','NOT_APPLICABLE')),
  fallback_level text not null
    check (fallback_level in ('CITY','DEPARTMENT','NATIONAL','NONE','NOT_APPLICABLE')),
  evidence_level text not null
    check (evidence_level in ('HIGH','MEDIUM','LOW','NONE','NOT_APPLICABLE')),
  evidence_samples integer not null default 0 check (evidence_samples >= 0),
  outlier_count integer not null default 0 check (outlier_count >= 0),
  estimate_low numeric check (estimate_low is null or estimate_low >= 0),
  estimate_mid numeric check (estimate_mid is null or estimate_mid >= 0),
  estimate_high numeric check (estimate_high is null or estimate_high >= 0),
  algorithm_version text not null,
  basis text not null,
  source_from date,
  source_to date,
  explanation_code text not null,
  diagnostics jsonb not null default '{}'::jsonb,
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  check (
    result_status <> 'AVAILABLE'
    or (
      estimate_low is not null
      and estimate_mid is not null
      and estimate_high is not null
      and estimate_low <= estimate_mid
      and estimate_mid <= estimate_high
    )
  )
);

create table erp_supply.freight_prediction_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  prediction_id uuid not null unique,
  observation_id uuid not null unique,
  absolute_error numeric not null check (absolute_error >= 0),
  absolute_percentage_error numeric check (
    absolute_percentage_error is null or absolute_percentage_error >= 0
  ),
  signed_error numeric not null,
  created_at timestamptz not null default now(),
  foreign key (prediction_id, organization_id)
    references erp_supply.freight_predictions(id, organization_id) on delete cascade,
  foreign key (observation_id, organization_id)
    references erp_supply.freight_observations(id, organization_id) on delete cascade
);

create index idx_freight_history_scope
  on erp_supply.freight_historical_aggregates(
    organization_id, route_code, carrier_id, destination_id, source_end desc
  );

create index idx_freight_observations_scope
  on erp_supply.freight_observations(
    organization_id, route_code, carrier_id, destination_id, observed_at desc
  );

create unique index uq_freight_observation_external_key
  on erp_supply.freight_observations(organization_id, external_key)
  where external_key is not null;

create index idx_freight_observations_order
  on erp_supply.freight_observations(organization_id, order_id)
  where order_id is not null;

create index idx_freight_predictions_scope
  on erp_supply.freight_predictions(
    organization_id, route_code, destination_id, carrier_id, created_at desc
  );

create index idx_freight_predictions_order
  on erp_supply.freight_predictions(organization_id, order_id, created_at desc)
  where order_id is not null;

create index idx_freight_outcomes_org
  on erp_supply.freight_prediction_outcomes(organization_id, created_at desc);

alter table erp_supply.freight_carriers enable row level security;
alter table erp_supply.freight_destinations enable row level security;
alter table erp_supply.freight_historical_aggregates enable row level security;
alter table erp_supply.freight_observations enable row level security;
alter table erp_supply.freight_predictions enable row level security;
alter table erp_supply.freight_prediction_outcomes enable row level security;

create policy freight_carriers_read
on erp_supply.freight_carriers for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_destinations_read
on erp_supply.freight_destinations for select
to authenticated
using (
  erp_private.can_access_module('freight','read')
  or erp_private.can_access_module('freight','create')
);

create policy freight_history_read
on erp_supply.freight_historical_aggregates for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_observations_read
on erp_supply.freight_observations for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_observations_insert
on erp_supply.freight_observations for insert
to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and created_by = erp_private.current_profile_id()
  and (
    erp_private.can_access_module('freight','update')
    or erp_private.can_access_module('freight','admin')
  )
  and exists (
    select 1
    from erp_supply.freight_carriers c
    where c.id=carrier_id
      and c.organization_id=erp_private.current_org_id()
      and c.active
  )
  and (
    order_id is null
    or exists (
      select 1
      from erp_supply.orders o
      where o.id=order_id
        and o.organization_id=erp_private.current_org_id()
    )
  )
);

create policy freight_predictions_read
on erp_supply.freight_predictions for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_predictions_insert
on erp_supply.freight_predictions for insert
to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and created_by = erp_private.current_profile_id()
  and erp_private.can_access_module('freight','create')
  and (
    carrier_id is null
    or exists (
      select 1
      from erp_supply.freight_carriers c
      where c.id=carrier_id
        and c.organization_id=erp_private.current_org_id()
        and c.active
    )
  )
  and (
    order_id is null
    or exists (
      select 1
      from erp_supply.orders o
      where o.id=order_id
        and o.organization_id=erp_private.current_org_id()
    )
  )
);

create policy freight_outcomes_read
on erp_supply.freight_prediction_outcomes for select
to authenticated
using (
  organization_id = erp_private.current_org_id()
  and erp_private.can_access_module('freight','read')
);

create policy freight_outcomes_insert
on erp_supply.freight_prediction_outcomes for insert
to authenticated
with check (
  organization_id = erp_private.current_org_id()
  and (
    erp_private.can_access_module('freight','update')
    or erp_private.can_access_module('freight','admin')
  )
);

grant select on erp_supply.freight_carriers to authenticated;
grant select on erp_supply.freight_destinations to authenticated;
grant select on erp_supply.freight_historical_aggregates to authenticated;
grant select, insert on erp_supply.freight_observations to authenticated;
grant select, insert on erp_supply.freight_predictions to authenticated;
grant select, insert on erp_supply.freight_prediction_outcomes to authenticated;

create or replace function erp_private.freight_norm(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select trim(
    regexp_replace(
      translate(
        upper(coalesce(p_value,'')),
        'ÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ',
        'AAAAEEEEIIIIOOOOUUUUN'
      ),
      '[^A-Z0-9]+',
      ' ',
      'g'
    )
  )
$$;

create or replace function erp_private.freight_city_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, erp_private
as $$
  with normalized as (
    select trim(
      regexp_replace(
        erp_private.freight_norm(split_part(coalesce(p_value,''),',',1)),
        '\s+',
        ' ',
        'g'
      )
    ) value
  )
  select case
    when value in (
      'BOGOTA D C','BOGOTA DC','BOGOTA DISTRITO CAPITAL',
      'SANTA FE DE BOGOTA','SANTAFE DE BOGOTA'
    ) then 'BOGOTA'
    when value in ('GUADALAJARA DE BUGA','BUGA') then 'BUGA'
    when value in ('SANTA CRUZ DE LORICA','LORICA') then 'LORICA'
    when value = 'SANTIAGO DE CALI' then 'CALI'
    when value in ('ARMENIA Q','ARMENIA QUINDIO') then 'ARMENIA'
    when value = 'SAN JOSE DE CUCUTA' then 'CUCUTA'
    when value like 'SAN VICENTE DEL CHUCU%'
      or value like 'SAN VICENTE DE CHUCURI%' then 'SAN VICENTE DE CHUCURI'
    else value
  end
  from normalized
$$;

create or replace function erp_private.freight_department_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, erp_private
as $$
  with normalized as (
    select trim(regexp_replace(erp_private.freight_norm(p_value), '\s+', ' ', 'g')) value
  )
  select case
    when value in ('VALLE','VALLE DEL CAUCA') then 'VALLE DEL CAUCA'
    when value in (
      'BOGOTA D C','BOGOTA DC','D C','DISTRITO CAPITAL','BOGOTA DISTRITO CAPITAL'
    ) then 'BOGOTA DC'
    when value in ('GUAJIRA','LA GUAJIRA') then 'GUAJIRA'
    else value
  end
  from normalized
$$;

revoke all on function erp_private.freight_norm(text) from public, anon, authenticated;
revoke all on function erp_private.freight_city_key(text) from public, anon, authenticated;
revoke all on function erp_private.freight_department_key(text) from public, anon, authenticated;

commit;
