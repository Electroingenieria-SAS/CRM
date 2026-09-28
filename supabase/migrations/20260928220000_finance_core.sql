begin;

alter table erp_supply.invoices
  add column if not exists idempotency_key text,
  add column if not exists reversed_by uuid references erp_supply.profiles(id),
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references erp_supply.profiles(id),
  add column if not exists voided_at timestamptz,
  add column if not exists updated_by uuid references erp_supply.profiles(id);

create unique index if not exists uq_invoices_finance_idempotency
  on erp_supply.invoices(organization_id,idempotency_key)
  where idempotency_key is not null;

create unique index if not exists uq_invoices_organization_id_id
  on erp_supply.invoices(organization_id,id);

create table erp_supply.credit_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  customer_id uuid not null,
  order_id uuid,
  request_number text not null check (length(trim(request_number))>0),
  requested_amount numeric(18,2) not null check (requested_amount>0),
  requested_term_days integer not null check (requested_term_days>0),
  status text not null default 'SUBMITTED'
    check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED')),
  requested_by uuid not null references erp_supply.profiles(id),
  assigned_to uuid references erp_supply.profiles(id),
  decision_reason text,
  decided_by uuid references erp_supply.profiles(id),
  decided_at timestamptz,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,request_number),
  unique (organization_id,id),
  foreign key (organization_id,customer_id)
    references erp_supply.customers(organization_id,id),
  foreign key (organization_id,order_id)
    references erp_supply.orders(organization_id,id),
  check (
    (status in ('APPROVED','REJECTED') and decided_by is not null and decided_at is not null)
    or status not in ('APPROVED','REJECTED')
  )
);

create unique index uq_credit_request_idempotency
  on erp_supply.credit_requests(organization_id,idempotency_key)
  where idempotency_key is not null;

create index idx_credit_requests_queue
  on erp_supply.credit_requests(organization_id,status,created_at desc);

create index idx_credit_requests_customer
  on erp_supply.credit_requests(organization_id,customer_id,created_at desc);

create table erp_supply.financial_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null,
  validation_type text not null check (validation_type in ('CREDIT','CARTERA','CAJA')),
  result text not null
    check (result in ('APPROVED','REJECTED','ON_HOLD','REQUIRES_REVIEW','RELEASED')),
  reason text not null check (length(trim(reason))>0),
  reference text,
  actor_profile_id uuid not null references erp_supply.profiles(id),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id,order_id)
    references erp_supply.orders(organization_id,id)
);

create unique index uq_financial_validation_idempotency
  on erp_supply.financial_validations(organization_id,idempotency_key)
  where idempotency_key is not null;

create index idx_financial_validations_order
  on erp_supply.financial_validations(organization_id,order_id,validation_type,created_at desc);

create table erp_supply.financial_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null,
  domain text not null check (domain in ('CREDIT','CARTERA','CAJA')),
  reason_code text not null check (length(trim(reason_code))>0),
  reason text not null check (length(trim(reason))>0),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','RELEASED','CANCELLED')),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  released_by uuid references erp_supply.profiles(id),
  released_at timestamptz,
  release_reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (organization_id,order_id)
    references erp_supply.orders(organization_id,id),
  check (
    (status='ACTIVE' and released_by is null and released_at is null)
    or
    (status in ('RELEASED','CANCELLED') and released_by is not null and released_at is not null)
  )
);

create unique index uq_financial_hold_idempotency
  on erp_supply.financial_holds(organization_id,idempotency_key)
  where idempotency_key is not null;

create unique index uq_active_financial_hold
  on erp_supply.financial_holds(organization_id,order_id,domain,reason_code)
  where status='ACTIVE';

create index idx_financial_holds_queue
  on erp_supply.financial_holds(organization_id,domain,status,created_at desc);

create table erp_supply.financial_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null,
  hold_id uuid references erp_supply.financial_holds(id),
  request_type text not null
    check (request_type in ('CREDIT_EXCEPTION','RELEASE_EXCEPTION','PAYMENT_EXCEPTION')),
  status text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_by uuid not null references erp_supply.profiles(id),
  reason text not null check (length(trim(reason))>0),
  decided_by uuid references erp_supply.profiles(id),
  decision_reason text,
  decided_at timestamptz,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id,order_id)
    references erp_supply.orders(organization_id,id),
  check (decided_by is null or decided_by<>requested_by),
  check (
    (status in ('APPROVED','REJECTED') and decided_by is not null and decided_at is not null)
    or status not in ('APPROVED','REJECTED')
  )
);

create unique index uq_financial_approval_idempotency
  on erp_supply.financial_approval_requests(organization_id,idempotency_key)
  where idempotency_key is not null;

create unique index uq_financial_approval_pending
  on erp_supply.financial_approval_requests(organization_id,order_id,request_type)
  where status='PENDING';

create index idx_financial_approvals_queue
  on erp_supply.financial_approval_requests(organization_id,status,created_at desc);

create table erp_supply.financial_supports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null,
  invoice_id uuid,
  support_type text not null check (length(trim(support_type))>0),
  storage_provider text not null check (length(trim(storage_provider))>0),
  storage_reference text not null check (length(trim(storage_reference))>0),
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes>0),
  validation_status text not null default 'PENDING'
    check (validation_status in ('PENDING','VALIDATED','REJECTED')),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  validated_by uuid references erp_supply.profiles(id),
  validated_at timestamptz,
  validation_reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (organization_id,order_id)
    references erp_supply.orders(organization_id,id),
  foreign key (organization_id,invoice_id)
    references erp_supply.invoices(organization_id,id),
  check (
    (validation_status='PENDING' and validated_by is null and validated_at is null)
    or
    (validation_status in ('VALIDATED','REJECTED') and validated_by is not null and validated_at is not null)
  )
);

