#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_ROOT}/${STAMP}"

umask 077
mkdir -p "${TARGET}"

supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${TARGET}/roles.sql" --role-only
supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${TARGET}/schema.sql"
supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${TARGET}/data.sql" --use-copy --data-only

(
  cd "${TARGET}"
  sha256sum roles.sql schema.sql data.sql > SHA256SUMS
)

printf 'Backup logical created at %s\n' "${TARGET}"
printf 'Move this directory to encrypted off-site storage; do not commit it.\n'
