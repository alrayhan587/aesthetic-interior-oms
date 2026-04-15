#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/db/restore.sh <backup_file> <target_database_url> [--yes]

Examples:
  bash scripts/db/restore.sh backups/db/backup_2026-04-15_18-00-00.dump "$RESTORE_DATABASE_URL" --yes
  npm run db:restore -- backups/db/backup_2026-04-15_18-00-00.dump "$RESTORE_DATABASE_URL" --yes

Notes:
  - This command drops/recreates objects in the target database using --clean.
  - Do not restore directly into production without a verified plan.
USAGE
}

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Error: pg_restore is not installed. Install PostgreSQL client tools first." >&2
  exit 1
fi

BACKUP_FILE="${1:-}"
TARGET_DATABASE_URL="${2:-}"
CONFIRM_FLAG="${3:-}"

if [[ -z "${BACKUP_FILE}" || -z "${TARGET_DATABASE_URL}" ]]; then
  usage
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ "${CONFIRM_FLAG}" != "--yes" ]]; then
  echo "Refusing to restore without explicit confirmation."
  echo "Re-run with --yes as the third argument."
  exit 1
fi

if [[ "${TARGET_DATABASE_URL}" == *"ep-broad-wind-a1x6mkah.ap-southeast-1.aws.neon.tech"* ]]; then
  echo "Safety stop: target URL looks like your Neon production database host." >&2
  echo "Restore into a separate test/dev branch DB first." >&2
  exit 1
fi

echo "Restoring backup '${BACKUP_FILE}' into target database..."
pg_restore \
  --dbname="${TARGET_DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "${BACKUP_FILE}"
echo "Restore completed successfully."