create unique index uq_financial_support_idempotency
  on erp_supply.financial_supports(organization_id,idempotency_key)
  where idempotency_key is not null;

create index idx_financial_supports_order
  on erp_supply.financial_supports(organization_id,order_id,created_at desc);

create table erp_supply.financial_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid,
  aggregate_type text not null check (length(trim(aggregate_type))>0),
  aggregate_id uuid not null,
  event_type text not null check (length(trim(event_type))>0),
  actor_profile_id uuid not null references erp_supply.profiles(id),
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id,order_id)
    references erp_supply.orders(organization_id,id)
);

create unique index uq_financial_event_idempotency
  on erp_supply.financial_events(organization_id,idempotency_key)
  where idempotency_key is not null;

create index idx_financial_events_order
  on erp_supply.financial_events(organization_id,order_id,created_at desc);

create or replace function erp_private.can_access_financial_domain(
  p_domain text,
  p_capability text
)
returns boolean
language sql
stable
security invoker
set search_path=pg_catalog,erp_private
as $$
  select case upper(coalesce(p_domain,''))
    when 'CREDIT' then erp_private.can_access_module('credit',p_capability)
    when 'CARTERA' then erp_private.can_access_module('cartera',p_capability)
    when 'CAJA' then erp_private.can_access_module('caja',p_capability)
    else false
  end
$$;

revoke all on function erp_private.can_access_financial_domain(text,text)
from public,anon;
grant execute on function erp_private.can_access_financial_domain(text,text)
to authenticated;

alter table erp_supply.credit_requests enable row level security;
alter table erp_supply.financial_validations enable row level security;
alter table erp_supply.financial_holds enable row level security;
alter table erp_supply.financial_approval_requests enable row level security;
alter table erp_supply.financial_supports enable row level security;
alter table erp_supply.financial_events enable row level security;

create policy credit_requests_read on erp_supply.credit_requests
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('credit','read')
);

create policy credit_requests_insert on erp_supply.credit_requests
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('credit','create')
  and requested_by=erp_private.current_profile_id()
);

create policy credit_requests_update on erp_supply.credit_requests
for update to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('credit','update')
)
with check (organization_id=erp_private.current_org_id());

create policy financial_validations_read on erp_supply.financial_validations
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_financial_domain(validation_type,'read')
);

create policy financial_validations_insert on erp_supply.financial_validations
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and actor_profile_id=erp_private.current_profile_id()
  and (
    erp_private.can_access_financial_domain(validation_type,'update')
    or erp_private.can_access_financial_domain(validation_type,'approve')
  )
);

create policy financial_holds_read on erp_supply.financial_holds
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_financial_domain(domain,'read')
);

create policy financial_holds_insert on erp_supply.financial_holds
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
  and erp_private.can_access_financial_domain(domain,'update')
);

create policy financial_holds_update on erp_supply.financial_holds
for update to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_financial_domain(domain,'update')
    or erp_private.can_access_financial_domain(domain,'approve')
  )
)
with check (organization_id=erp_private.current_org_id());

create policy financial_approvals_read on erp_supply.financial_approval_requests
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('approvals','read')
    or erp_private.can_access_module('credit','read')
    or erp_private.can_access_module('cartera','read')
    or erp_private.can_access_module('caja','read')
  )
);

create policy financial_approvals_insert on erp_supply.financial_approval_requests
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and requested_by=erp_private.current_profile_id()
  and (
    erp_private.can_access_module('credit','create')
    or erp_private.can_access_module('cartera','update')
    or erp_private.can_access_module('caja','update')
  )
);

create policy financial_approvals_update on erp_supply.financial_approval_requests
for update to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('approvals','approve')
    or erp_private.can_access_module('credit','approve')
    or erp_private.can_access_module('cartera','approve')
    or erp_private.can_access_module('caja','approve')
  )
)
with check (organization_id=erp_private.current_org_id());

create policy financial_supports_read on erp_supply.financial_supports
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('caja','read')
    or erp_private.can_access_module('billing','read')
    or erp_private.can_access_module('cartera','read')
  )
);

create policy financial_supports_insert on erp_supply.financial_supports
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
  and erp_private.can_access_module('caja','create')
);

create policy financial_supports_update on erp_supply.financial_supports
for update to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('caja','update')
)
with check (organization_id=erp_private.current_org_id());

create policy financial_events_read on erp_supply.financial_events
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('credit','read')
    or erp_private.can_access_module('cartera','read')
    or erp_private.can_access_module('caja','read')
    or erp_private.can_access_module('audit','read')
  )
);

create policy financial_events_insert on erp_supply.financial_events
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and actor_profile_id=erp_private.current_profile_id()
);

grant select,insert,update on erp_supply.credit_requests to authenticated;
grant select,insert on erp_supply.financial_validations to authenticated;
grant select,insert,update on erp_supply.financial_holds to authenticated;
grant select,insert,update on erp_supply.financial_approval_requests to authenticated;
grant select,insert,update on erp_supply.financial_supports to authenticated;
grant select,insert on erp_supply.financial_events to authenticated;
grant select,insert,update on erp_supply.invoices to authenticated;

commit;
