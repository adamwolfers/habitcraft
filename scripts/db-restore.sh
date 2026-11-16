#!/bin/bash
# Restore a backup made by scripts/db-backup.sh (habitcraft-vxln.9.3).
#
#   scripts/db-restore.sh --list      list the dumps, oldest first
#   scripts/db-restore.sh latest      restore the newest dump
#   scripts/db-restore.sh <name>      restore habitcraft-<timestamp>.dump
#
# Restores into DATABASE_URL, which must be an EMPTY database: the restore runs
# as one transaction that stops at the first error, so restoring over existing
# tables fails as a whole and changes nothing, rather than merging half a dump
# into live data. Ownership and grants are not restored (--no-owner --no-acl),
# so the objects belong to whichever role DATABASE_URL connects as.
#
# Settings are listed in scripts/db-backup-lib.sh; the procedure is in
# docs/DEPLOYMENT.md. Tests: scripts/db-backup.test.sh.
set -euo pipefail

SCRIPT_NAME=db-restore
# shellcheck source=db-backup-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/db-backup-lib.sh"

[ "$#" -eq 1 ] || die "usage: db-restore.sh --list | latest | habitcraft-<timestamp>.dump"
load_settings

if [ "$1" = --list ]; then
    list_dumps
    exit 0
fi

name=$1
if [ "$name" = latest ]; then
    name=$(list_dumps | tail -n 1)
    [ -n "$name" ] || die "no dumps under s3://$BACKUP_S3_BUCKET/$S3_PREFIX"
fi
[[ "$name" =~ $DUMP_NAME_RE ]] || die "'$name' is not a dump name (see --list)"

dump="$WORK/$name"
echo "$SCRIPT_NAME: fetching $name"
s3 --output "$dump" "$S3_BASE/$S3_PREFIX$name" \
    || die "could not fetch s3://$BACKUP_S3_BUCKET/$S3_PREFIX$name"

echo "$SCRIPT_NAME: restoring $name"
"${PG_RESTORE_CMD[@]}" --no-owner --no-acl --single-transaction --exit-on-error \
    --dbname="$DATABASE_URL" < "$dump" \
    || die "pg_restore failed; the transaction rolled back. Is the target database empty?"

echo "$SCRIPT_NAME: restored $name"
