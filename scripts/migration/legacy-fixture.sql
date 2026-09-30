begin;

create schema erp_supply;

create table erp_supply.organizations(
  id uuid primary key, code text, name text, timezone text, active boolean,
  settings jsonb, created_at timestamptz, updated_at timestamptz
);
create table erp_supply.profiles(
  id uuid primary key, organization_id uuid, auth_user_id uuid, email text, display_name text,
  employee_code text, active boolean, is_system boolean, preferences jsonb,
  created_at timestamptz, updated_at timestamptz
);
create table erp_supply.profile_roles(
  profile_id uuid, role_code text, is_primary boolean, granted_at timestamptz, granted_by uuid
);
create table erp_supply.orders(
  id uuid primary key, organization_id uuid, order_number text, external_reference text,
  order_type_code text, payment_condition_code text, delivery_route_code text,
  client_name text, client_document text, client_city text, client_address text, client_phone text,
  seller_profile_id uuid, current_step_code text, status text, priority text,
  requires_cut boolean, requires_purchase boolean, current_assignee_id uuid, current_role_code text,
  promised_at timestamptz, requested_delivery_date date, source text, is_history boolean,
  is_test boolean, version integer, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, closed_at timestamptz, cancelled_at timestamptz
);
create table erp_supply.order_items(
  id uuid primary key, order_id uuid, line_number integer, sku text, reference text,
  description text, quantity numeric, unit text, warehouse_location text, requires_cut boolean,
  requested_cut_length numeric, dimensions jsonb, item_status text, metadata jsonb,
  created_at timestamptz, updated_at timestamptz, material_master_id uuid, material_variant_id uuid
);
create table erp_supply.order_tasks(
  id uuid primary key, order_id uuid, step_code text, sequence_no integer, queue_code text,
  status text, assigned_profile_id uuid, assigned_role_code text, created_at timestamptz,
  assigned_at timestamptz, started_at timestamptz, completed_at timestamptz, blocked_at timestamptz,
  raw_seconds bigint, business_seconds bigint, result_code text, result_detail text, metadata jsonb
);
create table erp_supply.invoices(
  id uuid primary key, order_id uuid, invoice_number text, invoice_date date, amount numeric,
  currency text, status text, drive_file_id uuid, registered_by uuid, metadata jsonb,
  created_at timestamptz, package_weight_kg numeric, package_quantity numeric, weight_per_unit_kg numeric
);
create table erp_supply.material_master(
  id uuid primary key, organization_id uuid, reference text, exact_name text, normalized_name text,
  unit text, weight numeric, attributes jsonb, source_system text, source_hash text, active boolean,
  last_sync_batch_id uuid, created_at timestamptz, updated_at timestamptz
);
create table erp_supply.material_variants(
  id uuid primary key, material_master_id uuid, variant_label text, normalized_label text,
  metadata jsonb, active boolean, created_at timestamptz, updated_at timestamptz
);
create table erp_supply.inventory_items(
  id uuid primary key, organization_id uuid, sku text, reference text, description text, unit text,
  item_type text, barcode text, active boolean, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, material_master_id uuid
);
create table erp_supply.inventory_lots(
  id uuid primary key, inventory_item_id uuid, lot_number text, serial_number text, location text,
  quantity_available numeric, quantity_reserved numeric, quantity_blocked numeric,
  received_at timestamptz, expires_at date, metadata jsonb, material_variant_id uuid,
  source_system text, source_key text, source_active boolean, warehouse_code text,
  source_location_code text, source_location_name text, scan_code text
);
create table erp_supply.material_reservations(
  id uuid primary key, organization_id uuid, order_id uuid, order_item_id uuid,
  material_master_id uuid, material_variant_id uuid, quantity numeric, unit text, status text,
  shortage_quantity numeric, created_by uuid, consumed_at timestamptz, released_at timestamptz,
  metadata jsonb, created_at timestamptz, updated_at timestamptz
);
create table erp_supply.deliveries(
  id uuid primary key, order_id uuid, route_code text, status text, scheduled_at timestamptz,
  dispatched_at timestamptz, delivered_at timestamptz, received_by text, no_delivery_reason text,
  carrier text, tracking_number text, assigned_profile_id uuid, metadata jsonb,
  created_at timestamptz, updated_at timestamptz, carrier_invoice_number text, carrier_cost numeric,
  carrier_cost_currency text, carrier_cost_recorded_by uuid, carrier_cost_recorded_at timestamptz,
  distance_km numeric, distance_source text, distance_recorded_at timestamptz,
  distance_recorded_by uuid, satisfaction_status text, satisfaction_confirmed_at timestamptz,
  satisfaction_confirmed_by uuid, satisfaction_note text
);


