\set ON_ERROR_STOP on

insert into erp_supply.inventory_locations(id,organization_id,code,name,location_type)
select 'a1000000-0000-4000-8000-000000000001',o.id,'BOD-A','Bodega principal','WAREHOUSE'
from erp_supply.organizations o where o.code='EI'
on conflict (organization_id,code) do nothing;

insert into erp_supply.inventory_locations(id,organization_id,code,name,location_type,parent_id)
select 'a1000000-0000-4000-8000-000000000002',o.id,'BOD-A-Z1','Zona 1','ZONE',
       'a1000000-0000-4000-8000-000000000001'
from erp_supply.organizations o where o.code='EI'
on conflict (organization_id,code) do nothing;

insert into erp_supply.material_master(id,organization_id,reference,name,unit,attributes)
select v.id,o.id,v.reference,v.name,v.unit,v.attributes
from erp_supply.organizations o
cross join (
  values
    ('a2000000-0000-4000-8000-000000000001'::uuid,'INV-E2E-CABLE','Cable E2E','M','{"family":"CABLE"}'::jsonb),
    ('a2000000-0000-4000-8000-000000000002'::uuid,'INV-CONC-RESERVE','Reserva concurrencia','UND','{}'::jsonb),
    ('a2000000-0000-4000-8000-000000000003'::uuid,'INV-CONC-MIXED','Reserva consumo simultáneo','UND','{}'::jsonb),
    ('a2000000-0000-4000-8000-000000000004'::uuid,'INV-CONC-RETURN','Devolución idempotente','UND','{}'::jsonb),
    ('a2000000-0000-4000-8000-000000000005'::uuid,'INV-CONC-RECEIPT','Recepción idempotente','UND','{}'::jsonb)
) v(id,reference,name,unit,attributes)
where o.code='EI'
on conflict (organization_id,reference) do nothing;

insert into erp_supply.material_variants(
  id,organization_id,material_id,code,label,attributes
)
select
  'a3000000-0000-4000-8000-000000000001',
  o.id,
  'a2000000-0000-4000-8000-000000000001',
  'RED',
  'Rojo',
  '{"color":"Rojo"}'::jsonb
from erp_supply.organizations o where o.code='EI'
on conflict (organization_id,material_id,code) do nothing;

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,priority,source,is_test
)
select v.id,o.id,v.order_number,'PVC','CASH','LOCAL_DISPATCH',
       'Cliente Inventario QA','Cali','Calle Inventario QA',
       '93000000-0000-4000-8000-000000000001','ALISTAMIENTO',
       'QUEUED','MEDIUM','QA_BOT',true
from erp_supply.organizations o
cross join (
  values
    ('a4000000-0000-4000-8000-000000000001'::uuid,'INV-E2E-ORDER'),
    ('a4000000-0000-4000-8000-000000000002'::uuid,'INV-CONC-A'),
    ('a4000000-0000-4000-8000-000000000003'::uuid,'INV-CONC-B'),
    ('a4000000-0000-4000-8000-000000000004'::uuid,'INV-CONC-C')
) v(id,order_number)
where o.code='EI'
on conflict (organization_id,order_number) do nothing;

insert into erp_supply.inventory_operations(
  id,organization_id,operation_key,operation_type,actor_profile_id,result,completed_at
)
select
  v.id,o.id,v.operation_key,'FIXTURE_RECEIPT',
  '93000000-0000-4000-8000-000000000004',
  jsonb_build_object('fixture',true),now()
from erp_supply.organizations o
cross join (
  values
    ('a5000000-0000-4000-8000-000000000001'::uuid,'fixture-inv-e2e-cable'),
    ('a5000000-0000-4000-8000-000000000002'::uuid,'fixture-inv-conc-reserve'),
    ('a5000000-0000-4000-8000-000000000003'::uuid,'fixture-inv-conc-mixed'),
    ('a5000000-0000-4000-8000-000000000004'::uuid,'fixture-inv-conc-return')
) v(id,operation_key)
where o.code='EI'
on conflict (organization_id,operation_key) do nothing;

insert into erp_supply.inventory_balances(
  id,organization_id,material_id,variant_id,location_id,on_hand,reserved,committed
)
select
  v.balance_id,o.id,v.material_id,v.variant_id,
  'a1000000-0000-4000-8000-000000000001',v.quantity,0,0
from erp_supply.organizations o
cross join (
  values
    ('a6000000-0000-4000-8000-000000000001'::uuid,'a2000000-0000-4000-8000-000000000001'::uuid,'a3000000-0000-4000-8000-000000000001'::uuid,20::numeric),
    ('a6000000-0000-4000-8000-000000000002'::uuid,'a2000000-0000-4000-8000-000000000002'::uuid,null::uuid,10::numeric),
    ('a6000000-0000-4000-8000-000000000003'::uuid,'a2000000-0000-4000-8000-000000000003'::uuid,null::uuid,10::numeric),
    ('a6000000-0000-4000-8000-000000000004'::uuid,'a2000000-0000-4000-8000-000000000004'::uuid,null::uuid,10::numeric)
) v(balance_id,material_id,variant_id,quantity)
where o.code='EI'
on conflict on constraint inventory_balances_identity do nothing;

insert into erp_supply.inventory_movements(
  id,organization_id,operation_id,material_id,variant_id,location_id,
  movement_type,quantity,unit,on_hand_delta,reserved_delta,committed_delta,
  actor_profile_id,reference,reason,metadata
)
select
  v.movement_id,o.id,v.operation_id,v.material_id,v.variant_id,
  'a1000000-0000-4000-8000-000000000001',
  'RECEIPT',v.quantity,v.unit,v.quantity,0,0,
  '93000000-0000-4000-8000-000000000004',
  'SYNTHETIC_FIXTURE','Saldo inicial sintético','{"fixture":true}'::jsonb
from erp_supply.organizations o
cross join (
  values
    ('a7000000-0000-4000-8000-000000000001'::uuid,'a5000000-0000-4000-8000-000000000001'::uuid,'a2000000-0000-4000-8000-000000000001'::uuid,'a3000000-0000-4000-8000-000000000001'::uuid,20::numeric,'M'),
    ('a7000000-0000-4000-8000-000000000002'::uuid,'a5000000-0000-4000-8000-000000000002'::uuid,'a2000000-0000-4000-8000-000000000002'::uuid,null::uuid,10::numeric,'UND'),
    ('a7000000-0000-4000-8000-000000000003'::uuid,'a5000000-0000-4000-8000-000000000003'::uuid,'a2000000-0000-4000-8000-000000000003'::uuid,null::uuid,10::numeric,'UND'),
    ('a7000000-0000-4000-8000-000000000004'::uuid,'a5000000-0000-4000-8000-000000000004'::uuid,'a2000000-0000-4000-8000-000000000004'::uuid,null::uuid,10::numeric,'UND')
) v(movement_id,operation_id,material_id,variant_id,quantity,unit)
where o.code='EI'
on conflict (id) do nothing;
