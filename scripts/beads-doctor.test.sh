#!/usr/bin/env sh
# Tests for scripts/beads-doctor.sh (habitcraft-gl9):
#
#   scripts/beads-doctor.test.sh
#
# Runs in CI as the verify-beads-doctor job and as a phase of
# scripts/test-all.sh (habitcraft-308j), so it must keep needing nothing
# beyond sh, git and the root npm install -- CI has no bd.
#
# Each case builds a throwaway git repo in a temp dir, copies in the REAL
# .husky/ beads hooks and husky's real 'h' dispatcher, breaks one thing, and
# runs the doctor against it. Nothing touches this checkout's git config, and
# the real bd is never on PATH -- a recording stub stands in for it, and the
# last case asserts the stub was never called.
set -u

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
root=$(dirname "$here")
doctor="$here/beads-doctor.sh"
husky_h="$root/node_modules/husky/husky"

if [ ! -f "$husky_h" ]; then
  echo "needs husky installed: run 'npm install' at the repo root" >&2
  exit 2
fi

tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT

hooks="pre-commit prepare-commit-msg post-checkout post-merge pre-push"

# A minimal PATH: git plus the base system. This keeps Homebrew's real bd out.
mkdir -p "$tmp/gitbin" "$tmp/bdbin" "$tmp/xdg"
ln -s "$(command -v git)" "$tmp/gitbin/git"
base_path="$tmp/gitbin:/usr/bin:/bin:/usr/sbin:/sbin"

# Stands in for an installed bd. It records every call, so a non-empty record
# means the doctor ran a hook against a bd that could push for real.
cat >"$tmp/bdbin/bd" <<EOF
#!/bin/sh
echo "\$*" >>"$tmp/installed-bd-calls"
EOF
chmod +x "$tmp/bdbin/bd"

# make_fixture <name>: a healthy repo, laid out as this one is after npm install.
make_fixture() {
  f="$tmp/$1"
  mkdir -p "$f/.husky/_" "$f/.beads" "$f/scripts"
  git -C "$f" init -q
  git -C "$f" config core.hooksPath .husky/_
  cp "$husky_h" "$f/.husky/_/h"
  for h in $hooks; do
    cp "$root/.husky/$h" "$f/.husky/$h"
    # shellcheck disable=SC2016 # husky's stub text, written out literally
    printf '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n' >"$f/.husky/_/$h"
    chmod +x "$f/.husky/_/$h"
  done
  echo "2026-09-13T00:00:00-07:00 ok [manual]" >"$f/.beads/push.log"
  cp "$doctor" "$f/scripts/beads-doctor.sh" 2>/dev/null
  # .husky/pre-push hands the push to this, so the hook cannot reach bd without it.
  cp "$here/beads-dolt-push.sh" "$f/scripts/beads-dolt-push.sh"
}

# run_doctor <fixture> [doctor args]: sets $rc; output lands in $tmp/out.
#
# Two knobs, set them on their own line and clear them after the call:
#   doctor_path  replaces the PATH, e.g. to leave bd uninstalled
#   doctor_env   extra NAME=value words for env, e.g. HUSKY=0
# Do NOT write 'doctor_env=... run_doctor'. An assignment in front of a shell
# FUNCTION call stays set after it returns, and leaks into every later case.
doctor_path=
doctor_env=
run_doctor() {
  f="$tmp/$1"
  shift
  (
    # shellcheck disable=SC2086 # doctor_env must split into NAME=value words
    cd "$f" &&
      env -u HUSKY \
        PATH="${doctor_path:-$tmp/bdbin:$base_path}" \
        XDG_CONFIG_HOME="$tmp/xdg" \
        GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
        $doctor_env \
        sh scripts/beads-doctor.sh "$@"
  ) >"$tmp/out" 2>&1
  rc=$?
}

passed=0
failed=0
check() {
  name=$1
  shift
  if "$@"; then
    passed=$((passed + 1))
    echo "ok   - $name"
  else
    failed=$((failed + 1))
    echo "FAIL - $name (rc=$rc)"
    sed 's/^/     | /' "$tmp/out"
  fi
}
out_has() { grep -q -- "$1" "$tmp/out"; }
out_lacks() { ! grep -q -- "$1" "$tmp/out"; }
out_reports_every_hook() {
  for h in $hooks; do
    grep -q "^ok .*$h" "$tmp/out" || return 1
  done
}

# --- healthy -----------------------------------------------------------------
make_fixture healthy
run_doctor healthy
check "healthy layout passes" [ "$rc" -eq 0 ]
check "healthy layout reports no FAIL line" out_lacks '^FAIL'
check "healthy layout checks every beads hook" out_reports_every_hook

