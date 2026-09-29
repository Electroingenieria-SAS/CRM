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
('customer_intelligence','Inteligencia de clientes','Ranking, Pareto y segmentación automática por pedidos y valor pagado','chart-spline',35,true),
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
('assistant','PACO','Asistente operativo guiado y alertas','message-circle',180,true),
('audit','Auditoría','Eventos, cambios y evidencias','scan-search',190,true),
('admin','Administración','Usuarios, roles, calendarios y reglas','settings',200,true)
on conflict (code) do nothing;

-- Administrative MFA policy.
insert into erp_supply.security_role_policies(
  role_code,require_mfa,sensitive_admin
) values
('super_admin',true,true)
on conflict (role_code) do update set
  require_mfa=excluded.require_mfa,
  sensitive_admin=excluded.sensitive_admin,
  updated_at=now();

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'assistant',true,true,true,false,(r.code='super_admin')
from erp_supply.roles r
where r.active
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_admin=excluded.can_admin;

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
('gerencia','freight',true,true,false,true,false),
('ventas','credit',true,true,false,false,false),
('cartera','credit',true,false,true,true,false),
('cartera','cartera',true,true,true,true,false),
('cartera','approvals',true,true,false,false,false),
('caja','caja',true,true,true,false,false),
('caja','billing',true,true,true,false,false),
('caja','approvals',true,true,false,false,false),
('gerencia','credit',true,false,false,true,false),
('gerencia','cartera',true,false,false,true,false),
('gerencia','caja',true,false,false,true,false),
('gerencia','approvals',true,true,true,true,false),
('auditoria','credit',true,false,false,false,false),
('auditoria','cartera',true,false,false,false,false),
('auditoria','caja',true,false,false,false,false),
('auditoria','approvals',true,false,false,false,false),
('ventas','customer_intelligence',true,false,false,false,false),
('gerencia','customer_intelligence',true,false,false,false,false),
('auditoria','customer_intelligence',true,false,false,false,false),
('jefe_logistica','customer_intelligence',true,false,false,false,false)
on conflict (role_code,module_code) do nothing;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select
  r.code,
  'workforce',
  true,
  true,
  true,
  r.code in ('super_admin','gerencia','jefe_logistica','lider_logistica'),
  r.code in ('super_admin','gerencia','jefe_logistica','lider_logistica')
from erp_supply.roles r
where r.active
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

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


insert into erp_supply.customer_intelligence_algorithm_versions(
  organization_id,version,order_weight,paid_weight,
  normal_min_score,premium_min_score,urgent_min_score,
  minimum_population_clients,minimum_population_orders,
  medium_support_orders,high_support_orders,active
)
select id,'1.0.0',0.5,0.5,30,70,90,5,20,3,10,true
from erp_supply.organizations
where code='EI'
on conflict (organization_id,version) do update set active=true;

-- Operational workflow catalogs and permissions.
insert into erp_supply.workflow_steps(
  code,name,module_code,queue_code,sla_hours,sort_order,terminal,active,metadata
) values
('RECEPCION_MERCANCIA','Recepción de mercancía','receiving','RECEPCION_MERCANCIA',8,40,false,true,'{"phase":"supply"}')
on conflict (code) do update set
  name=excluded.name,module_code=excluded.module_code,queue_code=excluded.queue_code,
  sla_hours=excluded.sla_hours,sort_order=excluded.sort_order,active=true;

insert into erp_supply.workflow_transitions(
  from_step_code,action_code,to_step_code,order_type_code,delivery_route_code,
  priority,metadata
) values
('CARTERA','COMPLETE','RECEPCION_PEDIDO',null,null,100,'{"source":"legacy-certified"}'),
('CAJA','COMPLETE','RECEPCION_PEDIDO',null,null,100,'{"source":"legacy-certified"}'),
('COMPRAS','COMPLETE','RECEPCION_MERCANCIA',null,null,100,'{"source":"legacy-certified"}'),
('RECEPCION_MERCANCIA','COMPLETE','RECEPCION_PEDIDO',null,null,100,'{"source":"legacy-certified"}'),
('RECEPCION_PEDIDO','COMPLETE','ALISTAMIENTO',null,null,100,'{"source":"legacy-v10.12-parallel-cut"}'),
('CORTE','COMPLETE','ALISTAMIENTO',null,null,100,'{"source":"legacy-historical-compatibility"}'),
('ALISTAMIENTO','COMPLETE','CAJA_FACTURACION','PVN',null,10,'{"source":"legacy-cash-billing"}'),
('ALISTAMIENTO','COMPLETE','FACTURACION',null,null,100,'{"source":"legacy-certified"}'),
('CAJA_FACTURACION','COMPLETE','CLIENT_POINT',null,'CLIENT_POINT',10,'{}'),
('CAJA_FACTURACION','COMPLETE','CLIENT_PICKUP',null,'CLIENT_PICKUP',10,'{}'),
('CAJA_FACTURACION','COMPLETE','LOCAL_DISPATCH',null,'LOCAL_DISPATCH',10,'{}'),
('CAJA_FACTURACION','COMPLETE','NATIONAL_DISPATCH',null,'NATIONAL_DISPATCH',10,'{}'),
('FACTURACION','COMPLETE','CLIENT_POINT',null,'CLIENT_POINT',10,'{}'),
('FACTURACION','COMPLETE','CLIENT_PICKUP',null,'CLIENT_PICKUP',10,'{}'),
('FACTURACION','COMPLETE','LOCAL_DISPATCH',null,'LOCAL_DISPATCH',10,'{}'),
('FACTURACION','COMPLETE','NATIONAL_DISPATCH',null,'NATIONAL_DISPATCH',10,'{}'),
('CLIENT_POINT','COMPLETE','CLOSURE',null,null,100,'{}'),
('CLIENT_PICKUP','COMPLETE','CLOSURE',null,null,100,'{}'),
('LOCAL_DISPATCH','COMPLETE','CLOSURE',null,null,100,'{}'),
('NATIONAL_DISPATCH','COMPLETE','CLOSURE',null,null,100,'{}'),
('CLOSURE','COMPLETE','CLOSED',null,null,100,'{}')
on conflict do nothing;

