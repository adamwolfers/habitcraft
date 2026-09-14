#!/usr/bin/env sh
# Health check for this repo's beads wiring (habitcraft-gl9).
#
# WHY THIS EXISTS
# 'bd doctor' does not run under the embedded Dolt backend this repo uses, and
# bd 1.3.0 keeps it gated there. The one status command that does run,
# 'bd hooks list', prints '✓ installed' without consulting core.hooksPath. The
# beads git hooks were dead from 2026-02-27 to 2026-07-30 (habitcraft-8t8), and
# nothing said so.
#
# WHAT IT CHECKS
#   1. bd is on PATH. Every .husky/ beads hook skips silently without it.
#   2. HUSKY=0 is not set. husky skips every hook when it is.
#   3. core.hooksPath resolves to .husky/_. Git honours exactly one hooks dir.
#   4. The .husky/_/ stubs exist. A fresh clone has none until npm install.
#   5. Each beads hook REACHES its bd call when git dispatches it. File presence
#      proves nothing -- that was the false green in habitcraft-8t8.
#   6. .beads/push.log records no failed push (see scripts/beads-push.sh).
#
# HOW CHECK 5 STAYS SIDE-EFFECT FREE
# 'git hook run' dispatches a hook exactly as a real commit or push would, so
# it follows core.hooksPath and the husky stub. A fake bd goes first on PATH.
# It records its arguments and exits 97. Every beads hook exits on that status
# before running anything after bd: pre-commit through 'sh -e', the others
# through their '_bd_exit' guards. Nothing is pushed, linted or synced.
#
# Not checked: unpushed local Dolt commits. bd has no local-vs-remote comparison
# in embedded mode, and a failed push already shows up in check 6.
#
# Usage:
#   scripts/beads-doctor.sh         print every check; exit 1 if any failed
#   scripts/beads-doctor.sh --hook  for the SessionStart hook: one line when
#                                   healthy, the full report otherwise; exit 0
set -u

mode=report
case "${1:-}" in
  '') ;;
  --hook) mode=hook ;;
  *)
    echo "usage: $0 [--hook]" >&2
    exit 2
    ;;
esac

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd) || exit 2
hooks_dir="$repo_root/.husky/_"
beads_hooks="pre-commit prepare-commit-msg post-checkout post-merge pre-push"

work=$(mktemp -d) || exit 2
trap 'rm -rf "$work"' EXIT
report="$work/report"
: >"$report"
failures=0
checks=0

ok() {
  checks=$((checks + 1))
  printf 'ok   %s\n' "$1" >>"$report"
}
fail() {
  checks=$((checks + 1))
  failures=$((failures + 1))
  printf 'FAIL %s\n' "$1" >>"$report"
}

# --- 1. bd on PATH -------------------------------------------------------------
if command -v bd >/dev/null 2>&1; then
  ok "bd is on PATH"
else
  fail "bd is not on PATH -- every .husky/ beads hook skips silently without it"
fi

# --- 2. HUSKY=0 ------------------------------------------------------------------
if [ "${HUSKY-}" = "0" ]; then
  fail "HUSKY=0 is set in this environment -- husky skips every git hook"
else
  ok "HUSKY is not 0"
fi

# --- 3. core.hooksPath -----------------------------------------------------------
hooks_path=$(git -C "$repo_root" config --get core.hooksPath)
case "$hooks_path" in
  '') resolved= ;;
  /*) resolved=$hooks_path ;;
  *) resolved="$repo_root/${hooks_path#./}" ;;
esac
resolved=${resolved%/}
if [ -z "$hooks_path" ]; then
  fail "core.hooksPath is unset -- git runs .git/hooks/, not .husky/ (run 'npm install')"
elif [ "$resolved" = "$hooks_dir" ] ||
  { [ -d "$resolved" ] && [ -d "$hooks_dir" ] &&
    [ "$(cd "$resolved" && pwd -P)" = "$(cd "$hooks_dir" && pwd -P)" ]; }; then
  ok "core.hooksPath is .husky/_"
else
  fail "core.hooksPath is '$hooks_path', expected .husky/_ -- the .husky/ hooks never run"
fi

# --- 4. husky stubs --------------------------------------------------------------
if [ ! -d "$hooks_dir" ]; then
  fail ".husky/_ is missing -- run 'npm install' at the repo root to create the husky stubs"
else
  if [ -f "$hooks_dir/h" ]; then
    ok "stub .husky/_/h exists"
  else
    fail "stub .husky/_/h is missing -- run 'npm install' at the repo root"
  fi
  for hook in $beads_hooks; do
    if [ -x "$hooks_dir/$hook" ]; then
      ok "stub .husky/_/$hook exists"
    else
      fail "stub .husky/_/$hook is missing or not executable -- run 'npm install' at the repo root"
    fi
  done
fi

# --- 5. each hook reaches bd -------------------------------------------------------
mkdir "$work/bin"
cat >"$work/bin/bd" <<EOF
#!/bin/sh
echo "\$*" >>"$work/bd-calls"
exit 97
EOF
chmod +x "$work/bin/bd"
: >"$work/COMMIT_EDITMSG"
zero=0000000000000000000000000000000000000000

for hook in $beads_hooks; do
  case $hook in
    pre-commit) set -- ;;
    prepare-commit-msg) set -- "$work/COMMIT_EDITMSG" ;;
    post-checkout) set -- "$zero" "$zero" 1 ;;
    post-merge) set -- 0 ;;
    pre-push) set -- origin "https://example.invalid/beads-doctor" ;;
  esac
  case $hook in
    pre-push) expected="dolt push" ;;
    *) expected="hooks run $hook" ;;
  esac

  rm -f "$work/bd-calls"
  PATH="$work/bin:$PATH" git -C "$repo_root" hook run "$hook" -- "$@" \
    </dev/null >"$work/hook-output" 2>&1
  hook_rc=$?
  call=$(head -n 1 "$work/bd-calls" 2>/dev/null)

  case "$call" in
    '')
      fail "$hook never reached bd (git hook run exited $hook_rc)"
      sed -n '1,5s/^/       | /p' "$work/hook-output" >>"$report"
      ;;
    "$expected" | "$expected "*)
      ok "$hook reaches 'bd $expected'"
      ;;
    *)
      fail "$hook calls 'bd $call', expected 'bd $expected'"
      ;;
  esac
done

# --- 6. .beads/push.log ------------------------------------------------------------
push_log="$repo_root/.beads/push.log"
if [ ! -f "$push_log" ]; then
  ok ".beads/push.log is absent -- no beads push recorded on this machine yet"
elif grep -q 'FAILED' "$push_log"; then
  fail ".beads/push.log records a failed beads push -- issue data may exist only on this machine"
  sed -n '1,10s/^/       | /p' "$push_log" >>"$report"
elif [ "$(wc -l <"$push_log")" -gt 1 ]; then
  fail ".beads/push.log should hold one 'ok' line but has more -- read it"
else
  ok ".beads/push.log records a successful push"
fi

# --- report ------------------------------------------------------------------------
if [ "$failures" -eq 0 ]; then
  if [ "$mode" = hook ]; then
    echo "beads-doctor: ok ($checks checks)"
  else
    cat "$report"
    echo "beads-doctor: ok ($checks checks)"
  fi
  exit 0
fi

cat "$report"
echo "beads-doctor: $failures of $checks checks FAILED -- beads wiring is broken (scripts/beads-doctor.sh)"
[ "$mode" = hook ] && exit 0
exit 1
