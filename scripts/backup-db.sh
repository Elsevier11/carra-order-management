#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/db}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_NAME="${POSTGRES_DB:-${DB_DATABASE:-carra_consegne}}"
DB_USER="${POSTGRES_USER:-carra}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%F_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

if [[ "$COMPOSE_FILE" = /* || "$COMPOSE_FILE" =~ ^[A-Za-z]:[\\/].* ]]; then
  COMPOSE_PATH="$COMPOSE_FILE"
else
  COMPOSE_PATH="$ROOT_DIR/$COMPOSE_FILE"
fi

if [[ "$BACKUP_DIR" != /* && ! "$BACKUP_DIR" =~ ^[A-Za-z]:[\\/].* ]]; then
  BACKUP_DIR="$ROOT_DIR/$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
fi

mkdir -p "$BACKUP_DIR"

echo "Creating compressed SQL dump: $BACKUP_FILE"
docker compose -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" sh -lc \
  "pg_dump -U '$DB_USER' -d '$DB_NAME' -Fp" | gzip -c > "$BACKUP_FILE"

echo "Pruning backups older than $RETENTION_DAYS days in $BACKUP_DIR"
find "$BACKUP_DIR" -type f -name 'db_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup completed: $BACKUP_FILE"
