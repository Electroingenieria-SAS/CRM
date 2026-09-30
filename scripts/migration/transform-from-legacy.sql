\set ON_ERROR_STOP on

begin;

create extension if not exists postgres_fdw;

drop schema if exists migration_legacy cascade;
drop server if exists hilo15_legacy cascade;
create schema migration_legacy;

create server hilo15_legacy
foreign data wrapper postgres_fdw
options (host '127.0.0.1', port '5432', dbname :'legacy_db_name');

create user mapping for current_user
server hilo15_legacy
options (user 'postgres', password 'postgres');

import foreign schema erp_supply
limit to (
  organizations,profiles,profile_roles,orders,order_items,order_tasks,invoices,
  material_master,material_variants,inventory_items,inventory_lots,material_reservations,deliveries
)
from server hilo15_legacy into migration_legacy;

do $$
declare
  v_source_org migration_legacy.organizations%rowtype;
  v_target_org uuid;
begin
  select * into strict v_source_org from migration_legacy.organizations order by created_at limit 1;

  insert into erp_supply.organizations(code,name,timezone,active,settings,created_at,updated_at)
  values(
    v_source_org.code,v_source_org.name,v_source_org.timezone,v_source_org.active,
    v_source_org.settings,v_source_org.created_at,v_source_org.updated_at
  )
  on conflict(code) do update set
    name=excluded.name,
    timezone=excluded.timezone,
    active=excluded.active,
    settings=excluded.settings,
    updated_at=excluded.updated_at;

  select id into strict v_target_org from erp_supply.organizations where code=v_source_org.code;

  delete from erp_supply.profiles where preferences->>'synthetic'='true';

  insert into erp_supply.profiles(
    id,organization_id,auth_user_id,email,display_name,employee_code,active,is_system,
    preferences,created_at,updated_at
  )
  select
    p.id,v_target_org,null,lower(p.email),p.display_name,p.employee_code,p.active,p.is_system,
    coalesce(p.preferences,'{}'::jsonb) ||
      jsonb_build_object(
        'migrationSource','CRM-SUMINISTROS',
        'legacyAuthUserId',case when p.auth_user_id is null then null else p.auth_user_id::text end
      ),
    p.created_at,p.updated_at
  from migration_legacy.profiles p
  on conflict(id) do update set
    email=excluded.email,
    display_name=excluded.display_name,
    employee_code=excluded.employee_code,
    active=excluded.active,
    is_system=excluded.is_system,
    preferences=excluded.preferences,
    updated_at=excluded.updated_at;

  insert into erp_supply.profile_roles(profile_id,role_code,is_primary,granted_at,granted_by)
  select pr.profile_id,pr.role_code,pr.is_primary,pr.granted_at,pr.granted_by
  from migration_legacy.profile_roles pr
  join erp_supply.roles r on r.code=pr.role_code
  on conflict(profile_id,role_code) do update set
    is_primary=excluded.is_primary,
    granted_at=excluded.granted_at,
    granted_by=excluded.granted_by;

  insert into erp_supply.material_master(
    id,organization_id,reference,name,unit,attributes,active,created_at,updated_at
  )
  select
    m.id,v_target_org,m.reference,m.exact_name,m.unit,
    coalesce(m.attributes,'{}'::jsonb) ||
      jsonb_build_object('migrationSource','CRM-SUMINISTROS','legacyWeight',m.weight),
    m.active,m.created_at,m.updated_at
  from migration_legacy.material_master m
  on conflict(id) do update set
    reference=excluded.reference,
    name=excluded.name,
    unit=excluded.unit,
    attributes=excluded.attributes,
    active=excluded.active,
    updated_at=excluded.updated_at;

  insert into erp_supply.material_variants(
    id,organization_id,material_id,code,label,attributes,active,created_at,updated_at
  )
  select
    v.id,v_target_org,v.material_master_id,v.normalized_label,v.variant_label,
    coalesce(v.metadata,'{}'::jsonb) || jsonb_build_object('migrationSource','CRM-SUMINISTROS'),
    v.active,v.created_at,v.updated_at
  from migration_legacy.material_variants v
  on conflict(id) do update set
    code=excluded.code,
    label=excluded.label,
    attributes=excluded.attributes,
    active=excluded.active,
    updated_at=excluded.updated_at;

  insert into erp_supply.orders(
    id,organization_id,order_number,external_reference,order_type_code,payment_condition_code,
    delivery_route_code,client_name,client_document,client_city,client_address,client_phone,
    seller_profile_id,current_step_code,status,priority,requires_cut,requires_purchase,
    current_assignee_id,current_role_code,promised_at,requested_delivery_date,source,is_history,
    is_test,version,metadata,created_at,updated_at,closed_at,cancelled_at
  )
  select
    o.id,v_target_org,o.order_number,o.external_reference,o.order_type_code,o.payment_condition_code,
    o.delivery_route_code,o.client_name,o.client_document,o.client_city,o.client_address,o.client_phone,
    o.seller_profile_id,o.current_step_code,o.status,o.priority,o.requires_cut,o.requires_purchase,
    o.current_assignee_id,o.current_role_code,o.promised_at,o.requested_delivery_date,o.source,
    o.is_history,o.is_test,o.version,
    coalesce(o.metadata,'{}'::jsonb) || jsonb_build_object('migrationSource','CRM-SUMINISTROS'),
    o.created_at,o.updated_at,o.closed_at,o.cancelled_at
  from migration_legacy.orders o
  on conflict(id) do update set
    current_step_code=excluded.current_step_code,
    status=excluded.status,
    priority=excluded.priority,
    current_assignee_id=excluded.current_assignee_id,
    current_role_code=excluded.current_role_code,
    version=excluded.version,
    metadata=excluded.metadata,
    updated_at=excluded.updated_at,
    closed_at=excluded.closed_at,
    cancelled_at=excluded.cancelled_at;

  insert into erp_supply.order_items(
    id,order_id,line_number,sku,reference,description,quantity,unit,warehouse_location,
    requires_cut,requested_cut_length,dimensions,item_status,metadata,created_at,updated_at
  )
  select
    i.id,i.order_id,i.line_number,i.sku,i.reference,i.description,i.quantity,i.unit,
    i.warehouse_location,i.requires_cut,i.requested_cut_length,coalesce(i.dimensions,'{}'::jsonb),
    i.item_status,
    coalesce(i.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'migrationSource','CRM-SUMINISTROS',
        'legacyMaterialMasterId',case when i.material_master_id is null then null else i.material_master_id::text end,
        'legacyMaterialVariantId',case when i.material_variant_id is null then null else i.material_variant_id::text end
      ),
    i.created_at,i.updated_at
  from migration_legacy.order_items i
  on conflict(id) do update set
    item_status=excluded.item_status,
    metadata=excluded.metadata,
    updated_at=excluded.updated_at;

  insert into erp_supply.order_tasks(
    id,order_id,step_code,sequence_no,queue_code,status,assigned_profile_id,assigned_role_code,
    created_at,assigned_at,started_at,completed_at,blocked_at,raw_seconds,business_seconds,
    result_code,result_detail,metadata
  )
  select
    t.id,t.order_id,t.step_code,t.sequence_no,t.queue_code,t.status,t.assigned_profile_id,
    t.assigned_role_code,t.created_at,t.assigned_at,t.started_at,t.completed_at,t.blocked_at,
    t.raw_seconds,t.business_seconds,t.result_code,t.result_detail,
    coalesce(t.metadata,'{}'::jsonb) || jsonb_build_object('migrationSource','CRM-SUMINISTROS')
  from migration_legacy.order_tasks t
  on conflict(id) do update set
    status=excluded.status,
    assigned_profile_id=excluded.assigned_profile_id,
    assigned_role_code=excluded.assigned_role_code,
    assigned_at=excluded.assigned_at,
    started_at=excluded.started_at,
    completed_at=excluded.completed_at,
    blocked_at=excluded.blocked_at,
    raw_seconds=excluded.raw_seconds,
    business_seconds=excluded.business_seconds,
    result_code=excluded.result_code,
    result_detail=excluded.result_detail,
    metadata=excluded.metadata;

  insert into erp_supply.invoices(
    id,organization_id,order_id,invoice_number,invoice_date,amount,currency,status,
    registered_by,metadata,created_at,updated_at
  )
  select
    i.id,v_target_org,i.order_id,i.invoice_number,i.invoice_date,i.amount,i.currency,
    case when i.status in('REGISTERED','PARTIALLY_REVERSED','REVERSED','VOID') then i.status else 'REGISTERED' end,
    i.registered_by,
    coalesce(i.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'migrationSource','CRM-SUMINISTROS',
        'packageWeightKg',i.package_weight_kg,
        'packageQuantity',i.package_quantity,
        'weightPerUnitKg',i.weight_per_unit_kg
      ),
    i.created_at,i.created_at
  from migration_legacy.invoices i
  where i.amount>0
  on conflict(id) do nothing;

  update erp_supply.orders o
  set metadata=o.metadata || jsonb_build_object(
    'legacyInvoiceReferences',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,
        'invoiceNumber',i.invoice_number,
        'invoiceDate',i.invoice_date,
        'metadata',i.metadata
      ) order by i.created_at)
      from migration_legacy.invoices i
      where i.order_id=o.id and (i.amount is null or i.amount<=0)
    ),'[]'::jsonb)
  )
  where exists(
    select 1 from migration_legacy.invoices i
    where i.order_id=o.id and (i.amount is null or i.amount<=0)
  );

  insert into erp_supply.inventory_locations(
    id,organization_id,code,name,location_type,metadata,active
  )
  select
    (
      substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),1,8)||'-'||
      substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),9,4)||'-'||
      substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),13,4)||'-'||
      substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),17,4)||'-'||
      substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),21,12)
    )::uuid,
    v_target_org,
    'LEGACY-'||substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),1,20),
    coalesce(max(nullif(l.source_location_name,'')),max(nullif(l.warehouse_code,''))||' / '||l.location,l.location),
    'AREA',
    jsonb_build_object(
      'migrationSource','CRM-SUMINISTROS',
      'warehouseCode',max(l.warehouse_code),
      'legacyLocation',l.location
    ),
    true
  from migration_legacy.inventory_lots l
  join migration_legacy.inventory_items i on i.id=l.inventory_item_id
  where i.active and coalesce(l.source_active,true)
  group by coalesce(l.warehouse_code,''),l.location
  on conflict(organization_id,code) do nothing;

  insert into erp_supply.inventory_balances(
    organization_id,material_id,variant_id,location_id,on_hand,reserved,committed,version,updated_at
  )
  select
    v_target_org,
    i.material_master_id,
    l.material_variant_id,
    loc.id,
    sum(l.quantity_available+l.quantity_reserved+l.quantity_blocked),
    0,
    sum(l.quantity_reserved+l.quantity_blocked),
    1,
    now()
  from migration_legacy.inventory_lots l
  join migration_legacy.inventory_items i on i.id=l.inventory_item_id
  join erp_supply.inventory_locations loc
    on loc.organization_id=v_target_org
   and loc.code='LEGACY-'||substr(md5(coalesce(l.warehouse_code,'')||'|'||l.location),1,20)
  where i.active and coalesce(l.source_active,true)
  group by i.material_master_id,l.material_variant_id,loc.id
  on conflict(organization_id,material_id,variant_id,location_id)
  do update set
    on_hand=excluded.on_hand,
    reserved=0,
    committed=excluded.committed,
    version=erp_supply.inventory_balances.version+1,
    updated_at=now();

  insert into erp_supply.inventory_reservations(
    id,organization_id,order_id,material_id,variant_id,quantity,unit,status,reference,
    created_by,created_at,updated_at,closed_at,metadata
  )
  select
    r.id,v_target_org,r.order_id,r.material_master_id,r.material_variant_id,r.quantity,r.unit,
    case r.status when 'ACTIVE' then 'ACTIVE' when 'CONSUMED' then 'CLOSED' else 'RELEASED' end,
    'LEGACY:'||r.order_item_id::text,
    coalesce(r.created_by,o.seller_profile_id),
    r.created_at,r.updated_at,
    case when r.status='CONSUMED' then coalesce(r.consumed_at,r.updated_at)
         when r.status='RELEASED' then coalesce(r.released_at,r.updated_at)
         else null end,
    coalesce(r.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'migrationSource','CRM-SUMINISTROS',
        'legacyStatus',r.status,
        'legacyOrderItemId',r.order_item_id,
        'shortageQuantity',r.shortage_quantity
      )
  from migration_legacy.material_reservations r
  join migration_legacy.orders o on o.id=r.order_id
  on conflict(id) do nothing;

  insert into erp_supply.logistics_shipments(
    id,organization_id,order_id,route_code,status,tracking_number,actual_freight,
    freight_sync_status,released_by,released_at,dispatched_by,dispatched_at,
    delivered_by,delivered_at,received_by,return_reason,version,metadata,created_at,updated_at
  )
  select
    d.id,v_target_org,d.order_id,d.route_code,
    case d.status
      when 'PLANNED' then 'READY'
      when 'REPROGRAMMED' then 'READY'
      when 'DISPATCHED' then 'IN_TRANSIT'
      when 'IN_TRANSIT' then 'IN_TRANSIT'
      when 'DELIVERED' then 'DELIVERED'
      when 'NOT_DELIVERED' then 'DELIVERY_FAILED'
      when 'CANCELLED' then 'CANCELLED'
    end,
    d.tracking_number,d.carrier_cost,'NOT_REQUIRED',
    coalesce(d.assigned_profile_id,o.current_assignee_id,o.seller_profile_id),
    coalesce(d.scheduled_at,d.dispatched_at,d.created_at),
    case when d.status in('DISPATCHED','IN_TRANSIT','DELIVERED','NOT_DELIVERED')
      then coalesce(d.assigned_profile_id,o.current_assignee_id,o.seller_profile_id) end,
    d.dispatched_at,
    case when d.status='DELIVERED'
      then coalesce(d.assigned_profile_id,o.current_assignee_id,o.seller_profile_id) end,
    d.delivered_at,d.received_by,d.no_delivery_reason,1,
    coalesce(d.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'migrationSource','CRM-SUMINISTROS',
        'legacyCarrier',d.carrier,
        'carrierInvoiceNumber',d.carrier_invoice_number,
        'carrierCostCurrency',d.carrier_cost_currency,
        'distanceKm',d.distance_km,
        'distanceSource',d.distance_source,
        'satisfactionStatus',d.satisfaction_status,
        'satisfactionNote',d.satisfaction_note
      ),
    d.created_at,d.updated_at
  from migration_legacy.deliveries d
  join migration_legacy.orders o on o.id=d.order_id
  on conflict(id) do nothing;

  perform set_config('hilo15.target_org',v_target_org::text,true);
