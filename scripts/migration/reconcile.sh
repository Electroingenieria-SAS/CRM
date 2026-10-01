#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

chmod 700 "$TMP"

echo "Capturing source snapshot..."
psql "$SOURCE_DB_URL" -qAt -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/source-snapshot.sql" > "$TMP/source.json"

echo "Capturing target snapshot..."
psql "$TARGET_DB_URL" -qAt -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/snapshot.sql" > "$TMP/target.json"

node - "$TMP/source.json" "$TMP/target.json" <<'NODE'
const fs = require('fs');
const [sourcePath,targetPath]=process.argv.slice(2);
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const target=JSON.parse(fs.readFileSync(targetPath,'utf8'));
delete source.captured_at;
delete target.captured_at;

const critical=[
  'organizations','profiles','profile_roles','orders','order_items','invoices','archived_invoice_refs',
  'materials','shipments','inventory_movements','archived_inventory_movements','workforce_activities',
  'workforce_execution_events','workforce_evidence','legacy_audit_events'
];
let failed=false;
for(const key of critical){
  const ok=JSON.stringify(source[key])===JSON.stringify(target[key]);
  console.log(`${ok?'PASS':'FAIL'} ${key}: source=${JSON.stringify(source[key])} target=${JSON.stringify(target[key])}`);
  if(!ok) failed=true;
}
for(const key of ['invoice_amount_by_currency','orders_by_status','shipments_by_status']){
  const ok=JSON.stringify(source[key])===JSON.stringify(target[key]);
  console.log(`${ok?'PASS':'FAIL'} ${key}`);
  if(!ok) failed=true;
}
const numericPaths=[
  ['actual_freight_total'],
  ['inventory','physical_total'],
  ['inventory','committed_total'],
  ['inventory','erp_reserved_effective'],
  ['inventory','available_to_promise'],
  ['inventory','active_reservation_count'],
  ['inventory','active_reservation_requested']
];
const at=(obj,path)=>path.reduce((v,k)=>v?.[k],obj);
for(const path of numericPaths){
  const left=Number(at(source,path) ?? 0);
  const right=Number(at(target,path) ?? 0);
  const ok=Math.abs(left-right)<=0.0001;
  console.log(`${ok?'PASS':'FAIL'} ${path.join('.')}: source=${left} target=${right}`);
  if(!ok) failed=true;
}
if(failed) process.exit(4);
NODE

echo "Running referential validation on target..."
psql "$TARGET_DB_URL" -qAt -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/validate-critical.sql"

echo "Reconciliation completed."