insert into erp_supply.step_roles(
  step_code,role_code,can_view,can_claim,can_assign,can_start,can_complete,can_block,can_override
) values
('CARTERA','cartera',true,true,false,true,true,true,false),
('CAJA','caja',true,true,false,true,true,true,false),
('COMPRAS','compras',true,true,false,true,true,true,false),
('RECEPCION_MERCANCIA','recepcion_mercancia',true,true,false,true,true,true,false),
('RECEPCION_PEDIDO','coordinador_logistico',true,true,true,true,true,true,false),
('RECEPCION_PEDIDO','lider_logistica',true,true,true,true,true,true,true),
('ALISTAMIENTO','aux_logistica',true,true,false,true,true,true,false),
('ALISTAMIENTO','lider_logistica',true,true,true,true,true,true,true),
('CORTE','auxiliar_corte',true,true,false,true,true,true,false),
('CORTE','lider_logistica',true,true,true,true,true,true,true),
('CAJA_FACTURACION','caja',true,true,false,true,true,true,false),
('FACTURACION','coordinador_logistico',true,true,true,true,true,true,false),
('FACTURACION','despacho_nacional',true,true,false,true,true,true,false),
('CLIENT_POINT','coordinador_logistico',true,true,true,true,true,true,false),
('CLIENT_PICKUP','coordinador_logistico',true,true,true,true,true,true,false),
('LOCAL_DISPATCH','coordinador_logistico',true,true,true,true,true,true,false),
('NATIONAL_DISPATCH','despacho_nacional',true,true,false,true,true,true,false),
('NATIONAL_DISPATCH','coordinador_logistico',true,true,true,true,true,true,true),
('CLOSURE','jefe_logistica',true,true,true,true,true,true,true),
('CLOSURE','coordinador_logistico',true,true,false,true,true,true,false)
on conflict (step_code,role_code) do update set
  can_view=excluded.can_view,can_claim=excluded.can_claim,can_assign=excluded.can_assign,
  can_start=excluded.can_start,can_complete=excluded.can_complete,
  can_block=excluded.can_block,can_override=excluded.can_override;

insert into erp_supply.step_roles(
  step_code,role_code,can_view,can_claim,can_assign,can_start,can_complete,can_block,can_override
)
select s.code,'super_admin',true,true,true,true,true,true,true
from erp_supply.workflow_steps s
where not s.terminal
on conflict (step_code,role_code) do update set
  can_view=true,can_claim=true,can_assign=true,can_start=true,
  can_complete=true,can_block=true,can_override=true;

insert into erp_supply.order_block_reasons(code,name,description,sort_order) values
('MATERIAL','Falta de material','Material requerido no disponible para continuar.',10),
('APPROVAL','Espera de aprobación','La operación depende de una decisión formal.',20),
('INCOMPLETE_INFORMATION','Información incompleta','Faltan datos o documentos operativos.',30),
('PAYMENT','Pago','Existe una condición pendiente relacionada con pago.',40),
('SUPPLIER','Proveedor','La continuidad depende de un proveedor.',50),
('MACHINE','Máquina o equipo','Existe una indisponibilidad de máquina o equipo.',60),
('CUSTOMER','Cliente','Se requiere respuesta o acción del cliente.',70),
('OTHER','Otro','Motivo operativo no cubierto por el catálogo.',100)
on conflict (code) do update set name=excluded.name,description=excluded.description,active=true;

insert into erp_supply.order_issue_types(
  code,name,default_severity,default_blocking,sort_order
) values
('NOTE','Nota','LOW',false,10),
('NOVELTY','Novedad','MEDIUM',false,20),
('QUALITY','Calidad','HIGH',true,30),
('DAMAGED_MATERIAL','Material averiado','HIGH',true,40),
('DELIVERY','Entrega','HIGH',false,50),
('OTHER','Otra incidencia','MEDIUM',false,100)
on conflict (code) do update set
  name=excluded.name,default_severity=excluded.default_severity,
  default_blocking=excluded.default_blocking,active=true;

