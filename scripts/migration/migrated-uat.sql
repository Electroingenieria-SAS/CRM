\set ON_ERROR_STOP on

do $$
declare
  v_active erp_supply.orders%rowtype;
  v_closed erp_supply.orders%rowtype;
  v_inventory record;
  v_shipment erp_supply.logistics_shipments%rowtype;
begin
  select * into strict v_active
  from erp_supply.orders
  where order_number='LEG-ACTIVE';

  if v_active.status<>'IN_PROGRESS'
     or v_active.current_step_code<>'LOCAL_DISPATCH'
     or v_active.current_role_code<>'coordinador_logistico' then
    raise exception 'UAT migrated active order state mismatch';
  end if;

  if (select count(*) from erp_supply.order_tasks where order_id=v_active.id and status='IN_PROGRESS')<>1 then
    raise exception 'UAT migrated active task mismatch';
  end if;

  if (select count(*) from erp_supply.invoices where order_id=v_active.id and amount=50000 and currency='COP')<>1 then
    raise exception 'UAT migrated monetary invoice mismatch';
  end if;

  select * into strict v_closed
  from erp_supply.orders
  where order_number='LEG-CLOSED';

  if v_closed.status<>'CLOSED' then
    raise exception 'UAT migrated closed order state mismatch';
  end if;

  if jsonb_array_length(coalesce(v_closed.metadata->'legacyInvoiceReferences','[]'::jsonb))<>1 then
    raise exception 'UAT migrated archive-only invoice reference missing';
  end if;

  if exists(
    select 1 from erp_supply.invoices
    where order_id=v_closed.id and invoice_number='INV-HIST'
  ) then
    raise exception 'UAT invalid zero/null historical invoice entered monetary ledger';
  end if;

  select
    coalesce(sum(on_hand),0) physical,
    coalesce(sum(reserved),0) reserved,
    coalesce(sum(committed),0) committed,
    coalesce(sum(on_hand-reserved-committed),0) available
  into strict v_inventory
  from erp_supply.inventory_balances;

  if v_inventory.physical<>100
     or v_inventory.reserved<>5
     or v_inventory.committed<>30
     or v_inventory.available<>65 then
    raise exception 'UAT inventory mapping mismatch: physical %, reserved %, committed %, available %',
      v_inventory.physical,v_inventory.reserved,v_inventory.committed,v_inventory.available;
  end if;

  if (select count(*) from erp_supply.inventory_reservations where status='ACTIVE' and quantity=5)<>1 then
    raise exception 'UAT active ERP reservation mismatch';
  end if;

  if (select count(*) from erp_supply.inventory_reservations where status='CLOSED' and quantity=10)<>1 then
    raise exception 'UAT consumed legacy reservation history mismatch';
  end if;

  select * into strict v_shipment
  from erp_supply.logistics_shipments
  where order_id=v_closed.id;

  if v_shipment.status<>'DELIVERED'
     or v_shipment.actual_freight<>1000
     or v_shipment.delivered_at is null then
    raise exception 'UAT migrated delivered shipment mismatch';
  end if;

  if exists(
    select 1 from erp_supply.logistics_shipments
    where order_id=v_active.id
  ) then
    raise exception 'UAT active order acquired artificial shipment';
  end if;

  if (select count(*) from erp_supply.inventory_movements
      where metadata->>'migrationSource'='CRM-SUMINISTROS'
        and metadata->>'historicalOnly'='true')<>1 then
    raise exception 'UAT classified inventory movement history mismatch';
  end if;

  if exists(
    select 1 from erp_supply.inventory_movements
    where metadata->>'migrationSource'='CRM-SUMINISTROS'
      and metadata->>'historicalOnly'='true'
      and reason<>'LEGACY_HISTORY_NO_BALANCE_REPLAY'
  ) then
    raise exception 'UAT historical movement replay guard missing';
  end if;

  if (select count(*) from erp_supply.workforce_activities
      where metadata->>'migrationSource'='CRM-SUMINISTROS')<>2 then
    raise exception 'UAT workforce activity mapping mismatch';
  end if;

  if (select count(*) from erp_supply.workforce_activity_events
      where idempotency_key like 'legacy-execution:%')<>2 then
    raise exception 'UAT workforce execution event idempotency mismatch';
  end if;

  if (select count(*) from erp_supply.workforce_activity_evidence
      where metadata->>'migrationSource'='CRM-SUMINISTROS')<>1 then
    raise exception 'UAT workforce evidence mapping mismatch';
  end if;

  if not exists(
    select 1 from erp_supply.workforce_activities
    where id='00000000-0000-0000-0000-000000001301'
      and status='IN_PROGRESS'
      and source='PLANNED'
  ) then
    raise exception 'UAT planned workforce state mismatch';
  end if;

  if not exists(
    select 1 from erp_supply.workforce_activities
    where id='00000000-0000-0000-0000-000000001402'
      and status='COMPLETED'
      and source='MANUAL'
      and actual_end is not null
  ) then
    raise exception 'UAT manual workforce execution mismatch';
  end if;

  if (select count(*) from erp_supply.audit_events
      where request_id like 'legacy-audit:%')<>2 then
    raise exception 'UAT legacy audit selection mismatch';
  end if;

  if exists(
    select 1 from erp_supply.audit_events where request_id='legacy-audit:2'
  ) then
    raise exception 'UAT stale noncritical audit event should remain archive-only';
  end if;

  if not exists(
    select 1 from erp_supply.audit_events
    where request_id='legacy-audit:3'
      and actor_kind='SYSTEM'
      and metadata->>'legacyOrganizationMissing'='true'
  ) then
    raise exception 'UAT critical audit fallback mapping mismatch';
  end if;

  raise notice 'PASS migrated UAT: operational + classified migration semantics preserved';
end $$;
