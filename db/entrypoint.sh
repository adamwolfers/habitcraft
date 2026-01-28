#!/bin/sh
set -e

# If DATABASE_URL is not set but components are, construct it
if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ]; then
    # For Cloud SQL socket connections, host starts with /
    if echo "$DB_HOST" | grep -q "^/"; then
        export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=${DB_HOST}"
    else
        export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?sslmode=disable"
    fi
fi

# Run dbmate with wait and any passed arguments
exec dbmate --wait --wait-timeout 60s "$@"