# --- core.hooksPath ----------------------------------------------------------
make_fixture nohookspath
git -C "$tmp/nohookspath" config --unset core.hooksPath
run_doctor nohookspath
check "unset core.hooksPath fails" [ "$rc" -eq 1 ]
check "unset core.hooksPath is named" out_has '^FAIL.*core.hooksPath'

# The habitcraft-8t8 shape: git pointed at .beads/hooks, whose hooks exited
# before doing anything. Both the path check and the reach check must see it.
make_fixture beads8t8
mkdir -p "$tmp/beads8t8/.beads/hooks"
for h in $hooks; do
  printf '#!/bin/sh\nexit 0\n' >"$tmp/beads8t8/.beads/hooks/$h"
  chmod +x "$tmp/beads8t8/.beads/hooks/$h"
done
git -C "$tmp/beads8t8" config core.hooksPath "$tmp/beads8t8/.beads/hooks"
run_doctor beads8t8
check "habitcraft-8t8 layout fails" [ "$rc" -eq 1 ]
check "habitcraft-8t8 layout names core.hooksPath" out_has '^FAIL.*core.hooksPath'
check "habitcraft-8t8 layout names the unreached pre-push" out_has '^FAIL.*pre-push'

# --- husky stubs -------------------------------------------------------------
# A fresh clone: core.hooksPath can be set, but .husky/_ only exists after
# npm install runs the prepare script.
make_fixture freshclone
rm -rf "$tmp/freshclone/.husky/_"
run_doctor freshclone
check "missing .husky/_ stubs fail" [ "$rc" -eq 1 ]
check "missing .husky/_ stubs are named" out_has '^FAIL.*\.husky/_'
check "missing stubs point at npm install" out_has 'npm install'

make_fixture onestub
rm -f "$tmp/onestub/.husky/_/post-checkout"
run_doctor onestub
check "one missing stub fails" [ "$rc" -eq 1 ]
check "one missing stub is named" out_has '^FAIL.*post-checkout'

# --- reaching bd ---------------------------------------------------------------
make_fixture earlyexit
{ echo 'exit 0'; cat "$root/.husky/post-merge"; } >"$tmp/earlyexit/.husky/post-merge"
run_doctor earlyexit
check "hook exiting before bd fails" [ "$rc" -eq 1 ]
check "hook exiting before bd is named" out_has '^FAIL.*post-merge'
check "healthy sibling hooks are not blamed" out_lacks '^FAIL.*pre-push'

# The shape of e5a1702: the hook reaches bd, but with a subcommand bd removed.
make_fixture oldsubcommand
printf 'bd hook pre-commit\n' >"$tmp/oldsubcommand/.husky/pre-commit"
run_doctor oldsubcommand
check "hook calling the wrong bd subcommand fails" [ "$rc" -eq 1 ]
check "hook calling the wrong bd subcommand is named" out_has '^FAIL.*pre-commit'

make_fixture huskyoff
doctor_env="HUSKY=0"
run_doctor huskyoff
doctor_env=
check "HUSKY=0 fails" [ "$rc" -eq 1 ]
check "HUSKY=0 is named" out_has 'HUSKY'

# --- bd itself -----------------------------------------------------------------
make_fixture nobd
doctor_path=$base_path
run_doctor nobd
doctor_path=
check "bd not on PATH fails" [ "$rc" -eq 1 ]
check "bd not on PATH is named" out_has '^FAIL.*bd.*PATH'

# --- .beads/push.log -----------------------------------------------------------
make_fixture pushfailed
cat >"$tmp/pushfailed/.beads/push.log" <<'EOF'
2026-09-13T00:00:00-07:00 FAILED rc=1 [SessionEnd reason=exit sid=abcd1234]
  Error: remote rejected
EOF
run_doctor pushfailed
check "failed push in push.log fails" [ "$rc" -eq 1 ]
check "failed push in push.log is named" out_has '^FAIL.*push.log'

make_fixture nopushlog
rm -f "$tmp/nopushlog/.beads/push.log"
run_doctor nopushlog
check "absent push.log (nothing pushed yet) passes" [ "$rc" -eq 0 ]

# --- --hook mode -----------------------------------------------------------------
run_doctor healthy --hook
check "--hook on a healthy repo exits 0" [ "$rc" -eq 0 ]
check "--hook on a healthy repo prints one line" [ "$(wc -l <"$tmp/out")" -eq 1 ]

