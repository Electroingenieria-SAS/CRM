#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail=0

query_scalar() {
  local db_url="$1"
  local sql="$2"
  psql "$db_url" -qAt -v ON_ERROR_STOP=1 -c "$sql"
}

query_sorted_set() {
  local db_url="$1"
  local sql="$2"
  local output_file="$3"

  psql "$db_url" -qAt -v ON_ERROR_STOP=1 -c "$sql" |
    LC_ALL=C sort >"$output_file"
}

assert_equal() {
  local label="$1"
  local left="$2"
  local right="$3"

  if [ "$left" = "$right" ]; then
    echo "PASS $label: $left"
  else
    echo "FAIL $label: source=$left target=$right" >&2
    fail=1
  fi
}

assert_zero() {
  local label="$1"
  local value="$2"

  if [ "$value" = "0" ]; then
    echo "PASS $label"
  else
    echo "FAIL $label: $value row(s)" >&2
    fail=1
  fi
}

compare_exact_set() {
  local label="$1"
  local slug="$2"
  local source_sql="$3"
  local target_sql="$4"
  local source_file="$TMP_DIR/$slug.source"
  local target_file="$TMP_DIR/$slug.target"
  local source_rows
  local target_rows

  query_sorted_set "$SOURCE_DB_URL" "$source_sql" "$source_file"
  query_sorted_set "$TARGET_DB_URL" "$target_sql" "$target_file"

  source_rows="$(wc -l <"$source_file" | tr -d ' ')"
  target_rows="$(wc -l <"$target_file" | tr -d ' ')"

  if cmp -s "$source_file" "$target_file"; then
    echo "PASS $label exact set: $source_rows row(s)"
  else
    echo "FAIL $label exact set mismatch: source=$source_rows target=$target_rows" >&2
    fail=1
  fi
}

source_archive_refs="$(query_scalar "$SOURCE_DB_URL" "select count(*) from erp_supply.invoices where amount is null or amount<=0")"
target_archive_refs="$(query_scalar "$TARGET_DB_URL" "select coalesce(sum(jsonb_array_length(coalesce(metadata->'legacyInvoiceReferences','[]'::jsonb))),0) from erp_supply.orders where jsonb_typeof(coalesce(metadata->'legacyInvoiceReferences','[]'::jsonb))='array'")"

source_variants="$(query_scalar "$SOURCE_DB_URL" "select count(*) from erp_supply.material_variants")"
target_variants="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.material_variants where attributes->>'migrationSource'='CRM-SUMINISTROS'")"

source_auth_links="$(query_scalar "$SOURCE_DB_URL" "select count(*) from erp_supply.profiles where auth_user_id is not null")"
target_auth_refs="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.profiles where preferences->>'legacyAuthUserId' is not null")"

source_archived_inventory_movements="$(query_scalar "$SOURCE_DB_URL" "select count(*)
  from erp_supply.inventory_movements m
  left join erp_supply.inventory_items i on i.id=m.inventory_item_id
  left join erp_supply.inventory_lots l on l.id=m.lot_id
  where not (
    coalesce(i.active,false)
    and coalesce(l.source_active,true)
    and i.material_master_id is not null
  )")"
target_archived_inventory_movements="$(query_scalar "$TARGET_DB_URL" "select count(*)
  from erp_supply.inventory_operations
  where operation_type='LEGACY_HISTORY'
    and result->>'migrationSource'='CRM-SUMINISTROS'
    and coalesce((result->>'archiveOnly')::boolean,false)")"

target_nonpositive_invoices="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.invoices where amount is null or amount<=0")"
target_bad_archive_shape="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.orders where metadata ? 'legacyInvoiceReferences' and jsonb_typeof(metadata->'legacyInvoiceReferences')<>'array'")"

