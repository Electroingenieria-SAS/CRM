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

  raise notice 'PASS migrated UAT: order/invoice/inventory/logistics semantics preserved';
end $$;