insert into erp_supply.order_action_authorities(action_code,role_code) values
('CANCEL','jefe_logistica'),
('CANCEL','gerencia'),
('CANCEL','super_admin'),
('REOPEN','jefe_logistica'),
('REOPEN','gerencia'),
('REOPEN','super_admin')
on conflict (action_code,role_code) do update set active=true;

insert into erp_supply.workflow_step_requirements(
  step_code,requirement_code,requirement_type,evidence_type,required_count,metadata
) values
('CLOSURE','CLOSURE_PROOF','EVIDENCE','CLOSURE_PROOF',1,'{"label":"Evidencia de cierre"}')
on conflict (step_code,requirement_code) do update set active=true;

-- Orders → Workforce operational mappings.
-- These depend on workflow_steps and therefore belong after the workflow catalog seed.
insert into erp_supply.order_workforce_step_mappings(
  step_code,workforce_catalog_code,activity_title,metadata
) values
('ALISTAMIENTO','LOG_SUPPORT_PICKING','Alistamiento de pedido','{"integration":"orders-workforce","operational":true}'::jsonb),
('CORTE','LOG_SUPPORT_CUTTING','Corte de pedido','{"integration":"orders-workforce","operational":true}'::jsonb),
('LOCAL_DISPATCH','LOG_LOADING','Despacho local','{"integration":"orders-workforce","operational":true}'::jsonb),
('NATIONAL_DISPATCH','LOG_LOADING','Despacho nacional','{"integration":"orders-workforce","operational":true}'::jsonb),
('CLIENT_POINT','LOG_LOADING','Entrega en punto','{"integration":"orders-workforce","operational":true}'::jsonb),
('CLIENT_PICKUP','LOG_LOADING','Entrega a cliente que recoge','{"integration":"orders-workforce","operational":true}'::jsonb)
on conflict(step_code) do update set
  workforce_catalog_code=excluded.workforce_catalog_code,
  activity_title=excluded.activity_title,
  active=excluded.active,
  metadata=excluded.metadata,
  updated_at=now();


-- Inventory capability mapping for the current module-level RBAC model.
-- read = consulta; create = recepción/reserva/conteo; update = lifecycle operativo;
-- approve = ajustes, reversos y aprobación de conteos.
insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
) values
('auditoria','inventory',true,false,false,false,false),
('ventas','inventory',true,false,false,false,false),
('compras','inventory',true,false,false,false,false),
('recepcion_mercancia','inventory',true,true,false,false,false),
('aux_logistica','inventory',true,true,true,false,false),
('auxiliar_corte','inventory',true,false,true,false,false),
('coordinador_logistico','inventory',true,true,true,true,false),
('lider_logistica','inventory',true,true,true,true,false),
('jefe_logistica','inventory',true,true,true,true,false),
('gerencia','inventory',true,false,false,true,false)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

-- Analytics permissions are seeded after roles so local/CI reset reproduces runtime RBAC.
insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'dashboard',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.active
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'vsm',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.code in (
  'auditoria','coordinador_logistico','gerencia','jefe_logistica',
  'lider_logistica','super_admin'
)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'reports',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.code in (
  'auditoria','cartera','caja','compras','coordinador_logistico','gerencia',
  'jefe_logistica','lider_logistica','super_admin','ventas'
)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select
  r.code,'imports',true,
  (r.code='super_admin'),(r.code='super_admin'),(r.code='super_admin'),(r.code='super_admin')
from erp_supply.roles r
where r.code in ('auditoria','gerencia','super_admin')
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

-- PACO alert policies. Role-based only; no person names are hardcoded.
insert into erp_supply.assistant_settings(
  organization_id,cooldown_minutes,leadership_roles,voice_enabled
)
select
  id,
  30,
  array['super_admin','gerencia','jefe_logistica','lider_logistica','coordinador_logistico']::text[],
  true
from erp_supply.organizations
where code='EI'
on conflict (organization_id) do update set
  cooldown_minutes=excluded.cooldown_minutes,
  leadership_roles=excluded.leadership_roles,
  voice_enabled=excluded.voice_enabled,
  updated_at=now();

insert into erp_supply.assistant_role_alert_policies(
  organization_id,role_code,inactivity_threshold_minutes,
  inactivity_alerts,delayed_order_alerts,active
)
select
  o.id,
  r.role_code,
  20,
  true,
  true,
  true
from erp_supply.organizations o
cross join (
  values ('aux_logistica'),('auxiliar_corte'),('recepcion_mercancia')
) r(role_code)
where o.code='EI'
on conflict (organization_id,role_code) do update set
  inactivity_threshold_minutes=excluded.inactivity_threshold_minutes,
  inactivity_alerts=excluded.inactivity_alerts,
  delayed_order_alerts=excluded.delayed_order_alerts,
  active=true,
  updated_at=now();

