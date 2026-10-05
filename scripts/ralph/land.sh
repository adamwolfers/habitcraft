#!/bin/bash

# Land a Ralph run: merge its review branch, wait for CI, close its beads.
# Usage: scripts/ralph/land.sh <branch>
#
# Run from the main checkout, on a clean master, after reviewing the branch.
# It refuses while ralph.sh is running. The Ralph clone is ~/github/habitcraft-ralph
# unless RALPH_CLONE says otherwise.
#
#   1. Fetch <branch> from the clone, rebase it onto master, fast-forward, push.
#   2. Wait for the CI run on the pushed commit.
#   3. Green: close each agent-review bead a merged commit names, with the
#      commit and run id, and drop its label. Anything else: close nothing.
#   4. Either way, sync the clone -- beads pulled, git back on master, branch
#      deleted -- so mg in the clone and the next run start current.
#
# Beads close only after CI is green on master (close-beads-last-ci-green),
# which is why this waits rather than closing at merge (habitcraft-tjwp).

set -euo pipefail

CLONE="${RALPH_CLONE:-$HOME/github/habitcraft-ralph}"
POLL_SECONDS="${LAND_POLL_SECONDS:-15}"
RUN_LIST_TRIES=24     # how long a CI run may take to appear, in polls
GH_ERROR_TRIES=10     # consecutive gh failures tolerated while waiting
CI_TIMEOUT=5400       # seconds before giving up on a run that never completes

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

die() { echo "land: $*" >&2; exit 1; }
say() { echo "land: $*"; }

[[ $# -eq 1 && "$1" != -* ]] || { sed -n '3,4p' "$0" | sed 's/^# //'; exit 1; }
BRANCH="$1"

# --- preflight: refuse before anything is pushed ----------------------------------
for cmd in git gh bd jq pgrep; do
    command -v "$cmd" >/dev/null || die "$cmd is not on PATH"
done
[[ -d "$CLONE/.git" ]] || die "no Ralph clone at $CLONE (set RALPH_CLONE)"
[[ "$(cd "$CLONE" && pwd -P)" != "$(pwd -P)" ]] || die "run this from the main checkout, not the clone"
[[ "$(git branch --show-current)" == "master" ]] || die "the main checkout is not on master"
[[ -z "$(git status --porcelain)" ]] || die "the main checkout has uncommitted changes"
[[ -z "$(git -C "$CLONE" status --porcelain)" ]] || die "the clone has uncommitted changes"
! pgrep -f 'scripts/ralph/ralph\.sh' >/dev/null || die "ralph.sh is running; land after it stops"
git -C "$CLONE" rev-parse --verify -q "refs/heads/$BRANCH" >/dev/null \
    || die "the clone has no branch '$BRANCH'"

# --- 1. merge and push ------------------------------------------------------------
bd dolt pull >/dev/null
git pull --rebase -q
git fetch -q "$CLONE" "+refs/heads/$BRANCH:refs/heads/$BRANCH"
base="$(git rev-parse HEAD)"
[[ -n "$(git log --oneline "master..$BRANCH")" ]] || die "'$BRANCH' has nothing that is not already on master"

if ! git rebase -q master "$BRANCH"; then
    git rebase --abort
    git switch -q master
    die "'$BRANCH' does not rebase cleanly onto master; resolve it by hand"
fi
git switch -q master
git merge --ff-only -q "$BRANCH"
git push -q
git branch -q -D "$BRANCH"
sha="$(git rev-parse HEAD)"
say "pushed $(git rev-parse --short "$base")..$(git rev-parse --short "$sha")"

# --- 2. wait for CI ---------------------------------------------------------------
# Reads the conclusion with `gh run view --json`. `gh run watch --exit-status`
# reported failure on a dropped connection for a run that had succeeded.
wait_for_ci() {
    local tries=0 errors=0 run="" state="" started
    while [[ -z "$run" ]]; do
        run="$(gh run list --workflow ci.yml --limit 20 --json databaseId,headSha \
            -q ".[] | select(.headSha == \"$sha\") | .databaseId" 2>/dev/null | head -1)" || run=""
        [[ -n "$run" ]] && break
        tries=$((tries + 1))
        if [[ "$tries" -ge "$RUN_LIST_TRIES" ]]; then
            echo "land: no CI run for $sha -- if every file it touches is paths-ignored," \
                "CI never starts; close its beads by hand" >&2
            return 1
        fi
        sleep "$POLL_SECONDS"
    done
    RUN_ID="$run"
    say "waiting for CI run $RUN_ID"
    started=$SECONDS
    while :; do
        if state="$(gh run view "$RUN_ID" --json status,conclusion \
            -q '.status + " " + .conclusion' 2>/dev/null)"; then
            errors=0
            [[ "$state" == completed* ]] && break
        else
            errors=$((errors + 1))
            [[ "$errors" -lt "$GH_ERROR_TRIES" ]] \
                || { echo "land: gh failed $errors times in a row; check run $RUN_ID by hand" >&2; return 1; }
        fi
        [[ $((SECONDS - started)) -lt "$CI_TIMEOUT" ]] \
            || { echo "land: CI run $RUN_ID still not complete after ${CI_TIMEOUT}s" >&2; return 1; }
        sleep "$POLL_SECONDS"
    done
    CONCLUSION="${state#completed }"
    [[ "$CONCLUSION" == "success" ]] \
        || { echo "land: CI run $RUN_ID concluded '$CONCLUSION'; no beads closed" >&2; return 1; }
}

# --- 3. close the beads the branch finished ---------------------------------------
close_beads() {
    local review named id shas
    review="$(bd list --label agent-review --json -n 0 2>/dev/null | jq -r '.[].id')"
    # "<bead-id> <short-sha>" per commit whose subject ends in "(<bead-id>)".
    # A bead may span several commits. (No associative arrays: macOS ships
    # bash 3.2 as /bin/bash.)
    named="$(git log --reverse --format='%h %s' "$base..$sha" |
        sed -nE 's/^([0-9a-f]+) .*\(([a-z][a-z0-9]*-[a-z0-9]+(\.[0-9]+)*)\)$/\2 \1/p')"

    while read -r id; do
        shas="$(awk -v id="$id" '$1 == id { printf "%s%s", sep, $2; sep = ", " }' <<<"$named")"
        if grep -qxF "$id" <<<"$review"; then
            bd close "$id" --reason "Done by the Ralph loop in $shas, merged to master. CI run $RUN_ID green." </dev/null >/dev/null
            bd label remove "$id" agent-review </dev/null >/dev/null
            say "closed $id ($shas)"
        else
            say "not closing $id: a commit names it, but it is not labelled agent-review"
        fi
    done < <(cut -d' ' -f1 <<<"$named" | awk 'NF && !seen[$0]++')
    while read -r id; do
        [[ -n "$id" ]] && ! grep -q "^$id " <<<"$named" \
            && say "left $id open: labelled agent-review, but no merged commit names it"
    done <<<"$review"
    bd dolt push >/dev/null
}

# --- 4. sync the clone ------------------------------------------------------------
sync_clone() {
    (
        cd "$CLONE"
        bd dolt pull >/dev/null
        git switch -q master
        git pull -q --ff-only
        git branch -q -D "$BRANCH"
    ) || { echo "land: could not sync the clone at $CLONE; do it by hand" >&2; return 1; }
    say "clone synced to $(git -C "$CLONE" rev-parse --short HEAD)"
}

RUN_ID=""
CONCLUSION=""
status=0
if wait_for_ci; then
    close_beads
else
    status=1
fi
sync_clone || status=1
exit "$status"
