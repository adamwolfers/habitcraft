#!/bin/bash

# Ralph loop: run fresh `claude -p` sessions, one agent-ok bead per pass.
# Usage: scripts/ralph/ralph.sh [options]
#
# Options:
#   -n, --max-passes N    Stop after N passes (default 10)
#   -t, --pass-timeout S  Kill a pass after S seconds (default 3600)
#   -h, --help            Show this help message
#
# Each pass is a new process with an empty context window; state carries
# between passes only through git commits and beads. Run it in a SEPARATE
# clone on a branch, never in the main working copy -- see
# scripts/ralph/README.md (habitcraft-w1hv).
#
# The loop stops when no agent-ok bead is ready, after --max-passes, or as soon
# as a pass makes no progress: no bead lost its agent-ok label, the tree was
# left dirty, or the branch changed. A loop that keeps retrying a bead it cannot
# finish only burns usage.
#
# Progress is counted over every agent-ok bead, not just ready ones. A pass that
# claims a bead and is then killed (timeout, crash, usage limit) takes it out of
# `bd ready` while it is still labelled agent-ok; counting ready beads would
# score that as progress and carry on past a stranded claim.

set -euo pipefail

MAX_PASSES=10
PASS_TIMEOUT=3600
LABEL="agent-ok"
PERMISSION_MODE="${RALPH_PERMISSION_MODE:-auto}"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -n|--max-passes) MAX_PASSES="$2"; shift ;;
        -t|--pass-timeout) PASS_TIMEOUT="$2"; shift ;;
        -h|--help) sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROMPT_FILE="$PROJECT_ROOT/scripts/ralph/PROMPT.md"
LOG_DIR="$PROJECT_ROOT/.ralph"
cd "$PROJECT_ROOT"

die() { echo "ralph: $*" >&2; exit 1; }

for cmd in claude bd jq git perl; do
    command -v "$cmd" >/dev/null || die "$cmd is not on PATH"
done

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" != "master" && "$BRANCH" != "HEAD" ]] \
    || die "on '$BRANCH'. Run the loop on a review branch: git switch -c ralph/$(date +%F)"
[[ -z "$(git status --porcelain)" ]] || die "working tree is dirty; commit or stash first"

mkdir -p "$LOG_DIR"
SUMMARY="$LOG_DIR/summary.log"

ready_count() {
    bd ready --label "$LABEL" --json -n 0 2>/dev/null | jq 'length'
}

# Every not-yet-handed-off bead. A finished or stuck pass removes the label.
labelled_count() {
    bd list --label "$LABEL" --status open,in_progress,blocked --json -n 0 2>/dev/null | jq 'length'
}

log() {
    echo "$(date '+%Y-%m-%dT%H:%M:%S%z') $*" | tee -a "$SUMMARY"
}

# Two working copies push to one Dolt remote, and neither the pre-push hook
# nor beads-push.sh pulls first, so whichever copy pushed last makes the other's
# next push fail non-fast-forward. Pull before each pass (so it sees label
# changes made in the main checkout) and pull-then-push after it.
sync_beads() {
    bd dolt pull >/dev/null 2>&1 || { log "WARN: bd dolt pull failed"; return 0; }
    [[ "${1:-}" == "push" ]] || return 0
    bd dolt push >/dev/null 2>&1 || log "WARN: bd dolt push failed; beads changes are only in this clone"
}

log "start branch=$BRANCH max_passes=$MAX_PASSES pass_timeout=${PASS_TIMEOUT}s mode=$PERMISSION_MODE"

for ((pass = 1; pass <= MAX_PASSES; pass++)); do
    sync_beads
    if [[ "$(ready_count)" -eq 0 ]]; then
        log "no $LABEL bead ready after $((pass - 1)) passes ($(labelled_count) still labelled)"
        exit 0
    fi
    before="$(labelled_count)"

    head_before="$(git rev-parse --short HEAD)"
    pass_log="$LOG_DIR/pass-$(date +%Y%m%d-%H%M%S)-$pass.jsonl"
    log "pass $pass: labelled=$before head=$head_before log=$(basename "$pass_log")"

    # macOS ships no `timeout`; perl's alarm survives exec and kills the pass.
    status=0
    perl -e 'alarm shift; exec @ARGV' "$PASS_TIMEOUT" \
        claude -p "$(cat "$PROMPT_FILE")" \
            --permission-mode "$PERMISSION_MODE" \
            --disallowedTools ScheduleWakeup Monitor CronCreate \
            --output-format stream-json --verbose \
        > "$pass_log" 2>&1 || status=$?

    sync_beads push
    after="$(labelled_count)"
    head_after="$(git rev-parse --short HEAD)"
    log "pass $pass: exit=$status labelled=$before->$after head=$head_before->$head_after"

    [[ "$(git rev-parse --abbrev-ref HEAD)" == "$BRANCH" ]] \
        || { log "STOP: pass changed the branch"; exit 1; }
    [[ -z "$(git status --porcelain)" ]] \
        || { log "STOP: pass left the working tree dirty"; exit 1; }
    [[ "$after" -lt "$before" ]] \
        || { log "STOP: pass handed off no bead (check for a stranded in_progress claim)"; exit 1; }
done

log "stopped at --max-passes $MAX_PASSES"
