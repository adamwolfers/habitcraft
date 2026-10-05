#!/usr/bin/env bash
# Tests for scripts/ralph/land.sh (habitcraft-tjwp):
#
#   scripts/ralph/land.test.sh
#
# Each case builds a throwaway world in a temp dir: a bare "origin", a main
# checkout cloned from it, and a Ralph clone holding a review branch. git is
# real; gh, bd and pgrep are recording stubs, so nothing reaches GitHub, the
# Dolt remote, or a real loop. Git config is isolated from the user's, so no
# global hooks or settings leak in.
#
# Not run in CI: scripts/ralph/ is paths-ignored there, like the loop itself.
set -u

here=$(cd "$(dirname "$0")" && pwd)
land="$here/land.sh"

tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL="$tmp/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global init.defaultBranch master
git config --global user.name "Land Test"
git config --global user.email "land-test@example.invalid"
git config --global advice.detachedHead false

# --- stubs -----------------------------------------------------------------------
mkdir -p "$tmp/bin"

# bd: records "<cwd>|<args>"; serves the agent-review list from review.json.
# It also eats a line of stdin, as a bd that reads stdin would, so a caller
# that loops over `read` without redirecting bd's stdin loses ids and fails.
cat >"$tmp/bin/bd" <<'EOF'
#!/usr/bin/env bash
echo "$PWD|$*" >>"$LAND_TEST_W/bd.log"
read -r -t 1 _ 2>/dev/null || true
case "$*" in
  "list --label agent-review"*) cat "$LAND_TEST_W/review.json" ;;
esac
exit 0
EOF

# gh: `run list` reports one CI run on origin's master (none when ci=none);
# `run view` fails gh_fail times first, then reports conclusion=<ci>.
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
W=$LAND_TEST_W
echo "$*" >>"$W/gh.log"
q=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  [ "${args[i]}" = "-q" ] && q="${args[i + 1]}"
done
case "$1 $2" in
  "run list")
    if [ "$(cat "$W/ci")" = none ]; then
      json='[]'
    else
      json="[{\"databaseId\":4242,\"headSha\":\"$(git --git-dir="$W/origin.git" rev-parse master)\"}]"
    fi
    ;;
  "run view")
    n=$(cat "$W/gh_fail")
    if [ "$n" -gt 0 ]; then
      echo $((n - 1)) >"$W/gh_fail"
      echo "net/http: TLS handshake timeout" >&2
      exit 1
    fi
    json="{\"status\":\"completed\",\"conclusion\":\"$(cat "$W/ci")\"}"
    ;;
  *) echo "unexpected gh call: $*" >&2; exit 1 ;;
esac
if [ -n "$q" ]; then jq -r "$q" <<<"$json"; else echo "$json"; fi
EOF

# pgrep: "finds" a running ralph.sh only when the case says so.
cat >"$tmp/bin/pgrep" <<'EOF'
#!/usr/bin/env bash
[ -e "$LAND_TEST_W/ralph_running" ]
EOF
chmod +x "$tmp/bin/"*

# --- fixture ---------------------------------------------------------------------
commit() { # commit <repo> <subject> -- one file per subject, so rebases never conflict
  f="$(printf %s "$2" | tr -c 'a-zA-Z0-9' _).txt"
  echo "$2" >"$1/$f"
  git -C "$1" add "$f"
  git -C "$1" commit -q -m "$2"
}

# make_world <name>: origin with one seed commit; main checkout on master with
# land.sh in it; the clone on ralph/test with four commits -- two agent-review
# beads, one bead that is not under review, and one with no bead at all.
make_world() {
  W="$tmp/$1"
  mkdir -p "$W"
  git init -q --bare "$W/origin.git"
  git clone -q "$W/origin.git" "$W/main" 2>/dev/null
  mkdir -p "$W/main/scripts/ralph"
  cp "$land" "$here/lib.sh" "$W/main/scripts/ralph/"
  commit "$W/main" "Seed"
  git -C "$W/main" add scripts
  git -C "$W/main" commit -q -m "Add land.sh"
  git -C "$W/main" push -q origin master
  git clone -q "$W/origin.git" "$W/clone"
  git -C "$W/clone" switch -q -c ralph/test
  commit "$W/clone" "Do A (habitcraft-aaa)"
  commit "$W/clone" "Do B (habitcraft-bbb.1)"
  commit "$W/clone" "Tidy something (habitcraft-zzz)"
  commit "$W/clone" "A commit naming no bead"
  echo '[{"id":"habitcraft-aaa"},{"id":"habitcraft-bbb.1"},{"id":"habitcraft-ccc"}]' >"$W/review.json"
  echo success >"$W/ci"
  echo 0 >"$W/gh_fail"
  : >"$W/bd.log"
  seed_sha=$(git --git-dir="$W/origin.git" rev-parse master)
}

run_land() { # run_land [args...] -- runs in $W/main against $W/clone
  (cd "$W/main" &&
    PATH="$tmp/bin:$PATH" LAND_TEST_W="$W" RALPH_CLONE="$W/clone" LAND_POLL_SECONDS=0 \
      bash scripts/ralph/land.sh "$@") >"$tmp/out" 2>&1
  rc=$?
}

