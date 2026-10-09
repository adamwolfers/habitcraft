#!/usr/bin/env bash
# Tests for scripts/drain/bd-failures.jq (habitcraft-82by):
#
#   scripts/drain/bd-failures.test.sh
#
# Feeds a hand-built pass transcript through the filter exactly as drain.sh
# does. Not run in CI: scripts/drain/ is paths-ignored there.
set -u

here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT

use() { # use <id> <command>
  jq -cn --arg id "$1" --arg c "$2" \
    '{type:"assistant",message:{content:[{type:"tool_use",name:"Bash",id:$id,input:{command:$c}}]}}'
}
result() { # result <id> <is_error> <output>
  jq -cn --arg id "$1" --argjson e "$2" --arg o "$3" \
    '{type:"user",message:{content:[{type:"tool_result",tool_use_id:$id,is_error:$e,content:$o}]}}'
}

{
  use ok1 'bd ready --label agent-ok --json -n 1'
  result ok1 false '[{"id":"habitcraft-aaa"}]'
  use locked 'bd update habitcraft-aaa --claim'
  result locked false 'Error: database is locked by another process'
  use failed 'git status && bd label add habitcraft-aaa agent-review'
  result failed true 'Error: issue habitcraft-aaa not found'
  use notbd 'npm test'
  result notbd true 'Tests failed'
  use lockfile 'cat package-lock.json'
  result lockfile false 'lockfileVersion: 3, timed out nowhere'
  use bdlike 'echo bdx; grep bd README.md'
  result bdlike true 'no match'
  # Real false positives from the first run: 'timeout' in a file a chained
  # command printed, and a chained grep exiting 1.
  use chained 'bd show habitcraft-aaa && cat jest.config.js'
  result chained false 'testTimeout: 30000 // tests time out after 30s'
  use grepmiss 'bd show habitcraft-aaa && grep -c zzz notes.txt'
  result grepmiss true '0'
  use bdtimeout 'bd dolt push'
  result bdtimeout true 'Error: dolt push timed out after 30s'
  echo 'Alarm clock: 14  perl -e ...'   # stderr noise drain.sh captures too
} >"$tmp/pass.jsonl"

out=$(jq -cR 'fromjson? // empty' "$tmp/pass.jsonl" | jq -rs -f "$here/bd-failures.jq")

passed=0
failed=0
check() { # check <description> <command...>
  if "${@:2}"; then passed=$((passed + 1)); else failed=$((failed + 1)); echo "FAIL: $1"; fi
}
has() { grep -qF -- "$1" <<<"$out"; }
lacks() { ! grep -qF -- "$1" <<<"$out"; }

check "reports a bd call whose output says the database is locked" has "bd update habitcraft-aaa --claim => Error: database is locked"
check "reports a bd call that exited non-zero, even mid-chain" has "bd label add habitcraft-aaa agent-review"
check "ignores a bd call that succeeded" lacks "bd ready"
check "ignores a failed command that is not bd" lacks "npm test"
check "ignores lock/timeout words in non-bd output" lacks "package-lock"
check "ignores commands that merely contain 'bd'" lacks "grep bd"
check "ignores 'timeout' in non-error output of a chained command" lacks "cat jest.config.js"
check "ignores a non-zero exit with no Error: line" lacks "grep -c zzz"
check "reports a bd Error: line that timed out" has "bd dolt push => Error: dolt push timed out"
check "skips non-JSON lines in the transcript" [ "$(wc -l <<<"$out")" -eq 3 ]

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
