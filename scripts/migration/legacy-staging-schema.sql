begin;

drop schema if exists migration_legacy cascade;
create schema migration_legacy;

create table migration_legacy.organizations(
  id uuid primary key, code text, name text, timezone text, active boolean,
  settings jsonb, created_at timestamptz, updated_at timestamptz
);
create table migration_legacy.roles(
  code text primary key, name text not null, description text, system_role boolean not null,
  active boolean not null, created_at timestamptz not null
);
create table migration_legacy.profiles(
  id uuid primary key, organization_id uuid, auth_user_id uuid, email text, display_name text,
  employee_code text, active boolean, is_system boolean, preferences jsonb,
  created_at timestamptz, updated_at timestamptz
);
create table migration_legacy.profile_roles(
  profile_id uuid, role_code text, is_primary boolean, granted_at timestamptz, granted_by uuid
);
create table migration_legacy.orders(
  id uuid primary key, organization_id uuid, order_number text, external_reference text,
  order_type_code text, payment_condition_code text, delivery_route_code text,
  client_name text, client_document text, client_city text, client_address text, client_phone text,
  seller_profile_id uuid, current_step_code text, status text, priority text,
  requires_cut boolean, requires_purchase boolean, current_assignee_id uuid, current_role_code text,
  promised_at timestamptz, requested_delivery_date date, source text, is_history boolean,
  is_test boolean, version integer, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, closed_at timestamptz, cancelled_at timestamptz
);
create table migration_legacy.order_items(
  id uuid primary key, order_id uuid, line_number integer, sku text, reference text,
  description text, quantity numeric, unit text, warehouse_location text, requires_cut boolean,
  requested_cut_length numeric, dimensions jsonb, item_status text, metadata jsonb,
  created_at timestamptz, updated_at timestamptz, material_master_id uuid, material_variant_id uuid
);
create table migration_legacy.order_tasks(
  id uuid primary key, order_id uuid, step_code text, sequence_no integer, queue_code text,
  status text, assigned_profile_id uuid, assigned_role_code text, created_at timestamptz,
  assigned_at timestamptz, started_at timestamptz, completed_at timestamptz, blocked_at timestamptz,
  raw_seconds bigint, business_seconds bigint, result_code text, result_detail text, metadata jsonb
);
create table migration_legacy.invoices(
  id uuid primary key, order_id uuid, invoice_number text, invoice_date date, amount numeric,
  currency text, status text, drive_file_id uuid, registered_by uuid, metadata jsonb,
  created_at timestamptz, package_weight_kg numeric, package_quantity numeric, weight_per_unit_kg numeric
);
create table migration_legacy.material_master(
  id uuid primary key, organization_id uuid, reference text, exact_name text, normalized_name text,
  unit text, weight numeric, attributes jsonb, source_system text, source_hash text, active boolean,
  last_sync_batch_id uuid, created_at timestamptz, updated_at timestamptz
);
create table migration_legacy.material_variants(
  id uuid primary key, material_master_id uuid, variant_label text, normalized_label text,
  metadata jsonb, active boolean, created_at timestamptz, updated_at timestamptz
);
create table migration_legacy.inventory_items(
  id uuid primary key, organization_id uuid, sku text, reference text, description text, unit text,
  item_type text, barcode text, active boolean, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, material_master_id uuid
);
create table migration_legacy.inventory_lots(
  id uuid primary key, inventory_item_id uuid, lot_number text, serial_number text, location text,
  quantity_available numeric, quantity_reserved numeric, quantity_blocked numeric,
  received_at timestamptz, expires_at date, metadata jsonb, material_variant_id uuid,
  source_system text, source_key text, source_active boolean, warehouse_code text,
  source_location_code text, source_location_name text, scan_code text
);
create table migration_legacy.material_reservations(
  id uuid primary key, organization_id uuid, order_id uuid, order_item_id uuid,
  material_master_id uuid, material_variant_id uuid, quantity numeric, unit text, status text,
  shortage_quantity numeric, created_by uuid, consumed_at timestamptz, released_at timestamptz,
  metadata jsonb, created_at timestamptz, updated_at timestamptz
);
create table migration_legacy.deliveries(
  id uuid primary key, order_id uuid, route_code text, status text, scheduled_at timestamptz,
  dispatched_at timestamptz, delivered_at timestamptz, received_by text, no_delivery_reason text,
  carrier text, tracking_number text, assigned_profile_id uuid, metadata jsonb,
  created_at timestamptz, updated_at timestamptz, carrier_invoice_number text, carrier_cost numeric,
  carrier_cost_currency text, carrier_cost_recorded_by uuid, carrier_cost_recorded_at timestamptz,
  distance_km numeric, distance_source text, distance_recorded_at timestamptz,
  distance_recorded_by uuid, satisfaction_status text, satisfaction_confirmed_at timestamptz,
  satisfaction_confirmed_by uuid, satisfaction_note text
);


create table migration_legacy.inventory_movements(
  id bigint primary key, organization_id uuid, inventory_item_id uuid, lot_id uuid,
  order_id uuid, movement_type text, quantity numeric, unit text, from_location text,
  to_location text, actor_profile_id uuid, reference text, metadata jsonb, created_at timestamptz
);
create table migration_legacy.work_activity_catalog(
  id uuid primary key, organization_id uuid, code text, name text, description text,
  activity_group text, activity_kind text, standard_minutes integer, evidence_policy text,
  acceptance_required boolean, team_allowed boolean, allowed_roles text[], active boolean,
  sort_order integer, metadata jsonb, created_at timestamptz, updated_at timestamptz,
  created_by uuid, catalog_origin text, archived_at timestamptz
);
create table migration_legacy.work_assignments(
  id uuid primary key, organization_id uuid, catalog_id uuid, series_id uuid, title text,
  description text, assignment_kind text, status text, priority text, planned_start timestamptz,
  planned_end timestamptz, due_at timestamptz, estimated_minutes integer, evidence_policy text,
  acceptance_required boolean, assigned_by uuid, related_entity_type text,
  related_entity_id text, recurrence jsonb, metadata jsonb, created_at timestamptz,
  updated_at timestamptz, request_origin text, request_reason text, approval_status text,
  approval_scope text, requested_by uuid, requested_at timestamptz, decided_by uuid,
  decided_at timestamptz, decision_note text
);
create table migration_legacy.work_assignment_members(
  id uuid primary key, assignment_id uuid, profile_id uuid, status text,
  assigned_at timestamptz, first_started_at timestamptz, submitted_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz, metadata jsonb
);
create table migration_legacy.work_executions(
  id uuid primary key, organization_id uuid, assignment_id uuid, assignment_member_id uuid,
  catalog_id uuid, profile_id uuid, source text, status text, title_snapshot text,
  started_at timestamptz, ended_at timestamptz, elapsed_seconds bigint, active_seconds bigint,
  business_seconds bigint, paused_seconds bigint, start_delay_seconds bigint,
  deviation_ratio numeric, deviation_reason text, result_note text,
  related_entity_type text, related_entity_id text, metadata jsonb,
  created_at timestamptz, updated_at timestamptz
);
create table migration_legacy.work_evidence(
  id uuid primary key, organization_id uuid, execution_id uuid, profile_id uuid,
  evidence_type text, drive_file_id text, file_name text, mime_type text, size_bytes bigint,
  web_view_link text, external_value text, note text, metadata jsonb, created_at timestamptz
);
create table migration_legacy.system_audit(
  id bigint primary key, organization_id uuid, actor_profile_id uuid, action text,
  entity_type text, entity_id text, before_data jsonb, after_data jsonb,
  metadata jsonb, created_at timestamptz
);

commit;
