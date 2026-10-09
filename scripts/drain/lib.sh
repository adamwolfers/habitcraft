# shellcheck shell=bash
# Shared helpers for scripts/drain/. Source it; do not run it.

# Pids of running drain.sh loops, one per line; exits 1 when there are none.
#
# Matches only a bash process whose script IS drain.sh. A bare
# `pgrep -f scripts/drain/drain.sh` also matched the tmux server, whose
# command line held the session's send-keys text, so status.sh reported a
# loop that was not running and land.sh refused to land (habitcraft-3oxu).
drain_pids() {
    pgrep -f '^([^ ]*/)?bash ([^ ]*/)?scripts/drain/drain\.sh( |$)'
}