assert_equal "archive-only invoice reference count" "$source_archive_refs" "$target_archive_refs"
assert_equal "material variant count" "$source_variants" "$target_variants"
assert_equal "legacy Auth profile reference count" "$source_auth_links" "$target_auth_refs"
assert_equal "archive-only inventory movement count" "$source_archived_inventory_movements" "$target_archived_inventory_movements"
assert_zero "target monetary ledger has no null/non-positive invoices" "$target_nonpositive_invoices"
assert_zero "legacyInvoiceReferences metadata is always an array" "$target_bad_archive_shape"

compare_exact_set   "archive-only invoice identity/order preservation"   "archive-invoices"   "select jsonb_build_array(order_id,id,invoice_number,invoice_date,metadata)::text
     from erp_supply.invoices
    where amount is null or amount<=0"   "select jsonb_build_array(
            o.id,
            ref->'id',
            ref->'invoiceNumber',
            ref->'invoiceDate',
            ref->'metadata'
          )::text
     from erp_supply.orders o
     cross join lateral jsonb_array_elements(
       case
         when jsonb_typeof(o.metadata->'legacyInvoiceReferences')='array'
           then o.metadata->'legacyInvoiceReferences'
         else '[]'::jsonb
       end
     ) ref"

compare_exact_set   "material variant identity/material/code/label preservation"   "material-variants"   "select jsonb_build_array(id,material_master_id,normalized_label,variant_label)::text
     from erp_supply.material_variants"   "select jsonb_build_array(id,material_id,code,label)::text
     from erp_supply.material_variants
    where attributes->>'migrationSource'='CRM-SUMINISTROS'"

compare_exact_set   "archive-only inventory movement identity preservation"   "archive-inventory-movements"   "select jsonb_build_array(
            m.id,
            m.movement_type,
            trim_scale(m.quantity),
            m.unit,
            m.inventory_item_id,
            m.lot_id,
            m.order_id,
            m.from_location,
            m.to_location,
            m.reference
          )::text
     from erp_supply.inventory_movements m
     left join erp_supply.inventory_items i on i.id=m.inventory_item_id
     left join erp_supply.inventory_lots l on l.id=m.lot_id
    where not (
      coalesce(i.active,false)
      and coalesce(l.source_active,true)
      and i.material_master_id is not null
    )"   "select jsonb_build_array(
            (op.result->>'legacyMovementId')::bigint,
            op.result->>'legacyMovementType',
            trim_scale((op.result->>'quantity')::numeric),
            op.result->>'unit',
            nullif(op.result->>'legacyInventoryItemId','')::uuid,
            nullif(op.result->>'legacyLotId','')::uuid,
            nullif(op.result->>'legacyOrderId','')::uuid,
            op.result->>'legacyFromLocation',
            op.result->>'legacyToLocation',
            op.result->>'legacyReference'
          )::text
     from erp_supply.inventory_operations op
    where op.operation_type='LEGACY_HISTORY'
      and op.result->>'migrationSource'='CRM-SUMINISTROS'
      and coalesce((op.result->>'archiveOnly')::boolean,false)"

compare_exact_set   "legacy Auth identity preservation"   "legacy-auth"   "select jsonb_build_array(id,auth_user_id)::text
     from erp_supply.profiles
    where auth_user_id is not null"   "select jsonb_build_array(id,(preferences->>'legacyAuthUserId')::uuid)::text
     from erp_supply.profiles
    where preferences->>'legacyAuthUserId' is not null"

compare_exact_set   "monetary invoice identity/order/amount preservation"   "monetary-invoices"   "select jsonb_build_array(id,order_id,invoice_number,invoice_date,trim_scale(amount),currency)::text
     from erp_supply.invoices
    where amount>0"   "select jsonb_build_array(id,order_id,invoice_number,invoice_date,trim_scale(amount),currency)::text
     from erp_supply.invoices
    where amount>0
      and metadata->>'migrationSource'='CRM-SUMINISTROS'"

if [ "$fail" -ne 0 ]; then
  exit 7
fi

echo "PASS real-source transform semantic identity checks."
