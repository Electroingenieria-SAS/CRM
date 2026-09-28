begin;

create table erp_supply.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  identity_kind text not null check (identity_kind in ('DOCUMENT','PROVISIONAL_ORDER')),
  document text,
  normalized_document text,
  provisional_order_id uuid,
  display_name text not null check (length(trim(display_name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_document),
  unique (organization_id, provisional_order_id),
  check (
    (identity_kind='DOCUMENT' and normalized_document is not null and provisional_order_id is null)
    or
    (identity_kind='PROVISIONAL_ORDER' and normalized_document is null and provisional_order_id is not null)
  )
);

alter table erp_supply.orders
  add column customer_id uuid references erp_supply.customers(id);

create index idx_orders_customer_intelligence
  on erp_supply.orders(organization_id,customer_id,status,created_at)
  where not is_test;

create table erp_supply.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id),
  order_id uuid not null references erp_supply.orders(id) on delete cascade,
  invoice_number text not null check (length(trim(invoice_number)) > 0),
  invoice_date date not null default current_date,
  amount numeric(18,2) not null check (amount > 0),
  reversed_amount numeric(18,2) not null default 0 check (reversed_amount >= 0),
  currency text not null default 'COP',
  status text not null default 'REGISTERED'
    check (status in ('REGISTERED','PARTIALLY_REVERSED','REVERSED','VOID')),
  reversal_reason text,
  reversed_at timestamptz,
  registered_by uuid references erp_supply.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number),
  check (reversed_amount <= amount),
  check (
    (status='REGISTERED' and reversed_amount=0 and reversed_at is null)
    or (status='PARTIALLY_REVERSED' and reversed_amount>0 and reversed_amount<amount)
    or (status='REVERSED' and reversed_amount=amount and reversed_at is not null)
    or (status='VOID' and reversed_amount=0)
  )
);

create index idx_invoices_customer_intelligence
  on erp_supply.invoices(organization_id,order_id,status,invoice_date);

create or replace function erp_private.normalize_customer_document(p_document text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select nullif(upper(regexp_replace(trim(coalesce(p_document,'')),'[^A-Za-z0-9]','','g')),'')
$$;

create or replace function erp_private.resolve_order_customer(
  p_organization_id uuid,
  p_order_id uuid,
  p_document text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,erp_supply
as $$
declare
  v_document text:=erp_private.normalize_customer_document(p_document);
  v_customer_id uuid;
  v_name text:=coalesce(nullif(trim(p_name),''),'Cliente sin nombre');
begin
  if p_organization_id is null or p_order_id is null then
    raise exception 'organization_id y order_id son obligatorios';
  end if;

  if v_document is not null then
    insert into erp_supply.customers(
      organization_id,identity_kind,document,normalized_document,display_name
    )
    values(p_organization_id,'DOCUMENT',nullif(trim(p_document),''),v_document,v_name)
    on conflict (organization_id,normalized_document)
    do update set
      document=coalesce(excluded.document,erp_supply.customers.document),
      display_name=excluded.display_name,
      active=true,
      updated_at=now()
    returning id into v_customer_id;
  else
    insert into erp_supply.customers(
      organization_id,identity_kind,provisional_order_id,display_name
    )
    values(p_organization_id,'PROVISIONAL_ORDER',p_order_id,v_name)
    on conflict (organization_id,provisional_order_id)
    do update set
      display_name=excluded.display_name,
      active=true,
      updated_at=now()
    returning id into v_customer_id;
  end if;

  return v_customer_id;
end;
$$;

revoke all on function erp_private.normalize_customer_document(text) from public,anon,authenticated;
revoke all on function erp_private.resolve_order_customer(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function erp_private.assign_order_customer()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,erp_supply
as $$
begin
  if new.customer_id is null
     or new.client_document is distinct from old.client_document
     or new.client_name is distinct from old.client_name then
    new.customer_id:=erp_private.resolve_order_customer(
      new.organization_id,new.id,new.client_document,new.client_name
    );
  end if;
  return new;
end;
$$;

revoke all on function erp_private.assign_order_customer() from public,anon,authenticated;

create trigger trg_orders_assign_customer
before insert or update of client_document,client_name
on erp_supply.orders
for each row execute function erp_private.assign_order_customer();

update erp_supply.orders o
set customer_id=erp_private.resolve_order_customer(
  o.organization_id,o.id,o.client_document,o.client_name
)
where o.customer_id is null;

alter table erp_supply.customers enable row level security;
alter table erp_supply.invoices enable row level security;

create policy customers_intelligence_read
on erp_supply.customers for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

create policy invoices_intelligence_read
on erp_supply.invoices for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('customer_intelligence','read')
);

grant select on erp_supply.customers to authenticated;
grant select on erp_supply.invoices to authenticated;

commit;
