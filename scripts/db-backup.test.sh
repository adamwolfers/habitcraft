#!/bin/bash
# Tests for scripts/db-backup.sh and scripts/db-restore.sh (habitcraft-vxln.9.3):
#
#   scripts/db-backup.test.sh
#
# A backup that has never been restored is not a backup, so this proves the
# whole round trip: it seeds a database with the real migrations and the test
# fixtures, backs it up to a local S3-compatible store, restores the dump into
# an empty database and compares the two. Then retention pruning, and the
# failures that must exit non-zero rather than leave a silent gap.
#
# Runs in CI as the verify-db-backup job and as a phase of scripts/test-all.sh.
# Needs docker and curl, nothing else: every container is throwaway and
# uniquely named, so it touches neither the dev nor the test database.
#
# pg_dump and pg_restore run inside the postgres container through
# `docker exec`, which is exactly how docs/DEPLOYMENT.md has the host run them
# against the database accessory -- the client always matches the server.
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
backup="$here/db-backup.sh"
restore="$here/db-restore.sh"

# Pinned by digest, as scripts/schema-dump.sh pins its images, so an upstream
# release cannot change what this test means. postgres 14.24 is the version the
# compose stacks run. RustFS 1.0.6 stands in for the bucket: MinIO no longer
# publishes a pullable image.
POSTGRES_IMAGE="postgres@sha256:727876d274666da0b92a445390ba093c84b8e9f8343e1c53cd4e9a7ab2d85310"
S3_IMAGE="rustfs/rustfs@sha256:ee717072290bec9b11abfc0365f8310b00df1cd9b3639943edae47bdef05044a"

if ! docker info > /dev/null 2>&1; then
    echo "needs docker running" >&2
    exit 2
fi

suffix="db-backup-test-$$"
network="habitcraft-$suffix"
pg="habitcraft-pg-$suffix"
s3="habitcraft-s3-$suffix"
migrate_image="habitcraft-migrate:$suffix"
tmp=$(mktemp -d) || exit 2

cleanup() {
    docker rm -f "$pg" "$s3" > /dev/null 2>&1 || true
    docker network rm "$network" > /dev/null 2>&1 || true
    docker image rm "$migrate_image" > /dev/null 2>&1 || true
    rm -rf "$tmp"
}
trap cleanup EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; failures=$((failures + 1)); }

# --- Fixtures -----------------------------------------------------------------

echo "Building habitcraft migrate (server/Dockerfile, target migrate)..."
docker build --quiet --target migrate -f "$root/server/Dockerfile" \
    -t "$migrate_image" "$root" > /dev/null || exit 2

docker network create "$network" > /dev/null || exit 2
docker run -d --name "$pg" --network "$network" \
    -e POSTGRES_DB=habitcraft -e POSTGRES_USER=habituser -e POSTGRES_PASSWORD=habitpass \
    "$POSTGRES_IMAGE" > /dev/null || exit 2

S3_KEY=backuptestkey
S3_SECRET=backuptestsecret
docker run -d --name "$s3" --network "$network" -p 127.0.0.1::9000 \
    -e RUSTFS_ACCESS_KEY="$S3_KEY" -e RUSTFS_SECRET_KEY="$S3_SECRET" \
    "$S3_IMAGE" > /dev/null || exit 2
s3_port=$(docker port "$s3" 9000/tcp | head -1 | sed 's/.*://')
endpoint="http://127.0.0.1:$s3_port"
bucket=habitcraft-backups

# Raw S3 calls for the test's own setup and inspection.
s3c() {
    curl --silent --show-error --fail --aws-sigv4 "aws:amz:us-east-1:s3" \
        --user "$S3_KEY:$S3_SECRET" "$@"
}

# The store answers 503 until its storage is ready, so creating the bucket is
# also the readiness wait.
ready=0
for _ in $(seq 1 60); do
    if s3c -X PUT "$endpoint/$bucket" -o /dev/null 2> /dev/null; then ready=1; break; fi
    sleep 1
done
[ "$ready" -eq 1 ] || { echo "S3 store never became ready" >&2; exit 2; }

psql_in() { # psql_in <db> <args...>
    local db=$1; shift
    docker exec -i "$pg" psql -v ON_ERROR_STOP=1 -q -At -U habituser -d "$db" "$@"
}

echo "Seeding: migrations, then the test fixtures..."
docker run --rm --network "$network" \
    -e "DATABASE_URL=postgresql://habituser:habitpass@$pg:5432/habitcraft?sslmode=disable" \
    "$migrate_image" > "$tmp/seed.log" 2>&1 || { cat "$tmp/seed.log"; exit 2; }
psql_in habitcraft < "$root/shared/database/test-fixtures.sql" > "$tmp/seed.log" 2>&1 \
    || { cat "$tmp/seed.log"; exit 2; }

