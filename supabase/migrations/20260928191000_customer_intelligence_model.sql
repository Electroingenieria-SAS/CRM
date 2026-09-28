begin;

insert into erp_supply.modules(code,name,description,icon,sort_order,active)
values(
  'customer_intelligence',
  'Inteligencia de clientes',
  'Ranking, Pareto y segmentación automática por pedidos y valor pagado',
  'chart-spline',
  35,
  true
)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  active=true;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'customer_intelligence',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.code in ('ventas','gerencia','auditoria','jefe_logistica','super_admin')
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

create table erp_supply.customer_intelligence_algorithm_versions (
  organization_id uuid not null references erp_supply.organizations(id),
  version text not null,
  order_weight numeric(6,5) not null check (order_weight between 0 and 1),
  paid_weight numeric(6,5) not null check (paid_weight between 0 and 1),
  normal_min_score numeric(6,2) not null default 30 check (normal_min_score between 0 and 100),
  premium_min_score numeric(6,2) not null default 70 check (premium_min_score between 0 and 100),
  urgent_min_score numeric(6,2) not null default 90 check (urgent_min_score between 0 and 100),
  minimum_population_clients integer not null default 5 check (minimum_population_clients > 0),
  minimum_population_orders integer not null default 20 check (minimum_population_orders > 0),
  medium_support_orders integer not null default 3 check (medium_support_orders > 0),
  high_support_orders integer not null default 10 check (high_support_orders >= medium_support_orders),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id,version),
  check (abs((order_weight+paid_weight)-1.0) < 0.00001),
  check (normal_min_score < premium_min_score and premium_min_score < urgent_min_score)
);

create unique index uq_customer_intelligence_active_algorithm
on erp_supply.customer_intelligence_algorithm_versions(organization_id)
where active;

create table erp_supply.customer_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  algorithm_version text not null,
  dataset_fingerprint text not null,
  actor_profile_id uuid references erp_supply.profiles(id),
  status text not null check (status in ('RUNNING','COMPLETED','FAILED')),
  customer_count integer not null default 0 check (customer_count >= 0),
  valid_order_count bigint not null default 0 check (valid_order_count >= 0),
  total_paid numeric(20,2) not null default 0 check (total_paid >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text
);

create index idx_customer_intelligence_run_fingerprint
on erp_supply.customer_intelligence_runs(
  organization_id,algorithm_version,dataset_fingerprint,started_at desc
);

create table erp_supply.customer_intelligence_current (
  organization_id uuid not null references erp_supply.organizations(id),
  customer_id uuid not null references erp_supply.customers(id) on delete cascade,
  run_id uuid not null references erp_supply.customer_intelligence_runs(id),
  algorithm_version text not null,
  valid_order_count bigint not null check (valid_order_count >= 0),
  paid_amount numeric(20,2) not null check (paid_amount >= 0),
  order_rank integer not null check (order_rank > 0),
  paid_rank integer not null check (paid_rank > 0),
  overall_rank integer not null check (overall_rank > 0),
  frequency_percentile numeric(6,2) not null check (frequency_percentile between 0 and 100),
  paid_percentile numeric(6,2) not null check (paid_percentile between 0 and 100),
  percentile numeric(6,2) not null check (percentile between 0 and 100),
  score numeric(6,2) not null check (score between 0 and 100),
  segment text not null check (segment in ('PREMIUM','NORMAL','BASIC','URGENT')),
  support_level text not null check (support_level in ('LOW','MEDIUM','HIGH')),
  provisional boolean not null,
  order_share_pct numeric(7,3) not null check (order_share_pct between 0 and 100),
  paid_share_pct numeric(7,3) not null check (paid_share_pct between 0 and 100),
  cumulative_orders_pct numeric(7,3) not null check (cumulative_orders_pct between 0 and 100),
  cumulative_paid_pct numeric(7,3) not null check (cumulative_paid_pct between 0 and 100),
  first_order_at timestamptz not null,
  last_order_at timestamptz not null,
  sample_clients integer not null check (sample_clients > 0),
  sample_orders bigint not null check (sample_orders > 0),
  calculated_at timestamptz not null default now(),
  primary key (organization_id,customer_id)
);

create index idx_customer_intelligence_ranking
on erp_supply.customer_intelligence_current(organization_id,overall_rank,customer_id);

create index idx_customer_intelligence_segment
on erp_supply.customer_intelligence_current(organization_id,segment,overall_rank);

