#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

chmod 700 "$TMP"

echo "Capturing source snapshot..."
psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/snapshot.sql" > "$TMP/source.json"

echo "Capturing target snapshot..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/snapshot.sql" > "$TMP/target.json"

node - "$TMP/source.json" "$TMP/target.json" <<'NODE'
const fs = require('fs');
const [sourcePath,targetPath]=process.argv.slice(2);
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const target=JSON.parse(fs.readFileSync(targetPath,'utf8'));
delete source.captured_at;
delete target.captured_at;

const critical=[
  'organizations','profiles','profile_roles','orders','order_items','invoices',
  'material_master','inventory_items','inventory_lots','inventory_movements',
  'material_reservations','work_assignments','work_executions','deliveries'
];
let failed=false;
for(const key of critical){
  const ok=JSON.stringify(source[key])===JSON.stringify(target[key]);
  console.log(`${ok?'PASS':'FAIL'} ${key}: source=${JSON.stringify(source[key])} target=${JSON.stringify(target[key])}`);
  if(!ok) failed=true;
}
for(const key of ['invoice_amount_by_currency','inventory_lot_totals','orders_by_status']){
  const ok=JSON.stringify(source[key])===JSON.stringify(target[key]);
  console.log(`${ok?'PASS':'FAIL'} ${key}`);
  if(!ok) failed=true;
}
if(failed) process.exit(4);
NODE

echo "Running referential validation on target..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/validate-critical.sql"

echo "Reconciliation completed."
