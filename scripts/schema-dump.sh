#!/bin/bash

# Generate db/schema.sql from db/migrations/, or verify the committed file
# still matches those migrations.
#
# Usage:
#   ./scripts/schema-dump.sh            regenerate db/schema.sql in place
#   ./scripts/schema-dump.sh --check    fail (with a diff) if it is out of date
#
# db/migrations/ is the ONLY source of truth for the schema (habitcraft-by9).
# db/schema.sql is a generated, human-readable view of what those migrations
# add up to; nothing executes it. It exists so schema changes are reviewable as
# a diff, and it is trustworthy only because this script re-derives it and CI
# fails on any difference -- see db/README.md.
#
# The dump is produced in a THROWAWAY postgres container, not against the dev
# or test database, so it depends on nothing being up and cannot be polluted by
# hand-applied local changes. Both images are pinned BY DIGEST: pg_dump output
# is version-sensitive on both the client and the server, so a moving tag would
# eventually shift the dump underneath this check and turn CI red for no
# schema change at all. To move to newer images, bump both digests here in one
# commit and regenerate.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="$PROJECT_ROOT/db/schema.sql"

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
WORKDIR=$(mktemp -d)

cleanup() {
    docker rm -f "$PG_CONTAINER" > /dev/null 2>&1 || true
    docker network rm "$NETWORK" > /dev/null 2>&1 || true
    rm -rf "$WORKDIR"
}
trap cleanup EXIT

# dbmate resolves ./db/migrations relative to its working directory (/), so the
# staging dir is mounted at /db and the dump lands at /db/schema.sql.
cp -R "$PROJECT_ROOT/db/migrations" "$WORKDIR/migrations"

docker network create "$NETWORK" > /dev/null

docker run -d --rm \
    --name "$PG_CONTAINER" \
    --network "$NETWORK" \
    -e POSTGRES_DB=habitcraft \
    -e POSTGRES_USER=habituser \
    -e POSTGRES_PASSWORD=habitpass \
    "$POSTGRES_IMAGE" > /dev/null

DB_URL="postgresql://habituser:habitpass@$PG_CONTAINER:5432/habitcraft?sslmode=disable"

run_dbmate() {
    docker run --rm \
        --network "$NETWORK" \
        -v "$WORKDIR:/db" \
        -e "DATABASE_URL=$DB_URL" \
        "$DBMATE_IMAGE" --wait --wait-timeout 60s "$@"
}

echo "Applying db/migrations/ to a throwaway database..."
run_dbmate --no-dump-schema up
echo "Dumping schema..."
run_dbmate dump

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
    echo "   Something went wrong applying db/migrations/ or dumping the result."
    exit 1
fi

if [ "$CHECK_MODE" = false ]; then
    cp "$GENERATED" "$SCHEMA_FILE"
    echo "✅ Wrote db/schema.sql"
    exit 0
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ db/schema.sql is missing. Run ./scripts/schema-dump.sh and commit it."
    exit 1
fi

if diff -u "$SCHEMA_FILE" "$GENERATED" > "$WORKDIR/schema.diff"; then
    echo "✅ db/schema.sql matches db/migrations/"
    exit 0
fi

echo ""
echo "❌ db/schema.sql does not match what db/migrations/ produces."
echo "   db/migrations/ is the source of truth; db/schema.sql is generated."
echo "   Regenerate and commit it:  ./scripts/schema-dump.sh"
echo ""
echo "--- committed db/schema.sql"
echo "+++ generated from db/migrations/"
sed '1,2d' "$WORKDIR/schema.diff"
exit 1
