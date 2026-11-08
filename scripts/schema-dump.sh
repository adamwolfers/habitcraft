#!/bin/bash

# Generate server/schema/schema.sql from the migrations, or verify the
# committed file still matches them.
#
# Usage:
#   ./scripts/schema-dump.sh            regenerate server/schema/schema.sql in place
#   ./scripts/schema-dump.sh --check    fail (with a diff) if it is out of date
#
# The migrations (server/schema/migrations/) are the ONLY source of truth for
# the schema (habitcraft-by9). schema.sql is a generated, human-readable view
# of what they add up to; nothing executes it. It exists so schema changes are
# reviewable as a diff, and it is trustworthy only because this script
# re-derives it and CI fails on any difference -- see db/README.md.
#
# The migrations are applied by "habitcraft migrate", the same command every
# other environment runs, built from server/Dockerfile's migrate target. So
# this check also proves the Go runner builds exactly the committed schema
# (habitcraft-vxln.6.1). dbmate is used only for its bundled pg_dump.
#
# The dump is produced in a THROWAWAY postgres container, not against the dev
# or test database, so it depends on nothing being up and cannot be polluted by
# hand-applied local changes. The dbmate and postgres images are pinned BY
# DIGEST: pg_dump output is version-sensitive on both the client and the
# server, so a moving tag would eventually shift the dump underneath this check
# and turn CI red for no schema change at all. To move to newer images, bump
# both digests here in one commit and regenerate.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="$PROJECT_ROOT/server/schema/schema.sql"

# Pinned by digest -- see the note above before changing either of these.
# dbmate 2.35.0 (bundles pg_dump 18.4) / postgres 14.24
DBMATE_IMAGE="ghcr.io/amacneil/dbmate@sha256:e55099476e99559509846f44505d92c92d4861e699de9546a852320a7f667e0d"
POSTGRES_IMAGE="postgres@sha256:727876d274666da0b92a445390ba093c84b8e9f8343e1c53cd4e9a7ab2d85310"

CHECK_MODE=false
case "${1:-}" in
    --check) CHECK_MODE=true ;;
    -h|--help)
        sed -n '3,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    "") ;;
    *) echo "Unknown parameter: $1" >&2; exit 1 ;;
esac

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running -- this script generates the dump in a container."
    exit 1
fi

# Unique per invocation so a stale container from an interrupted run can never
# be reused (it would hold an already-migrated database and hide a bad migration).
SUFFIX="schema-dump-$$"
NETWORK="habitcraft-$SUFFIX"
PG_CONTAINER="habitcraft-pg-$SUFFIX"
MIGRATE_IMAGE="habitcraft-migrate:$SUFFIX"
WORKDIR=$(mktemp -d)

cleanup() {
    docker rm -f "$PG_CONTAINER" > /dev/null 2>&1 || true
    docker network rm "$NETWORK" > /dev/null 2>&1 || true
    docker image rm "$MIGRATE_IMAGE" > /dev/null 2>&1 || true
    rm -rf "$WORKDIR"
}
trap cleanup EXIT

# The migrations are embedded in the binary, so this builds from the working
# tree and mounts nothing.
echo "Building habitcraft migrate (server/Dockerfile, target migrate)..."
docker build --quiet --target migrate -f "$PROJECT_ROOT/server/Dockerfile" \
    -t "$MIGRATE_IMAGE" "$PROJECT_ROOT" > /dev/null

docker network create "$NETWORK" > /dev/null

docker run -d --rm \
    --name "$PG_CONTAINER" \
    --network "$NETWORK" \
    -e POSTGRES_DB=habitcraft \
    -e POSTGRES_USER=habituser \
    -e POSTGRES_PASSWORD=habitpass \
    "$POSTGRES_IMAGE" > /dev/null

DB_URL="postgresql://habituser:habitpass@$PG_CONTAINER:5432/habitcraft?sslmode=disable"

echo "Applying the migrations to a throwaway database..."
# migrate waits for the database itself, as dbmate's --wait did.
docker run --rm --network "$NETWORK" -e "DATABASE_URL=$DB_URL" "$MIGRATE_IMAGE"

# dbmate dump writes --schema-file, here /db/schema.sql in the mounted WORKDIR.
echo "Dumping schema..."
docker run --rm \
    --network "$NETWORK" \
    -v "$WORKDIR:/db" \
    -e "DATABASE_URL=$DB_URL" \
    "$DBMATE_IMAGE" --wait --wait-timeout 60s --schema-file /db/schema.sql dump

# pg_dump stamps its own version and the server's into two header comments.
# They say nothing about the schema and would make the committed file churn on
# every image bump, so they never reach it.
GENERATED="$WORKDIR/schema.generated.sql"
grep -v '^-- Dumped \(from database\|by pg_dump\) version ' "$WORKDIR/schema.sql" > "$GENERATED"

# A dump that lost its tables would otherwise be written out or compared as if
# it were legitimate, and in --check mode an empty file matching an empty file
# would report success.
if ! grep -q '^CREATE TABLE ' "$GENERATED"; then
    echo "❌ The generated dump contains no CREATE TABLE statements -- refusing to use it."
    echo "   Something went wrong applying the migrations or dumping the result."
    exit 1
fi

if [ "$CHECK_MODE" = false ]; then
    cp "$GENERATED" "$SCHEMA_FILE"
    echo "✅ Wrote server/schema/schema.sql"
    exit 0
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ server/schema/schema.sql is missing. Run ./scripts/schema-dump.sh and commit it."
    exit 1
fi

if diff -u "$SCHEMA_FILE" "$GENERATED" > "$WORKDIR/schema.diff"; then
    echo "✅ server/schema/schema.sql matches the migrations"
    exit 0
fi

echo ""
echo "❌ server/schema/schema.sql does not match what the migrations produce."
echo "   The migrations are the source of truth; schema.sql is generated."
echo "   Regenerate and commit it:  ./scripts/schema-dump.sh"
echo ""
echo "--- committed server/schema/schema.sql"
echo "+++ generated from server/schema/migrations/"
sed '1,2d' "$WORKDIR/schema.diff"
exit 1