run_doctor earlyexit --hook
check "--hook on a broken repo still exits 0" [ "$rc" -eq 0 ]
check "--hook on a broken repo prints the failure" out_has '^FAIL.*post-merge'

# --- pushing when another copy pushed first (habitcraft-lw6u) --------------------
# Not the doctor: these drive the real .husky/pre-push and scripts/beads-push.sh,
# which share scripts/beads-dolt-push.sh, against a fake bd that plays a Dolt
# remote. Its state lives in the fixture's .fake-bd/: 'behind' makes a push
# fail non-fast-forward until a pull clears it, 'conflict' makes that pull fail
# the way bd 1.2.2 does when two copies changed one issue, and 'broken' makes a
# push fail for some other reason. Every call is recorded, one per line.
mkdir -p "$tmp/remotebin"
cat >"$tmp/remotebin/bd" <<'EOF'
#!/bin/sh
s=.fake-bd
echo "$*" >>"$s/calls"
case "$*" in
  'dolt push')
    if [ -e "$s/broken" ]; then echo 'Error: authentication failed'; exit 1; fi
    if [ -e "$s/behind" ]; then
      echo ' ! [rejected]            main -> main (non-fast-forward)'
      exit 1
    fi
    echo 'Push complete.' ;;
  'dolt pull')
    if [ -e "$s/conflict" ]; then
      echo 'Error: merge origin/main: merge conflicts in issues require operator resolution; merge aborted and working set restored'
      exit 1
    fi
    rm -f "$s/behind"
    echo 'Pull complete.' ;;
  *) exit 97 ;;
esac
EOF
chmod +x "$tmp/remotebin/bd"

# make_remote_fixture <name> [state...]: a healthy fixture with both push paths.
make_remote_fixture() {
  make_fixture "$1"
  cp "$here/beads-push.sh" "$tmp/$1/scripts/"
  mkdir -p "$tmp/$1/.fake-bd"
  name=$1
  shift
  for state in "$@"; do : >"$tmp/$name/.fake-bd/$state"; done
}

# push_via <fixture> pre-push|session: runs one push path; sets $rc, $tmp/out.
push_via() {
  f="$tmp/$1"
  (
    cd "$f" || exit
    export PATH="$tmp/remotebin:$base_path" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
    unset HUSKY
    if [ "$2" = pre-push ]; then
      git hook run pre-push -- origin https://example.invalid/r
    else
      sh scripts/beads-push.sh SessionEnd
    fi
  ) </dev/null >"$tmp/out" 2>&1
  rc=$?
}
calls_are() { [ "$(paste -sd, "$f/.fake-bd/calls")" = "$1" ]; }
log_has() { grep -q -- "$1" "$f/.beads/push.log"; }

make_remote_fixture current
push_via current pre-push
check "pre-push, remote current: succeeds" [ "$rc" -eq 0 ]
check "pre-push, remote current: pushes without pulling" calls_are "dolt push"

make_remote_fixture behind behind
push_via behind pre-push
check "pre-push, remote ahead: succeeds" [ "$rc" -eq 0 ]
check "pre-push, remote ahead: pulls, then pushes again" \
  calls_are "dolt push,dolt pull,dolt push"

make_remote_fixture conflict behind conflict
push_via conflict pre-push
check "pre-push, conflicting pull: blocks the git push" [ "$rc" -ne 0 ]
check "pre-push, conflicting pull: does not push again" \
  calls_are "dolt push,dolt pull"
check "pre-push, conflicting pull: shows bd's conflict error" out_has 'merge conflicts'
check "pre-push, conflicting pull: says nothing changed here" out_has 'changed nothing'

make_remote_fixture broken broken
push_via broken pre-push
check "pre-push, other push failure: blocks the git push" [ "$rc" -ne 0 ]
check "pre-push, other push failure: does not pull" calls_are "dolt push"

make_remote_fixture sessbehind behind
push_via sessbehind session
check "beads-push.sh, remote ahead: pulls, then pushes again" \
  calls_are "dolt push,dolt pull,dolt push"
check "beads-push.sh, remote ahead: logs ok" log_has ' ok \[SessionEnd'

make_remote_fixture sessconflict behind conflict
push_via sessconflict session
check "beads-push.sh, conflicting pull: logs FAILED" log_has 'FAILED rc=1'
check "beads-push.sh, conflicting pull: logs bd's conflict error" log_has 'merge conflicts'

# --- no side effects -------------------------------------------------------------
check "the installed bd was never called" [ ! -e "$tmp/installed-bd-calls" ]

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