passed=0
failed=0
check() { # check <description> <command...>
  desc=$1
  shift
  if "$@"; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "FAIL: $desc"
    sed 's/^/    | /' "$tmp/out"
  fi
}
out_has() { grep -q -- "$1" "$tmp/out"; }
bd_has() { grep -q -- "$1" "$W/bd.log"; }
bd_lacks() { ! grep -q -- "$1" "$W/bd.log"; }
origin_master() { git --git-dir="$W/origin.git" rev-parse master; }
origin_has() { git --git-dir="$W/origin.git" log --format=%s master | grep -qxF -- "$1"; }
origin_untouched() { [ "$(origin_master)" = "$seed_sha" ]; }
short_sha_of() { git --git-dir="$W/origin.git" log --format=%h --grep="$1" -1 master; }

# --- happy path ------------------------------------------------------------------
make_world happy
run_land ralph/test
check "happy: exits 0" [ "$rc" -eq 0 ]
check "happy: every commit reached origin" origin_has "A commit naming no bead"
check "happy: main checkout is origin's master" \
  [ "$(git -C "$W/main" rev-parse HEAD)" = "$(origin_master)" ]
check "happy: closes the first reviewed bead" bd_has "close habitcraft-aaa "
check "happy: closes a dotted bead id" bd_has "close habitcraft-bbb.1 "
check "happy: close reason names the CI run" bd_has "close habitcraft-aaa .*4242"
check "happy: close reason names the commit" bd_has "close habitcraft-aaa .*$(short_sha_of 'Do A')"
check "happy: drops the review label" bd_has "label remove habitcraft-aaa agent-review"
check "happy: leaves a reviewed bead with no commit open" bd_lacks "close habitcraft-ccc"
check "happy: says why habitcraft-ccc stayed open" out_has "habitcraft-ccc"
check "happy: does not close a bead that was not under review" bd_lacks "close habitcraft-zzz"
check "happy: says why habitcraft-zzz was not closed" out_has "habitcraft-zzz"
check "happy: pushes beads from the main checkout" bd_has "^$W/main|dolt push"
check "happy: pulls beads into the clone" bd_has "^$W/clone|dolt pull"
check "happy: clone is back on master" [ "$(git -C "$W/clone" branch --show-current)" = master ]
check "happy: clone is at origin's master" [ "$(git -C "$W/clone" rev-parse HEAD)" = "$(origin_master)" ]
check "happy: clone's review branch is gone" \
  [ -z "$(git -C "$W/clone" branch --list ralph/test)" ]
check "happy: main's copy of the branch is gone" \
  [ -z "$(git -C "$W/main" branch --list ralph/test)" ]

# --- master moved on while the loop ran -------------------------------------------
make_world moved
git clone -q "$W/origin.git" "$W/other"
commit "$W/other" "Someone else's commit"
git -C "$W/other" push -q origin master
run_land ralph/test
check "moved: exits 0" [ "$rc" -eq 0 ]
check "moved: keeps the other commit" origin_has "Someone else's commit"
check "moved: lands the branch on top" origin_has "Do B (habitcraft-bbb.1)"
check "moved: close reason uses the rebased sha" \
  bd_has "close habitcraft-aaa .*$(short_sha_of 'Do A')"

# --- CI red -----------------------------------------------------------------------
make_world red
echo failure >"$W/ci"
run_land ralph/test
check "red: exits non-zero" [ "$rc" -ne 0 ]
check "red: the code was still pushed" origin_has "Do A (habitcraft-aaa)"
check "red: closes nothing" bd_lacks "close "
check "red: reports the conclusion" out_has "failure"
check "red: still syncs the clone" [ "$(git -C "$W/clone" branch --show-current)" = master ]

# --- transient gh errors ------------------------------------------------------------
make_world flaky
echo 2 >"$W/gh_fail"
run_land ralph/test
check "flaky: retries past gh errors and exits 0" [ "$rc" -eq 0 ]
check "flaky: closes after the retries" bd_has "close habitcraft-aaa "

# --- no CI run (all paths ignored) ---------------------------------------------------
make_world norun
echo none >"$W/ci"
run_land ralph/test
check "norun: exits non-zero" [ "$rc" -ne 0 ]
check "norun: closes nothing" bd_lacks "close "
check "norun: says no CI run was found" out_has "no CI run"

# --- refusals: nothing may be pushed -------------------------------------------------
make_world dirty
echo stray >"$W/main/stray.txt"
run_land ralph/test
check "dirty main: refuses" [ "$rc" -ne 0 ]
check "dirty main: pushes nothing" origin_untouched

make_world offmaster
git -C "$W/main" switch -q -c elsewhere
run_land ralph/test
check "off master: refuses" [ "$rc" -ne 0 ]
check "off master: pushes nothing" origin_untouched

make_world running
touch "$W/ralph_running"
run_land ralph/test
check "loop running: refuses" [ "$rc" -ne 0 ]
check "loop running: says why" out_has "ralph.sh is running"
check "loop running: pushes nothing" origin_untouched

make_world nobranch
run_land ralph/nope
check "missing branch: refuses" [ "$rc" -ne 0 ]
check "missing branch: pushes nothing" origin_untouched

make_world noargs
run_land
check "no branch argument: refuses" [ "$rc" -ne 0 ]
check "no branch argument: prints usage" out_has "Usage"

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
