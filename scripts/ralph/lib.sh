# shellcheck shell=bash
# Shared helpers for scripts/ralph/. Source it; do not run it.

# Pids of running ralph.sh loops, one per line; exits 1 when there are none.
#
# Matches only a bash process whose script IS ralph.sh. A bare
# `pgrep -f scripts/ralph/ralph.sh` also matched the tmux server, whose
# command line held the session's send-keys text, so status.sh reported a
# loop that was not running and land.sh refused to land (habitcraft-3oxu).
ralph_pids() {
    pgrep -f '^([^ ]*/)?bash ([^ ]*/)?scripts/ralph/ralph\.sh( |$)'
}
