#!/usr/bin/env sh
# Push beads issue data to the Dolt remote, and leave a readable trace.
#
# WHY THIS EXISTS (habitcraft-clj)
# .husky/pre-push already pushes beads data, but it only fires when there is a
# git push. A session that only touches issues -- closing beads, commenting,
# triage -- produces no commits, so nothing triggers it and the issue data
# stays on this machine. Issue data lives in the gitignored
# .beads/embeddeddolt/, so until it reaches the Dolt remote it exists in
# exactly one place.
#
# This script is wired to two Claude Code hooks in .claude/settings.json:
#   SessionEnd   -- catches the clean exits ('exit', Ctrl-D, /clear)
#   SessionStart -- catches whatever an UNCLEAN exit (crash, closed window,
#                   kill -9) stranded last time, and reports a prior failure
#
# NEVER BLOCKS. SessionEnd discards its hook's output and exit code entirely,
# so this cannot report failure the way pre-push does (which fails the git push
# outright). That is precisely why it writes a log: a failed push here is
# otherwise completely silent. The SessionStart run reads that log back and
# prints it, so the failure surfaces at the top of the next session -- the same
# run that then retries the push.
#
# The log holds ONLY the last outcome: a single 'ok' line when healthy,
# appended FAILED blocks otherwise, truncated again on the next success. So a
# non-trivial .beads/push.log is itself the signal that something needs looking
# at. It is gitignored via the root .gitignore '*.log' rule.
set -u

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd) || exit 0
log="$repo_root/.beads/push.log"

command -v bd >/dev/null 2>&1 || exit 0
cd "$repo_root" || exit 0

# Report a prior failure BEFORE retrying, so the news is visible even if the
# retry below succeeds and truncates the evidence.
if [ -f "$log" ] && grep -q 'FAILED' "$log" 2>/dev/null; then
  echo "beads: the previous 'bd dolt push' FAILED. Issue data may exist only on"
  echo "beads: this machine. Recorded in .beads/push.log:"
  sed 's/^/  /' "$log"
  echo "beads: retrying now..."
fi

# Same timeout handling as .husky/pre-push: stock macOS ships neither 'timeout'
# nor 'gtimeout' (Homebrew coreutils), in which case there is no bound.
timeout_secs=${BEADS_PUSH_TIMEOUT:-120}
if command -v timeout >/dev/null 2>&1; then
  timeout_cmd=timeout
elif command -v gtimeout >/dev/null 2>&1; then
  timeout_cmd=gtimeout
else
  timeout_cmd=
fi

out=$(mktemp) || exit 0
if [ -n "$timeout_cmd" ]; then
  "$timeout_cmd" "$timeout_secs" bd dolt push >"$out" 2>&1
  rc=$?
else
  bd dolt push >"$out" 2>&1
  rc=$?
fi

stamp=$(date -Iseconds 2>/dev/null || date)
if [ "$rc" -eq 0 ]; then
  # Truncate: a healthy log is one line, so any bulk means a real problem.
  echo "$stamp ok" >"$log"
else
  # First failure after a success starts a fresh log, so the report shows the
  # current failure streak rather than a stale 'ok' line above it.
  grep -q 'FAILED' "$log" 2>/dev/null || : >"$log"
  {
    echo "$stamp FAILED rc=$rc"
    [ "$rc" -eq 124 ] && echo "  timed out after ${timeout_secs}s (override with BEADS_PUSH_TIMEOUT)"
    sed 's/^/  /' "$out"
  } >>"$log"
  # Visible when run from SessionStart; discarded when run from SessionEnd.
  echo "beads: 'bd dolt push' FAILED (exit $rc) -- see .beads/push.log"
fi

rm -f "$out"
exit 0
