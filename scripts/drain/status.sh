#!/bin/bash

# Show the drain loop at a glance: queue, review, stuck, and recent passes.
# Usage: scripts/drain/status.sh [--watch [seconds]]
#
#   --watch [seconds]  Redraw every N seconds (default 15) until Ctrl-C.
#
# Reads the drain clone (~/github/habitcraft-drain, or DRAIN_CLONE), whose
# beads database is the one the loop writes, so it is live. mg cannot show
# labels, which is the whole queue (habitcraft-3oxu). Each refresh makes one
# bd call, to keep contention with a running pass low (habitcraft-82by).

set -uo pipefail

# shellcheck source=scripts/drain/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

CLONE="${DRAIN_CLONE:-$HOME/github/habitcraft-drain}"
WATCH=""

usage() { sed -n '3,6p' "$0" | sed 's/^# \{0,1\}//'; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -w|--watch)
            WATCH=15
            if [[ "${2:-}" =~ ^[0-9]+$ ]]; then
                WATCH="$2"; shift
            elif [[ -n "${2:-}" && "${2:-}" != -* ]]; then
                echo "status: --watch takes a whole number of seconds, not '$2'" >&2; exit 1
            fi
            ;;
        -h|--help) usage; exit 0 ;;
        *) echo "status: unknown option '$1'" >&2; usage >&2; exit 1 ;;
    esac
    shift
done

[[ -d "$CLONE/.git" ]] || { echo "status: no drain clone at $CLONE (set DRAIN_CLONE)" >&2; exit 1; }
cd "$CLONE" || exit 1

# section <heading> <jq selector over the loop's beads>
section() {
    local rows
    rows="$(jq -r "[.[] | select($2)] | sort_by(.priority, .id) | .[]
        | \"  \((.id + (\" \" * 20))[0:20])P\(.priority)  \(.title | if length > 64 then .[0:61] + \"...\" else . end)\"" <<<"$BEADS")"
    echo "$1 ($(grep -c . <<<"$rows"))"
    if [[ -n "$rows" ]]; then echo "$rows"; else echo "  none"; fi
    echo
}

render() {
    local pid branch ahead summary warns
    echo "Drain loop  $CLONE  $(date '+%H:%M:%S')"

    pid="$(drain_pids | head -1)"
    if [[ -n "$pid" ]]; then echo "Loop:    running (pid $pid)"; else echo "Loop:    not running"; fi

    branch="$(git branch --show-current)"
    if [[ "$branch" == "master" ]]; then
        echo "Branch:  master (no review branch)"
    else
        ahead="$(git rev-list --count master..HEAD 2>/dev/null || echo "?")"
        echo "Branch:  $branch, $ahead commits ahead of master"
    fi
    echo

    # stderr apart from stdout: bd prints notices there that are not JSON.
    local err
    err="$(mktemp)"
    if ! BEADS="$(bd list --status open,in_progress,blocked --json -n 0 2>"$err")" \
        || ! jq -e 'type == "array"' <<<"$BEADS" >/dev/null 2>&1; then
        echo "bd list failed: $(head -3 "$err")"
        rm -f "$err"
        return 1
    fi
    rm -f "$err"
    BEADS="$(jq '[.[] | select((.labels // []) | any(. == "agent-ok" or . == "agent-review" or . == "agent-stuck"))]' <<<"$BEADS")"

    section "Working" '.status == "in_progress" and (.labels | index("agent-ok"))'
    section "Queued" '.status != "in_progress" and (.labels | index("agent-ok"))'
    section "Review" '.labels | index("agent-review")'
    section "Stuck" '.labels | index("agent-stuck")'

    summary="$CLONE/.drain/summary.log"
    if [[ -f "$summary" ]]; then
        echo "Last passes (.drain/summary.log):"
        tail -4 "$summary" | cut -c1-19,25- | sed 's/^/  /'
        warns="$(grep -c 'WARN:' "$summary")"
        [[ "$warns" -gt 0 ]] && echo "  -- $warns WARN line(s) in summary.log; grep WARN to read them"
    fi
    return 0
}

if [[ -z "$WATCH" ]]; then
    render
    exit
fi

trap 'echo; exit 0' INT TERM
while :; do
    frame="$(render 2>&1)"
    # Draw the whole frame at once, so a slow bd call never shows a blank screen.
    [[ -t 1 ]] && printf '\033[H\033[2J'
    printf '%s\n\n(refreshing every %ss, Ctrl-C to stop)\n' "$frame" "$WATCH"
    sleep "$WATCH"
done
