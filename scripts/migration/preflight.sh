#!/usr/bin/env bash
set -euo pipefail

: "${HILO14_CERTIFIED:?Set HILO14_CERTIFIED=YES only after PR #25 is merged and green}"
: "${RESTORE_REHEARSAL_OK:?Set RESTORE_REHEARSAL_OK=YES only after a real non-production restore}"
: "${VERCEL_PREVIEW_OK:?Set VERCEL_PREVIEW_OK=YES only after the new CRM preview smoke}"
: "${ROLLBACK_READY:?Set ROLLBACK_READY=YES after rollback paths are verified}"

for flag in HILO14_CERTIFIED RESTORE_REHEARSAL_OK VERCEL_PREVIEW_OK ROLLBACK_READY; do
  if [[ "${!flag}" != "YES" ]]; then
    echo "NO-GO: ${flag} is not YES" >&2
    exit 2
  fi
done

echo "Preflight gates acknowledged. This script does not modify production."