create table erp_supply.customer_intelligence_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id),
  customer_id uuid not null references erp_supply.customers(id) on delete cascade,
  run_id uuid not null references erp_supply.customer_intelligence_runs(id),
  algorithm_version text not null,
  segment text not null check (segment in ('PREMIUM','NORMAL','BASIC','URGENT')),
  previous_segment text check (previous_segment is null or previous_segment in ('PREMIUM','NORMAL','BASIC','URGENT')),
  score numeric(6,2) not null check (score between 0 and 100),
  valid_order_count bigint not null check (valid_order_count >= 0),
  paid_amount numeric(20,2) not null check (paid_amount >= 0),
  changed_at timestamptz not null default now(),
  unique (run_id,customer_id)
);

create index idx_customer_intelligence_history
on erp_supply.customer_intelligence_history(organization_id,customer_id,changed_at desc);

create table erp_supply.customer_intelligence_state (
  organization_id uuid primary key references erp_supply.organizations(id),
  dirty_since timestamptz,
  dirty_reason text,
  last_run_id uuid references erp_supply.customer_intelligence_runs(id),
  updated_at timestamptz not null default now()
);

insert into erp_supply.customer_intelligence_algorithm_versions(
  organization_id,version,order_weight,paid_weight,active
)
select id,'1.0.0',0.5,0.5,true
from erp_supply.organizations
on conflict (organization_id,version) do nothing;

create or replace function erp_private.create_default_customer_intelligence_algorithm()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,erp_supply
as $
begin
  insert into erp_supply.customer_intelligence_algorithm_versions(
    organization_id,version,order_weight,paid_weight,active
  )
  values(new.id,'1.0.0',0.5,0.5,true)
  on conflict (organization_id,version) do nothing;
  return new;
end;
$;

revoke all on function erp_private.create_default_customer_intelligence_algorithm()
from public,anon,authenticated;

create trigger trg_organizations_customer_intelligence_algorithm
after insert on erp_supply.organizations
for each row execute function erp_private.create_default_customer_intelligence_algorithm();

create or replace function erp_private.mark_customer_intelligence_dirty()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,erp_supply
as $$
declare
  v_org uuid;
  v_reason text:=case when tg_table_name='invoices' then 'INVOICE_CHANGED' else 'ORDER_CHANGED' end;
begin
  if tg_op='DELETE' then
    v_org:=old.organization_id;
  else
    v_org:=new.organization_id;
  end if;
  insert into erp_supply.customer_intelligence_state(
    organization_id,dirty_since,dirty_reason,updated_at
  )
  values(v_org,now(),v_reason,now())
  on conflict (organization_id) do update set
    dirty_since=excluded.dirty_since,
    dirty_reason=excluded.dirty_reason,
    updated_at=now();
  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function erp_private.mark_customer_intelligence_dirty() from public,anon,authenticated;

create trigger trg_customer_intelligence_order_dirty
after insert or update or delete
on erp_supply.orders
for each row execute function erp_private.mark_customer_intelligence_dirty();

create trigger trg_customer_intelligence_invoice_dirty
after insert or update or delete
on erp_supply.invoices
for each row execute function erp_private.mark_customer_intelligence_dirty();

alter table erp_supply.customer_intelligence_algorithm_versions enable row level security;
alter table erp_supply.customer_intelligence_runs enable row level security;
alter table erp_supply.customer_intelligence_current enable row level security;
alter table erp_supply.customer_intelligence_history enable row level security;
alter table erp_supply.customer_intelligence_state enable row level security;

create policy customer_intelligence_config_read
on erp_supply.customer_intelligence_algorithm_versions for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

create policy customer_intelligence_runs_read
on erp_supply.customer_intelligence_runs for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

create policy customer_intelligence_current_read
on erp_supply.customer_intelligence_current for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

create policy customer_intelligence_history_read
on erp_supply.customer_intelligence_history for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

create policy customer_intelligence_state_read
on erp_supply.customer_intelligence_state for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

grant select on erp_supply.customer_intelligence_algorithm_versions to authenticated;
grant select on erp_supply.customer_intelligence_runs to authenticated;
grant select on erp_supply.customer_intelligence_current to authenticated;
grant select on erp_supply.customer_intelligence_history to authenticated;
grant select on erp_supply.customer_intelligence_state to authenticated;

commit;
