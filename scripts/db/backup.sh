#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_BACKUP_DIR="${ROOT_DIR}/backups/db"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUTPUT_PATH="${1:-${DEFAULT_BACKUP_DIR}/backup_${TIMESTAMP}.dump}"

resolve_database_url() {
  node <<'NODE'
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const cwd = process.cwd()
const files = ['.env', '.env.local']
const merged = {}

for (const file of files) {
  const filePath = path.join(cwd, file)
  if (!fs.existsSync(filePath)) continue
  Object.assign(merged, dotenv.parse(fs.readFileSync(filePath)))
}

if (process.env.DATABASE_URL) merged.DATABASE_URL = process.env.DATABASE_URL
process.stdout.write(merged.DATABASE_URL ?? '')
NODE
}

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is not installed. Install PostgreSQL client tools first." >&2
  exit 1
fi

cd "${ROOT_DIR}"
DATABASE_URL_VALUE="$(resolve_database_url)"
if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "Error: DATABASE_URL is not set in environment, .env, or .env.local." >&2
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"
echo "Creating database backup at: ${OUTPUT_PATH}"
pg_dump "${DATABASE_URL_VALUE}" -Fc --no-owner --no-privileges -f "${OUTPUT_PATH}"
echo "Backup completed successfully."

