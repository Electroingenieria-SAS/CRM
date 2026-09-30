#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?SOURCE_DB_URL is required}"
: "${LOCAL_ADMIN_DB_URL:?LOCAL_ADMIN_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "1/8 Real logical backup + restore clone rehearsal"
bash "$ROOT/scripts/migration/restore-rehearsal.sh"

echo "2/8 Validate live source integrity and target compatibility"
psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/source-validate.sql"
psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/migration/source-compatibility.sql"

echo "3/8 Stage real legacy operational dataset into clean local target"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/stage-legacy.sh"

echo "4/8 Transform staged legacy data into target model"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/transform-from-legacy.sql"

echo "5/8 Validate target invariants and full reconciliation"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/validate-critical.sql"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/reconcile.sh"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/reconcile-active-orders.sh"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/validate-real-transform.sh"

echo "6/8 Re-stage live source for idempotent recovery rehearsal"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/stage-legacy.sh"

echo "7/8 Re-run transform and reconciliation"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/transform-from-legacy.sql"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/validate-critical.sql"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/reconcile.sh"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/reconcile-active-orders.sh"
SOURCE_DB_URL="$SOURCE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL"   bash "$ROOT/scripts/migration/validate-real-transform.sh"

echo "8/8 PASS real source backup -> restore -> transform -> reconcile -> rerun rehearsal."
