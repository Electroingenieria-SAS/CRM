begin;

create or replace function erp_private.bootstrap_workforce_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, erp_supply
as $$
begin
  insert into erp_supply.workforce_schedule_segments(
    organization_id,iso_weekday,start_time,end_time
  )
  select p_organization_id,d,'07:00'::time,'12:00'::time
  from generate_series(1,5) d
  on conflict do nothing;

  insert into erp_supply.workforce_schedule_segments(
    organization_id,iso_weekday,start_time,end_time
  )
  select p_organization_id,d,'13:40'::time,'17:30'::time
  from generate_series(1,5) d
  on conflict do nothing;

  insert into erp_supply.workforce_activity_catalog(
    organization_id,code,name,description,category_code,category_label,subcategory,
    activity_group,activity_kind,standard_minutes,evidence_policy,team_allowed,
    allowed_roles,sort_order,metadata
  )
  select p_organization_id,x.code,x.name,x.description,x.category_code,x.category_label,
         x.subcategory,x.activity_group,x.activity_kind,x.standard_minutes,
         x.evidence_policy,x.team_allowed,x.allowed_roles,x.sort_order,
         jsonb_build_object('legacySeed','10.23.0','taxonomySource','11.34.3','editable',true)
  from (values
    ('LOG_ORGANIZE_WAREHOUSE','Organización de bodega','Orden, clasificación y disposición de materiales o zonas.','ALISTAMIENTO','Alistamiento','Organización de zona de trabajo','LOGISTICS','ACTIVITY',60,'BEFORE_AFTER',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia','despacho_nacional']::text[],10),
    ('LOG_CLEAN_WORKAREA','Limpieza de zona de trabajo','Limpieza y acondicionamiento de una zona operativa.','ALISTAMIENTO','Alistamiento','Organización de zona de trabajo','LOGISTICS','ACTIVITY',30,'BEFORE_AFTER',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia','despacho_nacional']::text[],20),
    ('LOG_LOADING','Cargue','Cargue de mercancía, vehículo o unidad logística.','DESPACHO_LOCAL','Despacho local','Cargue y entrega','LOGISTICS','ACTIVITY',45,'FINAL_PHOTO',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia','despacho_nacional']::text[],30),
    ('LOG_UNLOADING','Descargue','Descargue de mercancía y disposición inicial.','RECEPCION','Recepción','Descargue y recepción','LOGISTICS','ACTIVITY',60,'FINAL_PHOTO',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia','despacho_nacional']::text[],40),
    ('LOG_CYCLE_COUNT','Conteo físico / inventario','Conteo físico, verificación o conciliación de existencias.','INVENTARIO','Inventario','Realización de inventarios','LOGISTICS','ACTIVITY',60,'FINAL_PHOTO',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia']::text[],50),
    ('LOG_RELOCATION','Reubicación de material','Movimiento y reubicación interna de materiales.','ALISTAMIENTO','Alistamiento','Organización de zona de trabajo','LOGISTICS','ACTIVITY',45,'FINAL_PHOTO',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia']::text[],60),
    ('LOG_SUPPORT_PICKING','Apoyo a alistamiento','Apoyo temporal a actividades de alistamiento.','ALISTAMIENTO','Alistamiento','Apoyo operativo','LOGISTICS','ACTIVITY',30,'NONE',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte']::text[],70),
    ('LOG_SUPPORT_CUTTING','Apoyo a corte','Apoyo temporal a operación de corte.','CORTE','Corte','Apoyo operativo','LOGISTICS','ACTIVITY',30,'NONE',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte']::text[],80),
    ('LOG_MAINTENANCE','Mantenimiento básico / 5S','Mantenimiento autónomo, inspección o actividad 5S.','MEJORA','Mejora continua','5S y mantenimiento','IMPROVEMENT','ACTIVITY',45,'BEFORE_AFTER',true,array['jefe_logistica','lider_logistica','coordinador_logistico','aux_logistica','auxiliar_corte','recepcion_mercancia','despacho_nacional']::text[],90),
    ('GEN_MEETING','Reunión de trabajo','Reunión operativa o administrativa.','GENERAL','General','Reuniones','GENERAL','ACTIVITY',30,'NONE',true,'{}'::text[],110),
    ('GEN_TRAINING','Capacitación','Formación, inducción o transferencia de conocimiento.','GENERAL','General','Capacitación','IMPROVEMENT','ACTIVITY',60,'NONE',true,'{}'::text[],120),
    ('GEN_CONTINUOUS_IMPROVEMENT','Mejora continua','Análisis, estandarización o implementación de mejora.','MEJORA','Mejora continua','Mejora continua','IMPROVEMENT','ACTIVITY',60,'FILE',true,'{}'::text[],130),
    ('GEN_ADMIN','Gestión administrativa','Actividad administrativa no cubierta por un flujo ERP.','GENERAL','General','Gestión administrativa','GENERAL','ACTIVITY',45,'NONE',false,'{}'::text[],140),
    ('MGT_DELIVERABLE','Entregable de gestión','Entregable con fecha límite y evidencia.','GESTION','Gestión','Entregables','MANAGEMENT','DELIVERABLE',120,'FILE',false,array['ventas','jefe_logistica','compras','cartera']::text[],200)
  ) as x(
    code,name,description,category_code,category_label,subcategory,activity_group,
    activity_kind,standard_minutes,evidence_policy,team_allowed,allowed_roles,sort_order
  )
  on conflict(organization_id,code) do update set
    name=excluded.name,
    description=excluded.description,
    category_code=excluded.category_code,
    category_label=excluded.category_label,
    subcategory=excluded.subcategory,
    activity_group=excluded.activity_group,
    activity_kind=excluded.activity_kind,
    standard_minutes=excluded.standard_minutes,
    evidence_policy=excluded.evidence_policy,
    team_allowed=excluded.team_allowed,
    allowed_roles=excluded.allowed_roles,
    sort_order=excluded.sort_order,
    active=true;

  insert into erp_supply.workforce_holidays(
    organization_id,holiday_date,name,legal_basis,source_url,source_kind
  )
  select p_organization_id,x.holiday_date,x.name,x.legal_basis,x.source_url,'NATIONAL'
  from (values
    (date '2026-01-01','Año Nuevo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-01-12','Reyes Magos','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-03-23','San José','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-04-02','Jueves Santo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-04-03','Viernes Santo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-05-01','Día del Trabajo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-05-18','Ascensión del Señor','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-06-08','Corpus Christi','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-06-15','Sagrado Corazón de Jesús','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-06-29','San Pedro y San Pablo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-07-13','Nuestra Señora del Rosario de Chiquinquirá','Ley 2578 de 2026','https://www.mininterior.gov.co/'),
    (date '2026-07-20','Independencia Nacional','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-08-07','Batalla de Boyacá','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-08-17','Asunción de la Virgen','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-10-12','Día de la Raza','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-11-02','Todos los Santos','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-11-16','Independencia de Cartagena','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-12-08','Inmaculada Concepción','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2026-12-25','Navidad','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-01-01','Año Nuevo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-01-11','Reyes Magos','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-03-22','San José','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-03-25','Jueves Santo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-03-26','Viernes Santo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-05-01','Día del Trabajo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-05-10','Ascensión del Señor','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-05-31','Corpus Christi','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-06-07','Sagrado Corazón de Jesús','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-07-05','San Pedro y San Pablo','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-07-12','Nuestra Señora del Rosario de Chiquinquirá','Ley 2578 de 2026','https://www.mininterior.gov.co/'),
    (date '2027-07-20','Independencia Nacional','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-08-07','Batalla de Boyacá','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-08-16','Asunción de la Virgen','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-10-18','Día de la Raza','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-11-01','Todos los Santos','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-11-15','Independencia de Cartagena','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-12-08','Inmaculada Concepción','Ley 51 de 1983','https://www.cancilleria.gov.co/'),
    (date '2027-12-25','Navidad','Ley 51 de 1983','https://www.cancilleria.gov.co/')
  ) as x(holiday_date,name,legal_basis,source_url)
  on conflict(organization_id,holiday_date) do update set
    name=excluded.name,
    legal_basis=excluded.legal_basis,
    source_url=excluded.source_url,
    source_kind=excluded.source_kind;
end;
$$;

revoke all on function erp_private.bootstrap_workforce_organization(uuid) from public,anon,authenticated;

create or replace function erp_private.workforce_org_bootstrap_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, erp_private
as $$
begin
  perform erp_private.bootstrap_workforce_organization(new.id);
  return new;
end;
$$;

revoke all on function erp_private.workforce_org_bootstrap_trigger() from public,anon,authenticated;

drop trigger if exists trg_workforce_bootstrap_org on erp_supply.organizations;
create trigger trg_workforce_bootstrap_org
after insert on erp_supply.organizations
for each row execute function erp_private.workforce_org_bootstrap_trigger();

do $$
declare
  v_org uuid;
begin
  for v_org in select id from erp_supply.organizations loop
    perform erp_private.bootstrap_workforce_organization(v_org);
  end loop;
end;
$$;

commit;
