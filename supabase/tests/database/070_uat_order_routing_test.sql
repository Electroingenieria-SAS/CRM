begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (select count(*)::integer from erp_supply.order_types
   where active and code in ('PVC','PVN','PVE','PVP')),
  4,
  'UAT14 catalogs expose PVC, PVN, PVE and PVP'
);

select is(
  (select count(*)::integer from erp_supply.payment_conditions
   where active and code in ('CREDIT','CASH','MIXED')),
  3,
  'UAT14 catalogs expose CREDIT, CASH and MIXED'
);

select is(
  (select count(*)::integer from erp_supply.delivery_routes
   where active and code in ('CLIENT_POINT','CLIENT_PICKUP','LOCAL_DISPATCH','NATIONAL_DISPATCH')),
  4,
  'UAT14 catalogs expose the four certified delivery routes'
);

select is(
  erp_supply.initial_step('PVC','CASH',false,false,false),
  'RECEPCION_PEDIDO',
  'PVC without financial hold or purchase starts in reception'
);

select is(
  erp_supply.initial_step('PVC','CREDIT',false,true,false),
  'CARTERA',
  'PVC with credit arrears starts in receivables'
);

select is(
  erp_supply.initial_step('PVP','CREDIT',false,true,false),
  'CARTERA',
  'PVP with credit arrears starts in receivables'
);

select is(
  erp_supply.initial_step('PVN','CASH',false,false,true),
  'CAJA',
  'PVN held by cashier starts in cash validation'
);

select is(
  erp_supply.initial_step('PVE','CASH',false,false,false),
  'COMPRAS',
  'PVE starts in purchasing even without an explicit purchase flag'
);

select is(
  erp_supply.initial_step('PVC','CASH',true,false,false),
  'COMPRAS',
  'explicit purchase requirement routes a commercial order to purchasing'
);

select is(
  erp_supply.initial_step('PVN','MIXED',false,false,false),
  'RECEPCION_PEDIDO',
  'PVN without hold or purchase proceeds to reception'
);

select * from finish();
rollback;
