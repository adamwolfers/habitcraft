#!/usr/bin/env bash
# Tests for scripts/ralph/lib.sh, against REAL processes and the real pgrep:
#
#   scripts/ralph/lib.test.sh
#
# Not run in CI: scripts/ralph/ is paths-ignored there.
set -u

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=scripts/ralph/lib.sh
. "$here/lib.sh"

tmp=$(mktemp -d) || exit 2
pids=()
trap 'kill "${pids[@]}" 2>/dev/null; wait 2>/dev/null; rm -rf "$tmp"' EXIT

passed=0
failed=0
check() { # check <description> <command...>
  if "${@:2}"; then passed=$((passed + 1)); else failed=$((failed + 1)); echo "FAIL: $1"; fi
}
found() { ralph_pids | grep -qx "$1"; }
not_found() { ! ralph_pids | grep -qx "$1"; }

# A stand-in ralph.sh: a script at the real relative path that just sleeps.
mkdir -p "$tmp/clone/scripts/ralph"
printf '#!/bin/bash\nsleep 30\n' >"$tmp/clone/scripts/ralph/ralph.sh"
chmod +x "$tmp/clone/scripts/ralph/ralph.sh"

# Decoys whose command lines contain the text but are not the loop.
sh -c 'sleep 30; : scripts/ralph/ralph.sh -n 6' &
pids+=($!)
decoy_text=$!
bash -c 'sleep 30' scripts/ralph/ralph.sh.bak &
pids+=($!)
decoy_bak=$!

(cd "$tmp/clone" && exec bash scripts/ralph/ralph.sh -n 6) &
pids+=($!)
relative=$!
/bin/bash "$tmp/clone/scripts/ralph/ralph.sh" &
pids+=($!)
absolute=$!
(cd "$tmp/clone" && exec scripts/ralph/ralph.sh) &
pids+=($!)
shebang=$!
sleep 0.5

check "finds 'bash scripts/ralph/ralph.sh -n 6'" found "$relative"
check "finds '/bin/bash /abs/path/scripts/ralph/ralph.sh'" found "$absolute"
check "finds a run via the shebang" found "$shebang"
check "ignores a process that only mentions the path (the tmux case)" not_found "$decoy_text"
check "ignores a different file that starts with the name" not_found "$decoy_bak"

kill "$relative" "$absolute" "$shebang" 2>/dev/null
wait "$relative" "$absolute" "$shebang" 2>/dev/null
check "reports nothing once the loops exit" not_found "$relative"

kill "${pids[@]}" 2>/dev/null
wait 2>/dev/null
echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
