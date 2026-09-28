insert into erp_supply.organizations(code,name,timezone,settings)
values ('EI','Electroingeniería S.A.S.','America/Bogota','{"currency":"COP","locale":"es-CO"}'::jsonb)
on conflict (code) do nothing;

insert into erp_supply.roles(code,name,description,system_role,active) values
('auditoria','Auditoría','Lectura integral sin operación',true,true),
('aux_logistica','Auxiliar de logística','Alistamiento y preparación de pedidos',true,true),
('auxiliar_corte','Auxiliar de corte','Prealistamiento y corte de materiales',true,true),
('caja','Caja','Validación de pagos y soportes',true,true),
('cartera','Cartera','Validación de crédito y liberación financiera',true,true),
('compras','Compras','Gestión de PVE, proveedores y órdenes de compra',true,true),
('coordinador_logistico','Coordinación logística','Recepción documental, facturación y rutas locales',true,true),
('despacho_nacional','Despacho nacional','Facturación y despachos nacionales',true,false),
('gerencia','Gerencia','Lectura integral, aprobaciones y control ejecutivo',true,true),
('jefe_logistica','Jefatura logística','Supervisión de la operación y excepciones',true,true),
('lider_logistica','Líder logístico','Liderazgo operativo del equipo logístico',true,true),
('recepcion_mercancia','Recepción de mercancía','Recepción física, calidad y stickers',true,true),
('super_admin','Superadministración','Control total, configuración y pruebas',true,true),
('ventas','Ventas','Registro y seguimiento de pedidos propios',true,true)
on conflict (code) do nothing;

insert into erp_supply.modules(code,name,description,icon,sort_order,active) values
('dashboard','Centro de operación','KPIs, alertas y cuellos de botella','layout-dashboard',10,true),
('orders','Control de pedidos','Registro, consulta y trazabilidad total','clipboard-list',20,true),
('sales','Registro de ventas','Creación y control comercial','badge-dollar-sign',30,true),
('credit','Crédito','Solicitudes y decisiones de crédito','landmark',40,true),
('cartera','Cartera','Liberaciones de cartera y riesgo','wallet-cards',50,true),
('caja','Caja','Validación de pagos','banknote',60,true),
('purchasing','Compras','Órdenes PVE, proveedores y abastecimiento','shopping-cart',70,true),
('receiving','Recepción','Recepción documental y física','package-check',80,true),
('picking','Alistamiento','Picking, checklist y novedades','list-checks',90,true),
('cutting','Corte','Colas de corte, chipas y desperdicio','scissors',100,true),
('billing','Facturación','Facturas, soportes y liberación','receipt-text',110,true),
('shipping','Despachos','Rutas locales, nacionales y recogidas','truck',120,true),
('freight','Inteligencia de fletes','Predicción explicable, histórico y aprendizaje de costos','route',125,true),
('inventory','Inventario','Existencias, lotes, ubicaciones y movimientos','boxes',130,true),
('workforce','Mi jornada y actividades','Actividades, planificación y evidencias','timer',135,true),
('approvals','Aprobaciones','Excepciones, cancelaciones y reaperturas','shield-check',140,true),
('vsm','VSM y tiempos','Lead time, tiempos productivos y esperas','activity',150,true),
('reports','Reportes','Indicadores y exportaciones','chart-no-axes-combined',160,true),
('imports','Importaciones','Carga histórica por CSV','file-up',170,true),
('audit','Auditoría','Eventos, cambios y evidencias','scan-search',190,true),
('admin','Administración','Usuarios, roles, calendarios y reglas','settings',200,true)
on conflict (code) do nothing;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
) values
('auditoria','orders',true,false,false,false,false),
('auditoria','sales',true,false,false,false,false),
('auditoria','audit',true,false,false,false,false),
('auditoria','admin',true,false,false,false,false),
('aux_logistica','orders',true,false,false,false,false),
('auxiliar_corte','orders',true,false,false,false,false),
('caja','orders',true,false,false,false,false),
('cartera','orders',true,false,false,false,false),
('compras','orders',true,false,false,false,false),
('coordinador_logistico','orders',true,false,true,true,false),
('gerencia','orders',true,false,false,true,false),
('gerencia','sales',true,false,false,true,false),
('gerencia','audit',true,false,false,false,false),
('gerencia','admin',true,false,false,false,false),
('jefe_logistica','orders',true,false,false,true,false),
('jefe_logistica','audit',true,false,false,false,false),
('lider_logistica','orders',true,false,true,true,false),
('recepcion_mercancia','orders',true,false,false,false,false),
('ventas','orders',true,true,true,false,false),
('ventas','sales',true,true,true,false,false),
('ventas','freight',true,true,false,false,false),
('auditoria','freight',true,false,false,false,false),
('aux_logistica','freight',true,true,false,false,false),
('coordinador_logistico','freight',true,true,true,false,false),
('lider_logistica','freight',true,true,true,false,false),
('jefe_logistica','freight',true,true,true,true,false),
('gerencia','freight',true,true,false,true,false)
on conflict (role_code,module_code) do nothing;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select 'super_admin',m.code,true,true,true,true,true
from erp_supply.modules m
on conflict (role_code,module_code) do nothing;

