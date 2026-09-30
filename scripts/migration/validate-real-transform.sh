#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

query_scalar() {
  local db_url="$1"
  local sql="$2"
  psql "$db_url" -qAt -v ON_ERROR_STOP=1 -c "$sql"
}

source_archive_refs="$(query_scalar "$SOURCE_DB_URL" "select count(*) from erp_supply.invoices where amount is null or amount<=0")"
target_archive_refs="$(query_scalar "$TARGET_DB_URL" "select coalesce(sum(jsonb_array_length(coalesce(metadata->'legacyInvoiceReferences','[]'::jsonb))),0) from erp_supply.orders")"

source_variants="$(query_scalar "$SOURCE_DB_URL" "select count(*) from erp_supply.material_variants")"
target_variants="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.material_variants where attributes->>'migrationSource'='CRM-SUMINISTROS'")"

source_auth_links="$(query_scalar "$SOURCE_DB_URL" "select count(*) from erp_supply.profiles where auth_user_id is not null")"
target_auth_refs="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.profiles where preferences->>'legacyAuthUserId' is not null")"

target_nonpositive_invoices="$(query_scalar "$TARGET_DB_URL" "select count(*) from erp_supply.invoices where amount<=0")"

fail=0

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

assert_equal "archive-only invoice references" "$source_archive_refs" "$target_archive_refs"
assert_equal "material variants" "$source_variants" "$target_variants"
assert_equal "legacy Auth profile references" "$source_auth_links" "$target_auth_refs"

if [ "$target_nonpositive_invoices" = "0" ]; then
  echo "PASS target monetary ledger has no non-positive invoices"
else
  echo "FAIL target monetary ledger contains $target_nonpositive_invoices non-positive invoice(s)" >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 7
fi

echo "PASS real-source transform semantic checks."
