#!/bin/bash
# Back up the database to S3-compatible object storage (habitcraft-vxln.9.3).
#
#   scripts/db-backup.sh
#
# pg_dumps DATABASE_URL in custom format, checks the dump reads back, uploads
# it as <prefix>habitcraft-<UTC timestamp>.dump, then deletes all but the newest
# BACKUP_KEEP (default 14) dumps. Pruning runs only after a successful upload,
# so a failed run never leaves fewer backups than before. Any failure exits
# non-zero, which is what cron's mail and the log watch for.
#
# Settings are listed in scripts/db-backup-lib.sh. The restore side is
# scripts/db-restore.sh; the schedule and the drill are in docs/DEPLOYMENT.md.
# Tests: scripts/db-backup.test.sh.
set -euo pipefail

SCRIPT_NAME=db-backup
# shellcheck source=db-backup-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/db-backup-lib.sh"

load_settings
KEEP="${BACKUP_KEEP:-14}"
# Over a page of keys could not be listed for pruning (see list_dumps).
[[ "$KEEP" =~ ^[1-9][0-9]{0,2}$ ]] || die "BACKUP_KEEP must be a whole number from 1 to 999, not '$KEEP'"

name="habitcraft-$(date -u +%Y%m%dT%H%M%SZ).dump"
dump="$WORK/$name"

echo "$SCRIPT_NAME: dumping the database"
"${PG_DUMP_CMD[@]}" --format=custom --dbname="$DATABASE_URL" > "$dump" \
    || die "pg_dump failed; nothing uploaded"
# A truncated or empty file is not a backup. Reading its table of contents back
# catches both before it can displace a good dump.
"${PG_RESTORE_CMD[@]}" --list < "$dump" > /dev/null \
    || die "the dump does not read back; nothing uploaded"

echo "$SCRIPT_NAME: uploading $name ($(wc -c < "$dump" | tr -d ' ') bytes) to s3://$BACKUP_S3_BUCKET/$S3_PREFIX"
s3 --upload-file "$dump" --output /dev/null "$S3_BASE/$S3_PREFIX$name" \
    || die "upload failed; nothing pruned"

dumps=$(list_dumps)
count=$(grep -c . <<< "$dumps" || true)
if [ "$count" -gt "$KEEP" ]; then
    head -n "$((count - KEEP))" <<< "$dumps" | while IFS= read -r old; do
        echo "$SCRIPT_NAME: pruning $old"
        s3 --request DELETE --output /dev/null "$S3_BASE/$S3_PREFIX$old" \
            || die "could not delete $old"
    done
fi

echo "$SCRIPT_NAME: done; $(list_dumps | grep -c .) dump(s) kept"
