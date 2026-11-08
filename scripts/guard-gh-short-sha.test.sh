#!/usr/bin/env bash
# Tests for scripts/guard-gh-short-sha.sh (habitcraft-fl1b):
#
#   scripts/guard-gh-short-sha.test.sh
#
# Feeds the guard the JSON a PreToolUse hook gets and checks it blocks (exit 2)
# or allows (exit 0). Needs jq; no gh, git or network.
set -u

here=$(cd "$(dirname "$0")" && pwd)
guard="$here/guard-gh-short-sha.sh"
full=37cefefe86dc0b07a8edda459e097c0c5e2b54a6
pass=0 fail=0

check() { # <want exit> <description> <command>
    local got
    jq -n --arg c "$3" '{tool_name: "Bash", tool_input: {command: $c}}' |
        "$guard" 2>/dev/null
    got=$?
    if [ "$got" = "$1" ]; then
        pass=$((pass + 1))
    else
        fail=$((fail + 1)); echo "FAIL: $2 -- want exit $1, got $got"
    fi
}

check 2 "short sha after --commit"    'gh run list --commit 37cefef --json databaseId'
check 2 "short sha after -c"          'gh run list -c 37cefef'
check 2 "--commit=short"              'gh run list --commit=37cefef'
check 2 "quoted short sha"            'gh run list --commit "37cefef" --json x'
check 2 "short sha at end of command" 'gh run list --json x --commit 37cefef'
check 2 "inside a wait loop"          'until out=$(gh run list --commit 37cefef --json status 2>/dev/null); do sleep 30; done'
check 2 "39 hex chars"                "gh run list --commit ${full%?}"

check 0 "full sha"                    "gh run list --commit $full"
check 0 "rev-parse substitution"      'gh run list --commit "$(git rev-parse HEAD)"'
check 0 "variable"                    'gh run list --commit "$sha"'
check 0 "no --commit"                 'gh run list --limit 8 --json databaseId,headSha'
check 0 "short sha elsewhere"         'git show 37cefef && gh run list --limit 5'
check 0 "--commit on another command" 'gh pr list --commit 37cefef; gh run list'
check 0 "not a hex word"              'gh run list --commit HEAD'
check 0 "unrelated command"           'ls -la'

# Unparseable input must not block: a guard that fails closed blocks every call.
echo 'not json' | "$guard" 2>/dev/null
if [ $? = 0 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL: bad JSON blocked"; fi

echo "guard-gh-short-sha: $pass passed, $fail failed"
[ "$fail" = 0 ]
