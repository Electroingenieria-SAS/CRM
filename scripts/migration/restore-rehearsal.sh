#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${LOCAL_ADMIN_DB_URL:?LOCAL_ADMIN_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
RESTORE_DB="hilo15_restore"
LOCAL_BASE="${LOCAL_ADMIN_DB_URL%/*}"
LEGACY_DB_URL="${LOCAL_BASE}/${RESTORE_DB}"

cleanup() {
  psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1     -c "drop database if exists ${RESTORE_DB} with (force);" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

tables=(
  erp_supply.organizations
  erp_supply.profiles
  erp_supply.profile_roles
  erp_supply.roles
  erp_supply.orders
  erp_supply.order_items
  erp_supply.order_tasks
  erp_supply.invoices
  erp_supply.material_master
  erp_supply.material_variants
  erp_supply.inventory_items
  erp_supply.inventory_lots
  erp_supply.material_reservations
  erp_supply.inventory_movements
  erp_supply.deliveries
  erp_supply.work_activity_catalog
  erp_supply.work_assignments
  erp_supply.work_assignment_members
  erp_supply.work_executions
  erp_supply.work_evidence
  erp_supply.system_audit
)

dump_args=(
  --format=custom
  --no-owner
  --no-privileges
  --section=pre-data
  --section=data
)
for table in "${tables[@]}"; do
  dump_args+=("--table=$table")
done

echo "Creating temporary logical dump of critical operational data..."
pg_dump "$SOURCE_DB_URL" "${dump_args[@]}" --file "$TMP/source.dump"
test -s "$TMP/source.dump"

checksum="$(sha256sum "$TMP/source.dump" | awk '{print $1}')"
echo "PASS dump created; sha256=$checksum"

echo "Creating isolated local restore database..."
psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
  -c "drop database if exists ${RESTORE_DB} with (force);" \
  -c "create database ${RESTORE_DB};" >/dev/null
psql "$LEGACY_DB_URL" -v ON_ERROR_STOP=1 \
  -c "create schema if not exists erp_supply;" >/dev/null

echo "Restoring critical operational dump..."
pg_restore --exit-on-error --no-owner --no-privileges   --dbname "$LEGACY_DB_URL" "$TMP/source.dump"

echo "Validating restored clone compatibility..."
psql "$LEGACY_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/source-compatibility.sql"

echo "Comparing source and restored clone snapshots..."
psql "$SOURCE_DB_URL" -qAt -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/source-snapshot.sql" > "$TMP/source.json"
psql "$LEGACY_DB_URL" -qAt -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/source-snapshot.sql" > "$TMP/clone.json"
psql "$SOURCE_DB_URL" -qAt -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/source-active-orders-snapshot.sql" > "$TMP/source-active.json"
psql "$LEGACY_DB_URL" -qAt -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/source-active-orders-snapshot.sql" > "$TMP/clone-active.json"

node - "$TMP/source.json" "$TMP/clone.json" "$TMP/source-active.json" "$TMP/clone-active.json" <<'NODE'
const fs=require('fs');
const [sourcePath,clonePath,sourceActivePath,cloneActivePath]=process.argv.slice(2);
const parse=(p)=>JSON.parse(fs.readFileSync(p,'utf8')||'null');
const source=parse(sourcePath);
const clone=parse(clonePath);
const sourceActive=parse(sourceActivePath);
const cloneActive=parse(cloneActivePath);
if(JSON.stringify(source)!==JSON.stringify(clone)){
  console.error('FAIL restored clone aggregate snapshot differs from source');
  process.exit(4);
}
if(JSON.stringify(sourceActive)!==JSON.stringify(cloneActive)){
  console.error('FAIL restored clone active-order snapshot differs from source');
  process.exit(5);
}
console.log('PASS restored clone aggregate snapshot matches source');
console.log('PASS restored clone active-order snapshot matches source');
NODE

echo "Staging restored clone into the clean target..."
SOURCE_DB_URL="$LEGACY_DB_URL" TARGET_DB_URL="$LOCAL_ADMIN_DB_URL" \
  bash "$ROOT/scripts/migration/stage-legacy.sh"

echo "Transforming restored clone into target model..."
psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/transform-from-legacy.sql"

echo "Validating transformed target..."
psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/validate-critical.sql"

echo "Reconciling restored source against transformed target..."
SOURCE_DB_URL="$LEGACY_DB_URL" TARGET_DB_URL="$LOCAL_ADMIN_DB_URL" \
  bash "$ROOT/scripts/migration/reconcile.sh"
SOURCE_DB_URL="$LEGACY_DB_URL" TARGET_DB_URL="$LOCAL_ADMIN_DB_URL" \
  bash "$ROOT/scripts/migration/reconcile-active-orders.sh"

echo "PASS real backup -> restore -> transform -> reconciliation rehearsal completed."
