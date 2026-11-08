#!/usr/bin/env bash
# Tests for scripts/ci-wait.sh (habitcraft-fl1b):
#
#   scripts/ci-wait.test.sh
#
# Each case runs ci-wait.sh in a throwaway git repo with a stub gh on PATH. The
# stub serves `run list` from a script of JSON responses, one per poll, and
# `run view` from a conclusions file, so nothing reaches GitHub.
set -u

here=$(cd "$(dirname "$0")" && pwd)
wait="$here/ci-wait.sh"

tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT

export GIT_CONFIG_GLOBAL="$tmp/gitconfig" GIT_CONFIG_NOSYSTEM=1
git init -q "$tmp/repo"
git -C "$tmp/repo" -c user.name=t -c user.email=t@example.invalid commit -q --allow-empty -m one
sha=$(git -C "$tmp/repo" rev-parse HEAD)
short=$(git -C "$tmp/repo" rev-parse --short HEAD)

mkdir -p "$tmp/bin"
# gh run list: prints poll-<n>.json for the nth call (the last one repeats),
# filtered by -q like the real gh. gh run view <id>: prints view-<id> if present.
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
W=$CI_WAIT_TEST_W
q=""; args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do [ "${args[i]}" = "-q" ] && q="${args[i + 1]}"; done
case "$1 $2" in
  "run list")
    case "$*" in *--commit*) echo "ci-wait used --commit" >&2; exit 1 ;; esac
    n=$(( $(cat "$W/calls" 2>/dev/null || echo 0) + 1 )); echo "$n" >"$W/calls"
    f="$W/poll-$n.json"; [ -f "$f" ] || f=$(ls "$W"/poll-*.json | sort -V | tail -1)
    jq -r "$q" "$f" ;;
  "run view")
    [ -f "$W/view-$3" ] || exit 1
    cat "$W/view-$3" ;;
esac
EOF
chmod +x "$tmp/bin/gh"

pass=0 fail=0
case_no=0

# new_case: fresh state dir; then write poll-<n>.json files into $W.
new_case() { case_no=$((case_no + 1)); W="$tmp/case$case_no"; mkdir -p "$W"; }

run() { # <rev> -- runs ci-wait.sh, sets $out and $code
    out=$(cd "$tmp/repo" && CI_WAIT_TEST_W=$W PATH="$tmp/bin:$PATH" \
        CI_WAIT_POLL=0 CI_WAIT_APPEAR_TRIES=3 "$wait" "$1" 2>&1)
    code=$?
}

expect() { # <description> <want exit> <grep pattern>
    if [ "$code" = "$2" ] && printf '%s\n' "$out" | grep -q -- "$3"; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1)); printf 'FAIL: %s -- exit %s, output:\n%s\n' "$1" "$code" "$out"
    fi
}

run_json() { # <id> <status> <conclusion> <workflow> [headSha]
    printf '{"databaseId":%s,"status":"%s","conclusion":"%s","workflowName":"%s","headSha":"%s"}' \
        "$1" "$2" "$3" "$4" "${5:-$sha}"
}

# A short rev is resolved to the full SHA, and runs are matched on .headSha.
new_case
echo "[$(run_json 1 completed success CI), $(run_json 2 completed success 'Link Check'), $(run_json 9 completed failure CI 0000000000000000000000000000000000000000)]" >"$W/poll-1.json"
run "$short"
expect "short rev, all green" 0 "commit $sha: green"
expect "lists every run of the commit" 0 "2 Link Check: success"
if printf '%s\n' "$out" | grep -q "^9 "; then
    fail=$((fail + 1)); echo "FAIL: reported another commit's run"
else pass=$((pass + 1)); fi

# Waits while a run is in progress.
new_case
echo "[$(run_json 1 in_progress '' CI)]" >"$W/poll-1.json"
echo "[$(run_json 1 completed success CI)]" >"$W/poll-2.json"
run HEAD
expect "waits for in-progress runs" 0 "1 CI: success"

# Waits for runs to appear.
new_case
echo "[]" >"$W/poll-1.json"
echo "[$(run_json 1 completed success CI)]" >"$W/poll-2.json"
run HEAD
expect "waits for runs to appear" 0 "green"

# A failed run fails the wait.
new_case
echo "[$(run_json 1 completed success CI), $(run_json 2 completed failure 'Link Check')]" >"$W/poll-1.json"
run HEAD
expect "a failure exits 1" 1 "NOT green"

# The conclusion comes from gh run view when it answers.
new_case
echo "[$(run_json 1 completed success CI)]" >"$W/poll-1.json"
echo "failure" >"$W/view-1"
run HEAD
expect "gh run view's conclusion wins" 1 "1 CI: failure"

# No run ever appears: gives up with a reason instead of spinning.
new_case
echo "[]" >"$W/poll-1.json"
run HEAD
expect "no run gives up" 2 "no run for $sha"

# A rev that is not a commit.
new_case
echo "[]" >"$W/poll-1.json"
run no-such-rev
expect "bad rev" 2 "is not a commit"

echo "ci-wait: $pass passed, $fail failed"
[ "$fail" = 0 ]
