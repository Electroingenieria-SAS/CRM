#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/source-active-orders-snapshot.sql" > "$TMP/source.json"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/active-orders-snapshot.sql" > "$TMP/target.json"

node - "$TMP/source.json" "$TMP/target.json" <<'NODE'
const fs=require('fs');
const [s,t]=process.argv.slice(2);
const source=JSON.parse(fs.readFileSync(s,'utf8') || '[]');
const target=JSON.parse(fs.readFileSync(t,'utf8') || '[]');
const normalize = rows => [...(rows||[])].sort((a,b)=>String(a.order_id).localeCompare(String(b.order_id)));
const a=normalize(source), b=normalize(target);
if (JSON.stringify(a)!==JSON.stringify(b)) {
  console.error('FAIL active order reconciliation differs');
  console.error('source active orders:', a.length);
  console.error('target active orders:', b.length);
  process.exit(5);
}
console.log(`PASS active order reconciliation: ${a.length} active order(s)`);
NODE
