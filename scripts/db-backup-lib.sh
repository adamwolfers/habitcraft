# shellcheck shell=bash
# Shared by scripts/db-backup.sh and scripts/db-restore.sh (habitcraft-vxln.9.3):
# settings, and the few S3 requests they make. Sourced, never run.
#
# S3 is spoken with curl's built-in SigV4 signing (curl 7.75 or later), so the
# host needs no S3 client and no extra image: curl and docker are enough. Any
# S3-compatible provider works; requests use path-style URLs,
# <endpoint>/<bucket>/<key>.
#
# Settings (environment):
#   DATABASE_URL                 the database, as pg_dump/pg_restore see it
#   BACKUP_S3_ENDPOINT           e.g. https://s3.eu-central-003.backblazeb2.com
#   BACKUP_S3_BUCKET             the bucket, which must already exist
#   BACKUP_S3_ACCESS_KEY_ID
#   BACKUP_S3_SECRET_ACCESS_KEY
#   BACKUP_S3_REGION             default us-east-1
#   BACKUP_S3_PREFIX             key prefix, default "habitcraft/"
#   PG_DUMP, PG_RESTORE          the commands to run, default pg_dump and
#                                pg_restore. Data goes through stdin/stdout, so
#                                a prefix such as "docker exec -i habitcraft-db
#                                pg_dump" works unchanged.

# A dump's name: habitcraft-<UTC timestamp>.dump. The fixed-width timestamp
# makes name order the same as time order, which is what pruning and "latest"
# rely on. Anything else under the prefix is not ours and is never touched.
DUMP_NAME_RE='^habitcraft-[0-9]{8}T[0-9]{6}Z\.dump$'

die() {
    echo "$SCRIPT_NAME: $*" >&2
    exit 1
}

# Fail, naming every missing setting at once rather than one per attempt.
require_settings() {
    local missing="" v
    for v in "$@"; do
        [ -n "${!v:-}" ] || missing="$missing $v"
    done
    [ -z "$missing" ] || die "not set:$missing"
}

load_settings() {
    require_settings DATABASE_URL BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET \
        BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY
    S3_REGION="${BACKUP_S3_REGION:-us-east-1}"
    S3_PREFIX="${BACKUP_S3_PREFIX-habitcraft/}"
    S3_BASE="${BACKUP_S3_ENDPOINT%/}/$BACKUP_S3_BUCKET"
    # Keys are put into URLs unencoded, so allow only characters that need none.
    [[ "$S3_PREFIX" =~ ^[A-Za-z0-9._/-]*$ ]] \
        || die "BACKUP_S3_PREFIX may hold only letters, digits and . _ / -"
    [[ "$BACKUP_S3_BUCKET" =~ ^[a-z0-9.-]+$ ]] \
        || die "BACKUP_S3_BUCKET is not a valid bucket name"

    # shellcheck disable=SC2034 # used by the scripts that source this
    read -ra PG_DUMP_CMD <<< "${PG_DUMP:-pg_dump}"
    # shellcheck disable=SC2034
    read -ra PG_RESTORE_CMD <<< "${PG_RESTORE:-pg_restore}"

    WORK=$(mktemp -d) || die "cannot create a temporary directory"
    trap 'rm -rf "$WORK"' EXIT

    # The credentials reach curl through a config file only it can read. On the
    # command line, any user on the host could read the secret with ps.
    (
        umask 077
        printf 'user = "%s:%s"\n' "$BACKUP_S3_ACCESS_KEY_ID" "$BACKUP_S3_SECRET_ACCESS_KEY" \
            > "$WORK/curl.conf"
    )
}

# s3 <curl args...>: one signed request. --fail turns any HTTP error into a
# non-zero exit; --retry covers transient 5xx and timeouts, not a refusal.
s3() {
    curl --silent --show-error --fail --retry 3 --retry-delay 2 \
        --aws-sigv4 "aws:amz:$S3_REGION:s3" --config "$WORK/curl.conf" "$@"
}

# The names of our dumps under the prefix, oldest first.
list_dumps() {
    local listing
    listing=$(s3 "$S3_BASE?list-type=2&prefix=$S3_PREFIX") \
        || die "could not list s3://$BACKUP_S3_BUCKET/$S3_PREFIX"
    # One page holds 1000 keys. Retention keeps far fewer, so a longer listing
    # means something else is filling the prefix: stop rather than prune, or
    # call "latest", from a partial view.
    if grep -q '<IsTruncated>true</IsTruncated>' <<< "$listing"; then
        die "more than one page of objects under s3://$BACKUP_S3_BUCKET/$S3_PREFIX; refusing to act on a partial listing"
    fi
    grep -o '<Key>[^<]*</Key>' <<< "$listing" \
        | sed -e 's|^<Key>||' -e 's|</Key>$||' \
        | while IFS= read -r key; do
            name="${key#"$S3_PREFIX"}"
            [[ "$key" == "$S3_PREFIX$name" && "$name" =~ $DUMP_NAME_RE ]] && echo "$name"
        done \
        | LC_ALL=C sort
    return 0
}
