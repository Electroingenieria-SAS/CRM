#!/usr/bin/env bash
set -euo pipefail

: "${LOCAL_ADMIN_DB_URL:?LOCAL_ADMIN_DB_URL is required}"
: "${TARGET_DB_URL:?TARGET_DB_URL is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_DB="hilo15_fixture"
LOCAL_BASE="${LOCAL_ADMIN_DB_URL%/*}"
FIXTURE_DB_URL="${LOCAL_BASE}/${FIXTURE_DB}"

cleanup() {
  psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1     -c "drop database if exists ${FIXTURE_DB} with (force);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating synthetic legacy source database..."
psql "$LOCAL_ADMIN_DB_URL" -v ON_ERROR_STOP=1   -c "drop database if exists ${FIXTURE_DB} with (force);"   -c "create database ${FIXTURE_DB};" >/dev/null

psql "$FIXTURE_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/legacy-fixture.sql"

echo "Validating synthetic source compatibility..."
psql "$FIXTURE_DB_URL" -v ON_ERROR_STOP=1   -f "$ROOT/scripts/migration/source-compatibility.sql"

echo "Staging synthetic legacy data into nonprivileged target schema..."
SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/stage-legacy.sh"

echo "Transforming staged legacy source into clean target schema..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/transform-from-legacy.sql"

echo "Validating transformed target..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/validate-critical.sql"

SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/reconcile.sh"

SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/reconcile-active-orders.sh"
SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/validate-real-transform.sh"

psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/migrated-uat.sql"

echo "Re-staging synthetic legacy data for idempotent recovery..."
SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/stage-legacy.sh"

echo "Re-running transformation to validate idempotent recovery..."
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/transform-from-legacy.sql"

psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/validate-critical.sql"

SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/reconcile.sh"

SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/reconcile-active-orders.sh"
SOURCE_DB_URL="$FIXTURE_DB_URL" TARGET_DB_URL="$TARGET_DB_URL" \
  bash "$ROOT/scripts/migration/validate-real-transform.sh"

psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -f "$ROOT/scripts/migration/migrated-uat.sql"

echo "PASS synthetic legacy -> target transformation + rerun + migrated UAT."
