#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DB_URL:?RESTORE_DB_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${CONFIRM_NON_PRODUCTION:?Set CONFIRM_NON_PRODUCTION=YES_NON_PRODUCTION}"

if [[ "${CONFIRM_NON_PRODUCTION}" != "YES_NON_PRODUCTION" ]]; then
  echo "Refusing restore: explicit non-production confirmation missing." >&2
  exit 2
fi

for file in roles.sql schema.sql data.sql SHA256SUMS; do
  test -f "${BACKUP_DIR}/${file}" || {
    echo "Missing ${file} in backup directory." >&2
    exit 3
  }
done

(
  cd "${BACKUP_DIR}"
  sha256sum -c SHA256SUMS
)

psql   --single-transaction   --variable ON_ERROR_STOP=1   --file "${BACKUP_DIR}/roles.sql"   --file "${BACKUP_DIR}/schema.sql"   --command 'SET session_replication_role = replica'   --file "${BACKUP_DIR}/data.sql"   --dbname "${RESTORE_DB_URL}"

psql "${RESTORE_DB_URL}" --variable ON_ERROR_STOP=1 <<'SQL'
select count(*) as organizations from erp_supply.organizations;
select count(*) as roles from erp_supply.roles;
select count(*) as profiles from erp_supply.profiles;
select count(*) as orders from erp_supply.orders;
SQL

echo "Non-production restore smoke completed."