# What the scripts read. The URLs are as the postgres container sees itself,
# because pg_dump and pg_restore run inside it.
export BACKUP_S3_ENDPOINT="$endpoint"
export BACKUP_S3_BUCKET="$bucket"
export BACKUP_S3_REGION=us-east-1
export BACKUP_S3_ACCESS_KEY_ID="$S3_KEY"
export BACKUP_S3_SECRET_ACCESS_KEY="$S3_SECRET"
export BACKUP_S3_PREFIX="db/"
export PG_DUMP="docker exec -i $pg pg_dump"
export PG_RESTORE="docker exec -i $pg pg_restore"
src_url="postgresql://habituser:habitpass@localhost:5432/habitcraft"
url_of() { echo "postgresql://habituser:habitpass@localhost:5432/$1"; }

list_keys() { # every key in the bucket, sorted
    s3c "$endpoint/$bucket?list-type=2" | grep -o '<Key>[^<]*</Key>' \
        | sed -e 's/<Key>//' -e 's/<\/Key>//' | sort
}

# Every row of every table, in a stable order, as one comparable text.
table_contents() { # table_contents <db>
    local db=$1 t
    for t in $(psql_in "$db" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"); do
        echo "== $t"
        psql_in "$db" -c "COPY (SELECT * FROM \"$t\" ORDER BY 1) TO STDOUT"
    done
}

# --- Round trip ---------------------------------------------------------------

DATABASE_URL="$src_url" BACKUP_KEEP=5 "$backup" > "$tmp/out" 2>&1
rc=$?
keys=$(list_keys)
if [ "$rc" -eq 0 ] && echo "$keys" | grep -Eq '^db/habitcraft-[0-9]{8}T[0-9]{6}Z\.dump$'; then
    pass "backup uploads a dump named by UTC timestamp"
else
    fail "backup uploads a dump named by UTC timestamp (exit $rc, keys: $keys)"; cat "$tmp/out"
fi
first=$(echo "$keys" | grep '^db/habitcraft-' | tail -1 | sed 's|^db/||')

psql_in habitcraft -c "CREATE DATABASE restored" > /dev/null
DATABASE_URL="$(url_of restored)" "$restore" "$first" > "$tmp/out" 2>&1
rc=$?
users=$(psql_in restored -c "SELECT count(*) FROM users" 2> /dev/null || echo 0)
if [ "$rc" -eq 0 ] && [ "$users" -gt 0 ] \
    && [ "$(table_contents habitcraft)" = "$(table_contents restored)" ]; then
    pass "restore into an empty database finds the same rows ($users users)"
else
    fail "restore into an empty database finds the same rows (exit $rc, users $users)"; cat "$tmp/out"
fi

# The schema, read from the catalogs. Comparing two pg_dump --schema-only
# outputs does not work: Postgres deparses some CHECK constraints differently
# once they have been through a dump, which is the same constraint written two
# ways.
schema_of() { # schema_of <db>
    psql_in "$1" <<'SQL'
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1, 2;
SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1;
SELECT conrelid::regclass::text, conname, contype FROM pg_constraint
  WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2;
SELECT tgrelid::regclass::text, tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1, 2;
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY 1;
SQL
}
src_schema=$(schema_of habitcraft)
if [ -n "$src_schema" ] && [ "$src_schema" = "$(schema_of restored)" ]; then
    pass "restore reproduces the schema"
else
    fail "restore reproduces the schema"
    diff <(echo "$src_schema") <(schema_of restored) | head -20
fi

psql_in habitcraft -c "CREATE DATABASE restored_latest" > /dev/null
if DATABASE_URL="$(url_of restored_latest)" "$restore" latest > "$tmp/out" 2>&1 \
    && [ "$(table_contents habitcraft)" = "$(table_contents restored_latest)" ]; then
    pass "restore latest picks the newest dump"
else
    fail "restore latest picks the newest dump"; cat "$tmp/out"
fi

if DATABASE_URL="$src_url" "$restore" --list > "$tmp/out" 2>&1 && grep -qx "$first" "$tmp/out"; then
    pass "restore --list names the dumps"
else
    fail "restore --list names the dumps"; cat "$tmp/out"
fi

# Restoring over live data must fail as a whole, not merge half a dump in.
before=$(table_contents restored)
if DATABASE_URL="$(url_of restored)" "$restore" "$first" > "$tmp/out" 2>&1; then
    fail "restore into a non-empty database exits non-zero"
elif [ "$(table_contents restored)" != "$before" ]; then
    fail "restore into a non-empty database leaves it unchanged"
else
    pass "restore into a non-empty database exits non-zero and changes nothing"
fi

psql_in habitcraft -c "CREATE DATABASE restored_missing" > /dev/null
if DATABASE_URL="$(url_of restored_missing)" "$restore" habitcraft-19990101T000000Z.dump > "$tmp/out" 2>&1; then
    fail "restore of a dump that does not exist exits non-zero"
else
    pass "restore of a dump that does not exist exits non-zero"
fi

if DATABASE_URL="$(url_of restored_missing)" "$restore" ../etc/passwd > "$tmp/out" 2>&1; then
    fail "restore refuses a name that is not a dump name"
else
    pass "restore refuses a name that is not a dump name"
fi

# --- Retention ------------------------------------------------------------------

# Older dumps (fake contents are fine: pruning reads only names), plus objects
# that are not this script's dumps and must survive any pruning. From a file:
# S3 refuses the chunked upload curl sends for stdin.
echo old > "$tmp/old"
for k in db/habitcraft-20200101T000000Z.dump db/habitcraft-20200102T000000Z.dump \
    db/habitcraft-20200103T000000Z.dump db/notes.txt other/habitcraft-20200101T000000Z.dump; do
    s3c -T "$tmp/old" "$endpoint/$bucket/$k" -o /dev/null
done
before_keys=$(list_keys)

DATABASE_URL="$src_url" BACKUP_KEEP=3 "$backup" > "$tmp/out" 2>&1
rc=$?
after=$(list_keys)
dumps=$(echo "$after" | grep -E '^db/habitcraft-[0-9]{8}T[0-9]{6}Z\.dump$')
newest_old=$(echo "$before_keys" | grep -E '^db/habitcraft-' | tail -2)
expected_kept=$(printf '%s\n%s\n' "$newest_old" "$(echo "$dumps" | tail -1)" | sort -u)
if [ "$rc" -eq 0 ] && [ "$(echo "$dumps" | wc -l | tr -d ' ')" -eq 3 ] \
    && [ "$dumps" = "$expected_kept" ]; then
    pass "backup prunes to the newest BACKUP_KEEP dumps"
else
    fail "backup prunes to the newest BACKUP_KEEP dumps (exit $rc, dumps: $dumps)"; cat "$tmp/out"
fi
if echo "$after" | grep -qx db/notes.txt && echo "$after" | grep -qx other/habitcraft-20200101T000000Z.dump; then
    pass "pruning leaves objects that are not its dumps alone"
else
    fail "pruning leaves objects that are not its dumps alone (keys: $after)"
fi

# --- Failures -------------------------------------------------------------------

before_keys=$(list_keys)
if DATABASE_URL="$src_url" BACKUP_KEEP=1 BACKUP_S3_SECRET_ACCESS_KEY=wrong "$backup" > "$tmp/out" 2>&1; then
    fail "a rejected upload exits non-zero"
elif [ "$(list_keys)" != "$before_keys" ]; then
    fail "a rejected upload prunes nothing"
else
    pass "a rejected upload exits non-zero and prunes nothing"
fi

if DATABASE_URL="$src_url" BACKUP_S3_BUCKET=no-such-bucket "$backup" > "$tmp/out" 2>&1; then
    fail "an upload to a missing bucket exits non-zero"
else
    pass "an upload to a missing bucket exits non-zero"
fi

if DATABASE_URL="$src_url" BACKUP_S3_ENDPOINT="http://127.0.0.1:1" "$backup" > "$tmp/out" 2>&1; then
    fail "an unreachable store exits non-zero"
else
    pass "an unreachable store exits non-zero"
fi

before_keys=$(list_keys)
if DATABASE_URL="$(url_of no_such_db)" "$backup" > "$tmp/out" 2>&1; then
    fail "a failed pg_dump exits non-zero"
elif [ "$(list_keys)" != "$before_keys" ]; then
    fail "a failed pg_dump uploads nothing"
else
    pass "a failed pg_dump exits non-zero and uploads nothing"
fi

if env -u BACKUP_S3_BUCKET DATABASE_URL="$src_url" "$backup" > "$tmp/out" 2>&1; then
    fail "a missing setting exits non-zero"
elif grep -q BACKUP_S3_BUCKET "$tmp/out"; then
    pass "a missing setting exits non-zero and names it"
else
    fail "a missing setting names it"; cat "$tmp/out"
fi

for bad in 0 -1 abc; do
    if DATABASE_URL="$src_url" BACKUP_KEEP="$bad" "$backup" > "$tmp/out" 2>&1; then
        fail "BACKUP_KEEP=$bad is refused"
    else
        pass "BACKUP_KEEP=$bad is refused"
    fi
done

# The secret must never reach a command line, where ps on the host shows it.
# grep exits 1 for "no match" and 2 when a file is missing; only 1 passes.
grep -q -- '--user' "$here/db-backup-lib.sh" "$backup" "$restore" 2> /dev/null
if [ $? -ne 1 ]; then
    fail "credentials go to curl through a config file, not --user"
else
    pass "credentials go to curl through a config file, not --user"
fi

echo ""
if [ "$failures" -eq 0 ]; then
    echo "db-backup: all tests passed"
    exit 0
fi
echo "db-backup: $failures test(s) failed"
exit 1
