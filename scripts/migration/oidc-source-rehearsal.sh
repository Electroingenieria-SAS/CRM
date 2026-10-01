#!/usr/bin/env bash
set -euo pipefail

: "${LOCAL_ADMIN_DB_URL:?LOCAL_ADMIN_DB_URL is required}"
: "${SOURCE_EXPORT_URL:?SOURCE_EXPORT_URL is required}"
: "${ACTIONS_ID_TOKEN_REQUEST_URL:?ACTIONS_ID_TOKEN_REQUEST_URL is required}"
: "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:?ACTIONS_ID_TOKEN_REQUEST_TOKEN is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
SOURCE_DB="hilo15_oidc_source"
LOCAL_BASE="${LOCAL_ADMIN_DB_URL%/*}"
SOURCE_DB_URL="${LOCAL_BASE}/${SOURCE_DB}"

cleanup() {
  psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
    -c "drop database if exists ${SOURCE_DB} with (force);" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
chmod 700 "$TMP"

oidc_token() {
  local sep='?'
  [[ "$ACTIONS_ID_TOKEN_REQUEST_URL" == *\?* ]] && sep='&'
  curl --fail --silent --show-error \
    -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
    "${ACTIONS_ID_TOKEN_REQUEST_URL}${sep}audience=crm-migration-source-export" |
    node -e '
      let input="";
      process.stdin.on("data",c=>input+=c);
      process.stdin.on("end",()=>{
        const parsed=JSON.parse(input);
        if(!parsed.value) process.exit(2);
        process.stdout.write(parsed.value);
      });
    '
}

request_to_file() {
  local url="$1"
  local output="$2"
  local token
  token="$(oidc_token)"
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/json,text/plain" \
    "$url" -o "$output"
}

read_fingerprint() {
  local table="$1"
  local output="$2"
  request_to_file "${SOURCE_EXPORT_URL}?mode=fingerprint&table=${table}" "$output"
  node - "$output" <<'NODE'
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(!Number.isInteger(p.count) || typeof p.digest!=="string" || !p.digest) process.exit(3);
process.stdout.write(String(p.count)+" "+p.digest+"\\n");
NODE
}

local_fingerprint() {
  local file="$1"
  node - "$file" <<'NODE'
const fs=require("fs");
const crypto=require("crypto");
const lines=fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/).filter(Boolean);
const hashes=lines.map(line=>{
  const raw=Buffer.from(line,"base64").toString("utf8");
  JSON.parse(raw);
  return crypto.createHash("md5").update(raw).digest("hex");
}).sort();
const digest=crypto.createHash("md5").update(hashes.join("")).digest("hex");
process.stdout.write(String(lines.length)+" "+digest+"\\n");
NODE
}

echo "Creating isolated OIDC source clone..."
psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1 \
  -c "drop database if exists ${SOURCE_DB} with (force);" \
  -c "create database ${SOURCE_DB};" >/dev/null

psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/legacy-staging-schema.sql" >/dev/null
psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
  -c "alter schema migration_legacy rename to erp_supply;" \
  -c "create table public._migration_raw_import(payload text not null);" >/dev/null

tables=(
  organizations roles profiles profile_roles orders order_items order_tasks invoices
  material_master material_variants inventory_items inventory_lots material_reservations
  deliveries inventory_movements work_activity_catalog work_assignments
  work_assignment_members work_executions work_evidence system_audit
)

health="$TMP/health.json"
request_to_file "${SOURCE_EXPORT_URL}?mode=health" "$health"
node - "$health" <<'NODE'
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(p.ok!==true || p.repository!=="Electroingenieria-SAS/CRM") process.exit(4);
console.log("PASS OIDC source export health");
NODE

for table in "${tables[@]}"; do
  echo "Exporting production table via OIDC: $table"
  before="$TMP/$table.before.json"
  after="$TMP/$table.after.json"
  payload="$TMP/$table.b64"
  : >"$payload"

  read -r expected_count expected_digest < <(read_fingerprint "$table" "$before")

  offset=0
  while :; do
    page="$TMP/$table.$offset.page"
    token="$(oidc_token)"
    curl --fail --silent --show-error \
      -H "Authorization: Bearer $token" \
      "${SOURCE_EXPORT_URL}?mode=table&table=${table}&offset=${offset}&limit=250" \
      -o "$page"

    rows="$(awk 'NF{c++} END{print c+0}' "$page")"
    if [ "$rows" -gt 0 ]; then
      cat "$page" >>"$payload"
      offset=$((offset + rows))
    fi
    [ "$rows" -lt 250 ] && break
  done

  read -r final_count final_digest < <(read_fingerprint "$table" "$after")
  read -r local_count local_digest < <(local_fingerprint "$payload")

  if [ "$expected_count" != "$final_count" ] || [ "$expected_digest" != "$final_digest" ]; then
    echo "FAIL source changed during OIDC export for $table" >&2
    exit 8
  fi
  if [ "$local_count" != "$final_count" ] || [ "$local_digest" != "$final_digest" ]; then
    echo "FAIL OIDC transport fingerprint mismatch for $table" >&2
    exit 9
  fi

  psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
    -c "truncate public._migration_raw_import;" >/dev/null
  psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
    -c "\\copy public._migration_raw_import(payload) from '$payload' with (format text)" >/dev/null
  psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
    -c "insert into erp_supply.$table
        select (json_populate_record(
          null::erp_supply.$table,
          convert_from(decode(payload,'base64'),'UTF8')::json
        )).*
        from public._migration_raw_import;" >/dev/null

  echo "PASS $table: $local_count row(s), fingerprint verified"
done

psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
  -c "drop table public._migration_raw_import;" >/dev/null

echo "Validating real exported source compatibility..."
psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/source-compatibility.sql"

echo "Running existing dump -> restore -> transform -> reconciliation pipeline..."
SOURCE_DB_URL="$SOURCE_DB_URL" LOCAL_ADMIN_DB_URL="$LOCAL_ADMIN_DB_URL" \
  bash "$ROOT/scripts/migration/restore-rehearsal.sh"

echo "PASS OIDC production source export -> local clone -> backup/restore -> transform -> reconciliation."
