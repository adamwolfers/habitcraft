#!/usr/bin/env sh
# Push beads issue data to the Dolt remote, pulling first only when the push is
# rejected because the remote has moved on. Shared by both push paths:
#   .husky/pre-push        -- blocks the git push on a non-zero exit
#   scripts/beads-push.sh  -- the Claude Code SessionStart/SessionEnd hooks
#
# WHY THE RETRY (habitcraft-lw6u)
# Once a second working copy (the Ralph clone, another machine) has pushed, this
# copy's plain 'bd dolt push' is rejected non-fast-forward until it pulls. A
# pull costs ~5s, so it runs only after that rejection rather than before every
# push: when this copy is already current, the cost stays one push.
#
# A CONFLICTING PULL IS SAFE TO AUTOMATE. Verified against bd 1.2.2 with two
# copies sharing a file:// remote: when both copies changed the same issue, the
# pull fails with 'merge conflicts in issues require operator resolution; merge
# aborted and working set restored' -- local data is untouched. Note that any
# two edits to one issue conflict, even identical ones, because each also
# writes updated_at. Edits to different issues merge cleanly. So the only
# outcome of a conflict is this script failing with that message, which each
# caller surfaces its own way.
#
# Output goes to stdout/stderr unchanged; the exit status is the last bd call's
# (124 on a timeout).
set -u

timeout_secs=${BEADS_PUSH_TIMEOUT:-120}

# Stock macOS ships neither 'timeout' nor 'gtimeout' (Homebrew coreutils), in
# which case there is NO bound and a hung bd hangs its caller until Ctrl-C.
if command -v timeout >/dev/null 2>&1; then
  timeout_cmd=timeout
elif command -v gtimeout >/dev/null 2>&1; then
  timeout_cmd=gtimeout
else
  timeout_cmd=
fi

# bounded <bd args...>: run bd under the timeout when one is available.
bounded() {
  if [ -n "$timeout_cmd" ]; then
    "$timeout_cmd" "$timeout_secs" bd "$@"
  else
    bd "$@"
  fi
  rc=$?
  if [ "$rc" -eq 124 ] && [ -n "$timeout_cmd" ]; then
    echo >&2 "beads: 'bd $*' timed out after ${timeout_secs}s (override with BEADS_PUSH_TIMEOUT)."
  fi
  return "$rc"
}

out=$(mktemp) || exit 1
trap 'rm -f "$out"' EXIT

# The output is captured so the rejection can be recognised, then replayed.
rc=0
bounded dolt push >"$out" 2>&1 || rc=$?
cat "$out"
[ "$rc" -eq 0 ] && exit 0
grep -q 'non-fast-forward' "$out" || exit "$rc"

echo "beads: the Dolt remote has changes this copy lacks; pulling them, then pushing again."
rc=0
bounded dolt pull || rc=$?
if [ "$rc" -ne 0 ]; then
  echo >&2 "beads: 'bd dolt pull' FAILED (exit $rc). If it reports merge conflicts, the"
  echo >&2 "beads: same issue changed in two copies since they last synced. bd aborted"
  echo >&2 "beads: the merge and changed nothing here. To resolve it, see 'Resolving a"
  echo >&2 "beads: beads merge conflict' in scripts/ralph/README.md."
  exit "$rc"
fi

rc=0
bounded dolt push || rc=$?
exit "$rc"