create table erp_supply.inventory_movements(
  id bigint primary key, organization_id uuid, inventory_item_id uuid, lot_id uuid,
  order_id uuid, movement_type text, quantity numeric, unit text, from_location text,
  to_location text, actor_profile_id uuid, reference text, metadata jsonb, created_at timestamptz
);
create table erp_supply.work_activity_catalog(
  id uuid primary key, organization_id uuid, code text, name text, description text,
  activity_group text, activity_kind text, standard_minutes integer, evidence_policy text,
  acceptance_required boolean, team_allowed boolean, allowed_roles text[], active boolean,
  sort_order integer, metadata jsonb, created_at timestamptz, updated_at timestamptz,
  created_by uuid, catalog_origin text, archived_at timestamptz
);
create table erp_supply.work_assignments(
  id uuid primary key, organization_id uuid, catalog_id uuid, series_id uuid, title text,
  description text, assignment_kind text, status text, priority text, planned_start timestamptz,
  planned_end timestamptz, due_at timestamptz, estimated_minutes integer, evidence_policy text,
  acceptance_required boolean, assigned_by uuid, related_entity_type text,
  related_entity_id text, recurrence jsonb, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, request_origin text, request_reason text, approval_status text,
  approval_scope text, requested_by uuid, requested_at timestamptz, decided_by uuid,
  decided_at timestamptz, decision_note text
);
create table erp_supply.work_assignment_members(
  id uuid primary key, assignment_id uuid, profile_id uuid, status text,
  assigned_at timestamptz, first_started_at timestamptz, submitted_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz, metadata jsonb
);
create table erp_supply.work_executions(
  id uuid primary key, organization_id uuid, assignment_id uuid, assignment_member_id uuid,
  catalog_id uuid, profile_id uuid, source text, status text, title_snapshot text,
  started_at timestamptz, ended_at timestamptz, elapsed_seconds bigint, active_seconds bigint,
  business_seconds bigint, paused_seconds bigint, start_delay_seconds bigint,
  deviation_ratio numeric, deviation_reason text, result_note text,
  related_entity_type text, related_entity_id text, metadata jsonb,
  created_at timestamptz, updated_at timestamptz
);
create table erp_supply.work_evidence(
  id uuid primary key, organization_id uuid, execution_id uuid, profile_id uuid,
  evidence_type text, drive_file_id text, file_name text, mime_type text, size_bytes bigint,
  web_view_link text, external_value text, note text, metadata jsonb, created_at timestamptz
);
create table erp_supply.system_audit(
  id bigint primary key, organization_id uuid, actor_profile_id uuid, action text,
  entity_type text, entity_id text, before_data jsonb, after_data jsonb,
  metadata jsonb, created_at timestamptz
);

insert into erp_supply.organizations values
('00000000-0000-0000-0000-000000000001','EI','Electroingeniería S.A.S.','America/Bogota',true,'{"currency":"COP"}',now()-interval '1 year',now());

insert into erp_supply.profiles values
('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000009101','seller@example.test','Vendedor Legacy','V001',true,false,'{}',now()-interval '1 year',now()),
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000009102','dispatch@example.test','Coordinación Legacy','L001',true,false,'{}',now()-interval '1 year',now());

