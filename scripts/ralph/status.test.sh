#!/usr/bin/env bash
# Tests for scripts/ralph/status.sh (habitcraft-3oxu):
#
#   scripts/ralph/status.test.sh
#
# Each case points status.sh at a throwaway "clone": a real git repo plus a
# .ralph/summary.log. bd and pgrep are stubs, so nothing reads a real beads
# database or sees a real loop. Not run in CI: scripts/ralph/ is paths-ignored.
set -u

here=$(cd "$(dirname "$0")" && pwd)
status_sh="$here/status.sh"

tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL="$tmp/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global init.defaultBranch master
git config --global user.name "Status Test"
git config --global user.email "status-test@example.invalid"

mkdir -p "$tmp/bin"
# bd: counts calls; serves beads.json, or fails when bd_fails exists.
cat >"$tmp/bin/bd" <<'EOF'
#!/usr/bin/env bash
echo "$*" >>"$STATUS_TEST_W/bd.log"
[ -e "$STATUS_TEST_W/bd_fails" ] && { echo "Error: database is locked" >&2; exit 1; }
cat "$STATUS_TEST_W/beads.json"
EOF
cat >"$tmp/bin/pgrep" <<'EOF'
#!/usr/bin/env bash
[ -e "$STATUS_TEST_W/ralph_running" ] && echo 4321
EOF
chmod +x "$tmp/bin/"*

make_clone() { # make_clone <name>: master + ralph/test two commits ahead
  W="$tmp/$1"
  mkdir -p "$W/clone/.ralph"
  git -C "$W/clone" init -q
  git -C "$W/clone" commit -q --allow-empty -m "Seed"
  git -C "$W/clone" switch -q -c ralph/test
  git -C "$W/clone" commit -q --allow-empty -m "Do A (habitcraft-aaa)"
  git -C "$W/clone" commit -q --allow-empty -m "Do B (habitcraft-bbb)"
  printf '%s\n' \
    "2026-10-05T09:00:00-0700 pass 1: labelled=3 head=1111111 log=pass-1.jsonl" \
    "2026-10-05T09:04:00-0700 WARN: pass 1: 1 bd call(s) failed -- contention with mg? see pass-1.jsonl" \
    "2026-10-05T09:04:01-0700   bd update habitcraft-aaa --claim => Error: database is locked" \
    "2026-10-05T09:04:02-0700 pass 1: exit=0 labelled=3->2 head=1111111->2222222" \
    "2026-10-05T09:04:03-0700 pass 2: labelled=2 head=2222222 log=pass-2.jsonl" \
    >"$W/clone/.ralph/summary.log"
  cat >"$W/beads.json" <<'EOF'
[
  {"id":"habitcraft-ccc","status":"in_progress","priority":2,"labels":["agent-ok"],"title":"The bead a pass is on"},
  {"id":"habitcraft-ddd","status":"open","priority":2,"labels":["agent-ok","tech-debt"],"title":"Queued first"},
  {"id":"habitcraft-eee","status":"open","priority":3,"labels":["agent-ok"],"title":"Queued second"},
  {"id":"habitcraft-aaa","status":"in_progress","priority":2,"labels":["agent-review"],"title":"Done, awaiting review"},
  {"id":"habitcraft-zzz","status":"open","priority":1,"labels":["frontend"],"title":"Not the loop's"},
  {"id":"habitcraft-nnn","status":"open","priority":2,"labels":null,"title":"No labels at all"}
]
EOF
  : >"$W/bd.log"
}

run_status() { # run_status [args...]
  PATH="$tmp/bin:$PATH" STATUS_TEST_W="$W" RALPH_CLONE="$W/clone" \
    bash "$status_sh" "$@" >"$tmp/out" 2>&1
  rc=$?
}

passed=0
failed=0
check() { # check <description> <command...>
  if "${@:2}"; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "FAIL: $1"
    sed 's/^/    | /' "$tmp/out"
  fi
}
out_has() { grep -qF -- "$1" "$tmp/out"; }
out_lacks() { ! grep -qF -- "$1" "$tmp/out"; }
# section_has <heading> <text>: <text> appears between <heading> and the next blank line
section_has() { awk -v h="$1" 'index($0, h) == 1 { on = 1; next } on && /^$/ { exit } on' "$tmp/out" | grep -qF -- "$2"; }

# --- one-shot render --------------------------------------------------------------
make_clone render
run_status
check "render: exits 0" [ "$rc" -eq 0 ]
check "render: says the loop is not running" out_has "not running"
check "render: names the review branch and how far ahead it is" out_has "ralph/test, 2 commits ahead of master"
check "render: in-progress agent-ok bead is under Working" section_has "Working (1)" "habitcraft-ccc"
check "render: open agent-ok beads are Queued" section_has "Queued (2)" "habitcraft-ddd"
check "render: both queued beads listed" section_has "Queued (2)" "habitcraft-eee"
check "render: queued bead is not also under Working" out_lacks "Working (3)"
check "render: agent-review bead is under Review" section_has "Review (1)" "habitcraft-aaa"
check "render: empty Stuck section says so" section_has "Stuck (0)" "none"
check "render: beads outside the loop are not shown" out_lacks "habitcraft-zzz"
check "render: unlabelled beads are not shown" out_lacks "habitcraft-nnn"
check "render: shows the latest summary.log line" out_has "pass 2: labelled=2"
check "render: surfaces WARN lines" out_has "1 WARN line(s)"
check "render: one bd call per refresh" [ "$(grep -c . "$W/bd.log")" -eq 1 ]

make_clone running
touch "$W/ralph_running"
run_status
check "running: reports the loop's pid" out_has "running (pid 4321)"

make_clone onmaster
git -C "$W/clone" switch -q master
rm "$W/clone/.ralph/summary.log"
run_status
check "on master: says there is no review branch" out_has "master (no review branch)"
check "on master: copes with no summary.log" [ "$rc" -eq 0 ]

make_clone bdfails
touch "$W/bd_fails"
run_status
check "bd failure: exits non-zero" [ "$rc" -ne 0 ]
check "bd failure: says bd failed, with its error" out_has "database is locked"

# --- arguments --------------------------------------------------------------------
make_clone args
run_status --help
check "--help: exits 0 with usage" [ "$rc" -eq 0 ]
check "--help: prints usage" out_has "Usage"
run_status --watch abc
check "--watch with a non-number: refuses" [ "$rc" -ne 0 ]
run_status --bogus
check "unknown option: refuses" [ "$rc" -ne 0 ]

make_clone noclone
rm -rf "$W/clone"
run_status
check "missing clone: refuses" [ "$rc" -ne 0 ]
check "missing clone: says where it looked" out_has "$W/clone"

# --watch redraws until interrupted: run it briefly and count the frames.
make_clone watch
(PATH="$tmp/bin:$PATH" STATUS_TEST_W="$W" RALPH_CLONE="$W/clone" TERM=dumb \
  bash "$status_sh" --watch 1 >"$tmp/out" 2>&1) &
pid=$!
sleep 2.5
kill "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
check "--watch: redraws more than once" [ "$(grep -c 'Working (1)' "$tmp/out")" -ge 2 ]

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