insert into erp_supply.order_types(code,name,description,requires_purchase_default,active,sort_order) values
('PVC','PVC','Pedido comercial con validación de crédito',false,true,10),
('PVN','PVN','Pedido con despacho de cobertura nacional',false,true,20),
('PVE','PVE','Pedido sujeto a abastecimiento o compra',true,true,30),
('PVP','PVP','Pedido asociado a proyecto o suministro especial',false,true,40)
on conflict (code) do nothing;

insert into erp_supply.payment_conditions(code,name,requires_cartera,requires_caja,active,sort_order) values
('CREDIT','Crédito',true,false,true,10),
('CASH','Contado',false,true,true,20),
('MIXED','Mixto',true,true,true,30)
on conflict (code) do nothing;

insert into erp_supply.delivery_routes(code,name,route_group,active,sort_order) values
('CLIENT_POINT','Entrega en punto','POINT',true,10),
('CLIENT_PICKUP','Cliente recoge','PICKUP',true,20),
('LOCAL_DISPATCH','Despacho local','LOCAL',true,30),
('NATIONAL_DISPATCH','Despacho nacional','NATIONAL',true,40)
on conflict (code) do nothing;

insert into erp_supply.workflow_steps(
  code,name,module_code,queue_code,sla_hours,sort_order,terminal,active,metadata
) values
('CARTERA','Validación de cartera','cartera','CARTERA',4,10,false,true,'{"phase":"financial"}'),
('CAJA','Validación de caja','caja','CAJA',2,20,false,true,'{"phase":"financial"}'),
('COMPRAS','Gestión de compras','purchasing','COMPRAS',24,30,false,true,'{"phase":"supply"}'),
('RECEPCION_PEDIDO','Recepción documental y asignación','receiving','RECEPCION_PEDIDO',2,50,false,true,'{"phase":"inbound"}'),
('ALISTAMIENTO','Alistamiento','picking','ALISTAMIENTO',8,60,false,true,'{"phase":"warehouse"}'),
('CORTE','Corte y prealistamiento','cutting','CORTE',8,70,false,true,'{"phase":"warehouse"}'),
('CAJA_FACTURACION','Facturación en Caja','caja','CAJA',4,75,false,true,'{"phase":"outbound","orderType":"PVN"}'),
('FACTURACION','Facturación','billing','FACTURACION',4,80,false,true,'{"phase":"outbound"}'),
('CLIENT_POINT','Entrega en punto','shipping','CLIENT_POINT',4,90,false,true,'{"phase":"delivery"}'),
('CLIENT_PICKUP','Cliente recoge','shipping','CLIENT_PICKUP',8,100,false,true,'{"phase":"delivery"}'),
('LOCAL_DISPATCH','Despacho local','shipping','LOCAL_DISPATCH',8,110,false,true,'{"phase":"delivery"}'),
('NATIONAL_DISPATCH','Despacho nacional','shipping','NATIONAL_DISPATCH',24,120,false,true,'{"phase":"delivery"}'),
('CLOSURE','Cierre y verificación','shipping','CLOSURE',2,130,false,true,'{"phase":"closure"}'),
('CLOSED','Pedido cerrado','orders','CLOSED',null,140,true,true,'{"phase":"terminal"}')
on conflict (code) do nothing;


-- Synthetic profile used only by local/CI integration tests.
insert into erp_supply.profiles(
  organization_id,email,display_name,employee_code,active,is_system,preferences
)
select id,'e2e.sales@example.test','Ventas E2E','E2E-VENTAS',true,false,'{"synthetic":true}'::jsonb
from erp_supply.organizations
where code='EI'
on conflict (organization_id,email) do nothing;

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
select p.id,'ventas',true
from erp_supply.profiles p
where p.email='e2e.sales@example.test'
on conflict (profile_id,role_code) do nothing;

create or replace function public.e2e_bind_user(
  p_email text,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, erp_supply
as $$
begin
  update erp_supply.profiles
  set auth_user_id=p_auth_user_id,
      updated_at=now()
  where email=lower(trim(p_email))
    and preferences->>'synthetic'='true';

  if not found then
    raise exception 'Synthetic E2E profile not found';
  end if;
end;
$$;

revoke all on function public.e2e_bind_user(text,uuid) from public,anon,authenticated;
grant execute on function public.e2e_bind_user(text,uuid) to service_role;