insert into erp_supply.profile_roles values
('00000000-0000-0000-0000-000000000101','ventas',true,now()-interval '1 year',null),
('00000000-0000-0000-0000-000000000102','coordinador_logistico',true,now()-interval '1 year',null);

insert into erp_supply.material_master values
('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000001','MAT-001','Material Legacy','material legacy','UND',2.5,'{}','SIESA','hash',true,null,now()-interval '1 year',now());

insert into erp_supply.material_variants values
('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000401','Azul','AZUL','{}',true,now()-interval '1 year',now());

insert into erp_supply.orders values
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000001','LEG-ACTIVE',null,'PVC','CASH','LOCAL_DISPATCH','Cliente Activo','900001','Cali','Calle 1','3000000000','00000000-0000-0000-0000-000000000101','LOCAL_DISPATCH','IN_PROGRESS','HIGH',false,false,'00000000-0000-0000-0000-000000000102','coordinador_logistico',now()+interval '1 day',current_date+1,'ERP',false,false,4,'{}',now()-interval '2 days',now(),null,null),
('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000001','LEG-CLOSED',null,'PVC','CASH','LOCAL_DISPATCH','Cliente Cerrado','900002','Cali','Calle 2','3000000001','00000000-0000-0000-0000-000000000101','CLOSED','CLOSED','MEDIUM',false,false,null,null,now()-interval '1 day',current_date-1,'ERP',false,false,8,'{}',now()-interval '10 days',now()-interval '1 day',now()-interval '1 day',null);

insert into erp_supply.order_items values
('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201',1,'SKU-1','MAT-001','Material Legacy',5,'UND','A-01',false,null,'{}','PENDING','{}',now()-interval '2 days',now(),'00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000402'),
('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000202',1,'SKU-1','MAT-001','Material Legacy',10,'UND','A-01',false,null,'{}','FULFILLED','{}',now()-interval '10 days',now()-interval '1 day','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000402');

insert into erp_supply.order_tasks values
('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000201','LOCAL_DISPATCH',1,'LOCAL_DISPATCH','IN_PROGRESS','00000000-0000-0000-0000-000000000102','coordinador_logistico',now()-interval '2 days',now()-interval '2 hours',now()-interval '1 hour',null,null,3600,3600,null,null,'{}'),
('00000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000202','LOCAL_DISPATCH',1,'LOCAL_DISPATCH','COMPLETED','00000000-0000-0000-0000-000000000102','coordinador_logistico',now()-interval '10 days',now()-interval '2 days',now()-interval '2 days',now()-interval '1 day',null,3600,3600,'DELIVERED',null,'{}');

insert into erp_supply.invoices values
('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000201','INV-001',current_date,50000,'COP','REGISTERED',null,'00000000-0000-0000-0000-000000000101','{}',now(),10,5,2),
('00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000202','INV-HIST',current_date-1,null,'COP','REGISTERED',null,'00000000-0000-0000-0000-000000000101','{"automaticRecord":true,"source":"fixture"}',now()-interval '1 day',null,null,null);

insert into erp_supply.inventory_items values
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000001','SKU-1','MAT-001','Material Legacy','UND','STANDARD',null,true,'{}',now()-interval '1 year',now(),'00000000-0000-0000-0000-000000000401');

insert into erp_supply.inventory_lots values
('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000501','LOT-1',null,'A-01',70,20,10,now()-interval '1 year',null,'{}','00000000-0000-0000-0000-000000000402','SIESA','LOT-1',true,'WH1','A-01','Bodega Principal','SCAN-1');

insert into erp_supply.material_reservations values
('00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000402',5,'UND','ACTIVE',0,'00000000-0000-0000-0000-000000000101',null,null,'{}',now()-interval '1 day',now()),
('00000000-0000-0000-0000-000000000902','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000402',10,'UND','CONSUMED',0,'00000000-0000-0000-0000-000000000101',now()-interval '1 day',null,'{}',now()-interval '5 days',now()-interval '1 day');

