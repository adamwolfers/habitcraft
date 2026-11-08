#!/usr/bin/env bash
# Wait for every GitHub Actions run of one commit, then report each (habitcraft-fl1b):
#
#   scripts/ci-wait.sh [<rev>]     # default HEAD
#
# Prints one "<run id> <workflow>: <conclusion>" line per run and exits 0 only
# if every run succeeded, so its output is what a bd close reason cites.
# Run it in the background from an agent: it blocks until CI is done.
#
# Why this exists: `gh run list --commit <sha>` matches only a full 40-char SHA.
# A short one returns an empty list with exit 0, so a hand-rolled wait loop
# spins forever on runs that already passed. That was hit four times
# (habitcraft-308j twice, habitcraft-bz4g, habitcraft-m5ez) with the bd memory
# warning against it loaded. This script resolves the full SHA itself and
# matches .headSha in jq, as scripts/drain/land.sh does; the PreToolUse guard
# scripts/guard-gh-short-sha.sh blocks the short-SHA form outright.
#
# It reads conclusions with `gh run view --json`, never `gh run watch
# --exit-status`, which reported failure on a dropped connection for a run that
# had succeeded (bd memory close-beads-last-ci-green).
#
# Tunables (environment): CI_WAIT_POLL seconds between polls (30),
# CI_WAIT_APPEAR_TRIES polls for a run to appear before giving up (20),
# CI_WAIT_TIMEOUT seconds for the runs to finish (5400), CI_WAIT_GH_TRIES gh
# failures in a row tolerated (5).
set -u

POLL=${CI_WAIT_POLL:-30}
APPEAR_TRIES=${CI_WAIT_APPEAR_TRIES:-20}
TIMEOUT=${CI_WAIT_TIMEOUT:-5400}
GH_TRIES=${CI_WAIT_GH_TRIES:-5}

die() { echo "ci-wait: $*" >&2; exit 2; }

rev=${1:-HEAD}
sha=$(git rev-parse --verify -q "$rev^{commit}") || die "'$rev' is not a commit"

# "<id>\t<status>\t<conclusion>\t<workflow>" per run of this commit.
runs() {
    gh run list --limit 50 --json databaseId,headSha,status,conclusion,workflowName \
        -q ".[] | select(.headSha == \"$sha\")
              | [(.databaseId|tostring), .status, .conclusion, .workflowName] | @tsv"
}

tries=0 errors=0 started=$SECONDS list=""
while :; do
    if list=$(runs 2>/dev/null); then
        errors=0
        if [ -z "$list" ]; then
            tries=$((tries + 1))
            [ "$tries" -lt "$APPEAR_TRIES" ] ||
                die "no run for $sha after $tries polls -- if every file it touches is" \
                    "paths-ignored (e.g. only *.md), CI never starts"
        elif ! printf '%s\n' "$list" | awk -F'\t' '$2 != "completed" { found = 1 } END { exit !found }'; then
            break
        fi
    else
        errors=$((errors + 1))
        [ "$errors" -lt "$GH_TRIES" ] || die "gh failed $errors times in a row"
    fi
    [ $((SECONDS - started)) -lt "$TIMEOUT" ] ||
        die "runs for $sha still not complete after ${TIMEOUT}s"
    sleep "$POLL"
done

failed=0
while IFS=$'\t' read -r id _ conclusion workflow; do
    # Re-read each conclusion from the run itself, not the list's summary.
    c=$(gh run view "$id" --json conclusion -q .conclusion 2>/dev/null) || c=$conclusion
    echo "$id $workflow: $c"
    case "$c" in success | skipped | neutral) ;; *) failed=1 ;; esac
done <<EOF
$list
EOF

echo "commit $sha: $([ "$failed" = 0 ] && echo green || echo NOT green)"
exit "$failed"
