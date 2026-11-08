#!/usr/bin/env bash
# Claude Code PreToolUse guard for Bash (habitcraft-fl1b): refuses a command that
# passes `gh run list` a literal commit hash shorter than 40 characters.
#
# gh matches --commit against the full SHA only. A short one returns an empty
# list with exit 0, so a wait loop built on it spins forever on runs that
# already passed. A bd memory warned against it and was ignored four times, so
# this makes the mistake fail at the call instead. Use scripts/ci-wait.sh.
#
# Wired in .claude/settings.json. Reads the hook's JSON on stdin; exit 2 blocks
# the call and shows stderr to the agent. A hash in a variable or $(...) is not
# checked -- only a literal can be judged here. Anything it cannot parse is
# allowed: a guard that fails closed would block every Bash call.
#
#   scripts/guard-gh-short-sha.test.sh   # its tests
set -u

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0

# Only the flag's own argument counts: `gh run list` ... `-c`/`--commit`, then
# a bare or quoted hex word of 4 to 39 characters that ends there.
if printf '%s\n' "$cmd" | grep -Eq \
    "gh[[:space:]]+run[[:space:]]+list([^;&|]*[[:space:]])?(-c|--commit)(=|[[:space:]]+)[\"']?[0-9a-fA-F]{4,39}([\"'[:space:];&|)]|$)"; then
    cat >&2 <<'EOF'
Blocked: `gh run list --commit` matches only a full 40-character SHA. A short
one returns an empty list with exit 0, so a wait loop never finds the run.
Use `scripts/ci-wait.sh <rev>` (run it in the background), or pass
"$(git rev-parse <rev>)".
EOF
    exit 2
fi
exit 0