end $$;

do $$
declare
  v_res record;
  v_bal record;
  v_remaining numeric;
  v_take numeric;
begin
  for v_res in
    select r.*
    from erp_supply.inventory_reservations r
    where r.status='ACTIVE'
      and r.metadata->>'migrationSource'='CRM-SUMINISTROS'
    order by r.created_at,r.id
  loop
    v_remaining:=v_res.quantity;

    for v_bal in
      select b.*
      from erp_supply.inventory_balances b
      where b.organization_id=v_res.organization_id
        and b.material_id=v_res.material_id
        and b.variant_id is not distinct from v_res.variant_id
        and b.on_hand-b.reserved-b.committed>0
      order by (b.on_hand-b.reserved-b.committed) desc,b.id
      for update
    loop
      v_take:=least(v_remaining,v_bal.on_hand-v_bal.reserved-v_bal.committed);
      if v_take<=0 then continue; end if;

      update erp_supply.inventory_balances
      set reserved=reserved+v_take,version=version+1,updated_at=now()
      where id=v_bal.id;

      insert into erp_supply.inventory_reservation_allocations(
        organization_id,reservation_id,balance_id,location_id,quantity
      ) values(
        v_res.organization_id,v_res.id,v_bal.id,v_bal.location_id,v_take
      );

      v_remaining:=v_remaining-v_take;
      exit when v_remaining<=0;
    end loop;

    if v_remaining>0 then
      raise exception 'Reserva legacy % no puede asignarse: faltan % unidades',v_res.id,v_remaining;
    end if;
  end loop;
end $$;

drop schema migration_legacy cascade;
drop server hilo15_legacy cascade;

commit;