insert into erp_supply.deliveries values
('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000000202','LOCAL_DISPATCH','DELIVERED',now()-interval '2 days',now()-interval '2 days',now()-interval '1 day','Cliente Cerrado',null,'Transportadora Legacy','TRACK-1','00000000-0000-0000-0000-000000000102','{}',now()-interval '2 days',now()-interval '1 day','FLET-1',1000,'COP','00000000-0000-0000-0000-000000000102',now()-interval '1 day',15,'MANUAL',now()-interval '2 days','00000000-0000-0000-0000-000000000102','CONFIRMED',now()-interval '1 day','00000000-0000-0000-0000-000000000102','OK');


insert into erp_supply.inventory_movements values
(1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000201','ISSUE',2,'UND','A-01','ALISTAMIENTO','00000000-0000-0000-0000-000000000101','LEG-ACTIVE','{"source":"fixture"}',now()-interval '1 day');

insert into erp_supply.work_activity_catalog values
('00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000000001','LEGACY_MEETING','Reunión legacy','Actividad usada para ensayo de migración','GENERAL','ACTIVITY',60,'FINAL_PHOTO',false,false,'{}',true,100,'{}',now()-interval '1 year',now(),'00000000-0000-0000-0000-000000000102','MANUAL',null);

insert into erp_supply.work_assignments values
('00000000-0000-0000-0000-000000001201','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001101',null,'Actividad planificada legacy','Pendiente de evidencia','ACTIVITY','PUBLISHED','MEDIUM',now()-interval '4 hours',now()-interval '2 hours',now()-interval '2 hours',120,'FINAL_PHOTO',false,'00000000-0000-0000-0000-000000000102',null,null,'{}','{}',now()-interval '5 hours',now()-interval '1 hour','MANAGER_ASSIGNED',null,'APPROVED',null,'00000000-0000-0000-0000-000000000102',now()-interval '5 hours','00000000-0000-0000-0000-000000000102',now()-interval '5 hours','fixture');

insert into erp_supply.work_assignment_members values
('00000000-0000-0000-0000-000000001301','00000000-0000-0000-0000-000000001201','00000000-0000-0000-0000-000000000102','WAITING_EVIDENCE',now()-interval '5 hours',now()-interval '4 hours',now()-interval '1 hour',null,null,'{}');

insert into erp_supply.work_executions values
('00000000-0000-0000-0000-000000001401','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001201','00000000-0000-0000-0000-000000001301','00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000000102','PLANNED','WAITING_EVIDENCE','Actividad planificada legacy',now()-interval '4 hours',null,7200,3600,3600,3600,0,1.0,null,'Pendiente evidencia',null,null,'{}',now()-interval '4 hours',now()-interval '1 hour'),
('00000000-0000-0000-0000-000000001402','00000000-0000-0000-0000-000000000001',null,null,'00000000-0000-0000-0000-000000001101','00000000-0000-0000-0000-000000000101','MANUAL','COMPLETED','Actividad manual legacy',now()-interval '8 hours',now()-interval '7 hours',3600,3600,3600,0,0,1.0,null,'Completada',null,null,'{}',now()-interval '8 hours',now()-interval '7 hours');

insert into erp_supply.work_evidence values
('00000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001402','00000000-0000-0000-0000-000000000101','FINAL_PHOTO','drive-legacy-1','evidence.jpg','image/jpeg',1024,'https://example.test/evidence',null,'fixture','{}',now()-interval '7 hours');

insert into erp_supply.system_audit values
(1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','UPDATE','orders','00000000-0000-0000-0000-000000000201','{"status":"QUEUED"}','{"status":"IN_PROGRESS"}','{"source":"fixture"}',now()-interval '2 days'),
(2,'00000000-0000-0000-0000-000000000001',null,'UPDATE','legacy_old','old-row',null,null,'{}',now()-interval '60 days'),
(3,null,null,'ADMIN_PROFILE_ACCESS_REMOVED','profiles','00000000-0000-0000-0000-000000000102',null,null,'{"source":"fixture"}',now()-interval '60 days');

commit;
