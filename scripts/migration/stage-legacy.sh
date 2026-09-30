#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/legacy-staging-schema.sql"

tables=("organizations" "profiles" "profile_roles" "orders" "order_items" "order_tasks" "invoices" "material_master" "material_variants" "inventory_items" "inventory_lots" "material_reservations" "deliveries")

for table in "${tables[@]}"; do
  file="$TMP/$table.csv"
  echo "Staging legacy table: $table"
  psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
    -c "\\copy erp_supply.$table to '$file' with (format csv, header true)"
  chmod 600 "$file"
  psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
    -c "\\copy migration_legacy.$table from '$file' with (format csv, header true)"
done

echo "PASS legacy operational dataset staged without database superuser privileges."
