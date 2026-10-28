#!/bin/bash

# ==============================================================================
# Script: scripts/clean.sh
# Purpose: Clean all application data from PostgreSQL and flush Redis cache
# ==============================================================================

set -e

# Load REDIS_PASSWORD from .env if available
REDIS_PASS="myStrongPassword"
if [ -f .env ]; then
  ENV_PASS=$(grep -E '^REDIS_PASSWORD=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
  if [ -n "$ENV_PASS" ]; then
    REDIS_PASS="$ENV_PASS"
  fi
fi

POSTGRES_CONTAINER="allround-server-postgres"
REDIS_CONTAINER="allround-server-redis"

echo "🧹 Starting full Database & Redis cleanup..."

# 1. Check PostgreSQL container
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  echo "❌ Error: Container ${POSTGRES_CONTAINER} is not running."
  exit 1
fi

# 2. Check Redis container
if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
  echo "❌ Error: Container ${REDIS_CONTAINER} is not running."
  exit 1
fi

# 3. Clean PostgreSQL Application Tables
echo "📦 Truncating PostgreSQL application tables..."
docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d allround-server -c "
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE' 
          AND table_name NOT IN ('spatial_ref_sys', '_prisma_migrations')
    ) LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE;', r.table_name);
    END LOOP;
END \$\$;
" > /dev/null

echo "✅ PostgreSQL application tables truncated successfully."

# 4. Flush Redis Cache
echo "⚡ Flushing Redis cache..."
docker exec -i "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASS" FLUSHDB > /dev/null 2>&1

echo "✅ Redis cache flushed successfully."

echo "🎉 Full database and Redis cleanup completed!"
